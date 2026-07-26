import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dateKeyFromDayStart, getDayStart, inferMealType } from "@/lib/date";
import { generateSuggestedGoals, mergeGoalOverrides } from "@/lib/goals";
import {
  addNutritionRecords,
  createEmptyNutritionRecord,
  nutritionFromRow,
  nutritionRecordToGoalColumns,
  nutritionRecordToColumns,
  roundNutritionRecord,
} from "@/lib/nutrition/helpers";
import { lookupNutritionForCandidate } from "@/lib/nutrition/lookup";
import { parseChatCommand, type StructuredFoodCandidate } from "@/lib/parser/chat-command";
import { recomputeDailySummary } from "@/lib/services/daily-summary";
import { titleCase, toSentenceList } from "@/lib/utils";
import type { NutritionLookupResult } from "@/types/nutrition";

export interface AgentFoodInput {
  text: string;
  amount?: number | null;
  unit?: string | null;
}

export interface LlmLoggedFoodItem {
  description: string;
  quantityText: string;
  amount?: number | null;
  unit?: string | null;
  nutrients: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface TodayStateSummary {
  date: string;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  goals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  remainingCalories: number;
  entries: Array<{
    id: string;
    label: string;
    loggedAt: string;
  }>;
}

function normalizeUnit(unit: string | null | undefined) {
  if (!unit) {
    return null;
  }

  const normalized = unit.trim().toLowerCase();

  if (["ounces", "ounce"].includes(normalized)) {
    return "oz";
  }

  if (["grams", "gram"].includes(normalized)) {
    return "g";
  }

  if (["pounds", "pound", "lbs"].includes(normalized)) {
    return "lb";
  }

  if (["tablespoon", "tablespoons"].includes(normalized)) {
    return "tbsp";
  }

  if (["teaspoon", "teaspoons"].includes(normalized)) {
    return "tsp";
  }

  if (normalized.endsWith("s") && normalized.length > 2) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function buildQuantityText(amount: number, unit: string | null) {
  if (!unit) {
    return amount === 1 ? "1 serving" : `${amount} servings`;
  }

  if (amount === 1) {
    return `1 ${unit}`;
  }

  return unit.endsWith("s") ? `${amount} ${unit}` : `${amount} ${unit}s`;
}

function buildStructuredFoodCandidate(
  input: AgentFoodInput,
  timeZone: string,
): StructuredFoodCandidate {
  const amount = input.amount && input.amount > 0 ? input.amount : 1;
  const unit = normalizeUnit(input.unit);

  return {
    rawText: input.text,
    searchText: input.text,
    displayText: input.text,
    amount,
    unit,
    quantityText: buildQuantityText(amount, unit),
    mealType: inferMealType(new Date(), timeZone),
    isEstimatedQuantity: input.amount == null,
  };
}

function isWholeDayTarget(targetText: string | null) {
  const normalized = targetText
    ?.trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return false;
  }

  if (
    [
      "today",
      "today log",
      "today's log",
      "todays log",
      "today entries",
      "today's entries",
      "todays entries",
      "today stats",
      "today's stats",
      "todays stats",
      "today totals",
      "today's totals",
      "todays totals",
      "daily stats",
      "daily totals",
      "fresh start",
      "start over",
      "current data",
      "all current data",
      "everything",
      "the day",
      "day",
    ].includes(normalized)
  ) {
    return true;
  }

  return /\b(clear|reset|wipe)\b/.test(normalized) &&
    /\b(today|daily|stats|totals|log|entries|data)\b/.test(normalized);
}

function scoreEntryMatch(
  entry: Awaited<ReturnType<typeof db.foodEntry.findMany>>[number],
  targetText: string,
) {
  const target = targetText.toLowerCase();
  const haystack = `${entry.description} ${entry.matchedDescription} ${entry.originalInput}`.toLowerCase();

  let score = 0;

  if (haystack.includes(target)) {
    score += 80;
  }

  const targetTokens = target.split(/\s+/).filter(Boolean);
  score += targetTokens.filter((token) => haystack.includes(token)).length * 12;

  return score;
}

async function createEntryInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  input: string,
  result: NutritionLookupResult,
  groupId: string,
  timeZone: string,
  loggedAt = new Date(),
) {
  const entry = await tx.foodEntry.create({
    data: {
      userId,
      originalInput: input,
      description: titleCase(result.description),
      quantityText: result.quantityText,
      amount: result.amount,
      unit: result.unit ?? undefined,
      servingGrams: result.servingGrams ?? undefined,
      mealType: result.mealType,
      loggedAt,
      loggedDay: getDayStart(loggedAt, timeZone),
      groupId,
      sourceType: result.source.type,
      sourceExternalId: result.source.externalId ?? undefined,
      sourceName: result.source.name,
      brandName: result.source.brandName ?? undefined,
      matchedDescription: result.source.matchedDescription,
      confidence: result.source.confidence ?? undefined,
      isAmbiguous: result.source.isAmbiguous ?? false,
      externalMetadata:
        result.source.raw && typeof result.source.raw === "object"
          ? (result.source.raw as Prisma.InputJsonObject)
          : undefined,
      ...nutritionRecordToColumns(result.nutrients),
    },
  });

  await tx.entrySourceMetadata.create({
    data: {
      foodEntryId: entry.id,
      query: result.source.query,
      matchedName: result.source.matchedDescription,
      brandName: result.source.brandName ?? undefined,
      sourceType: result.source.type,
      sourceName: result.source.name,
      externalId: result.source.externalId ?? undefined,
      householdServingText: result.source.householdServingText ?? undefined,
      confidence: result.source.confidence ?? undefined,
      raw:
        result.source.raw && typeof result.source.raw === "object"
          ? (result.source.raw as Prisma.InputJsonObject)
          : undefined,
    },
  });

  return entry;
}

async function getOrRecomputeTodaySummary(userId: string, dayStart: Date, timeZone: string) {
  const existing = await db.dailySummary.findUnique({
    where: {
      userId_date: {
        userId,
        date: dayStart,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return recomputeDailySummary(userId, dayStart, db, timeZone);
}

export async function getTodayStateSummary(userId: string, timeZone: string): Promise<TodayStateSummary> {
  const today = getDayStart(new Date(), timeZone);
  const [user, entries, summary] = await Promise.all([
    db.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        goals: true,
      },
    }),
    db.foodEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        loggedDay: today,
      },
      orderBy: {
        loggedAt: "desc",
      },
    }),
    getOrRecomputeTodaySummary(userId, today, timeZone),
  ]);

  const totals = roundNutritionRecord(nutritionFromRow(summary));
  const goals = roundNutritionRecord(
    user?.goals ? nutritionFromRow(user.goals) : createEmptyNutritionRecord(),
  );

  return {
    date: dateKeyFromDayStart(today),
    totals: {
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
    },
    goals: {
      calories: goals.calories,
      protein: goals.protein,
      carbs: goals.carbs,
      fat: goals.fat,
    },
    remainingCalories: goals.calories - totals.calories,
    entries: entries.map((entry) => ({
      id: entry.id,
      label: `${entry.quantityText ?? "1 serving"} ${entry.description}`.trim(),
      loggedAt: entry.loggedAt.toISOString(),
    })),
  };
}

export async function previewFoodMatch(
  input: AgentFoodInput,
  timeZone: string,
) {
  const candidate = buildStructuredFoodCandidate(input, timeZone);
  const result = await lookupNutritionForCandidate(candidate);

  if (!result) {
    return {
      found: false,
      query: input.text,
    };
  }

  const rounded = roundNutritionRecord(result.nutrients);

  return {
    found: true,
    query: input.text,
    match: {
      description: titleCase(result.description),
      quantityText: result.quantityText,
      amount: result.amount,
      unit: result.unit,
      nutrients: {
        calories: rounded.calories,
        protein: rounded.protein,
        carbs: rounded.carbs,
        fat: rounded.fat,
      },
      source: {
        type: result.source.type,
        name: result.source.name,
        matchedDescription: result.source.matchedDescription,
        brandName: result.source.brandName ?? null,
        externalId: result.source.externalId ?? null,
        confidence: result.source.confidence ?? null,
      },
    },
  };
}

export async function previewFoodMatches(
  inputs: AgentFoodInput[],
  timeZone: string,
) {
  const results = await Promise.all(
    inputs.map(async (input) => ({
      input,
      preview: await previewFoodMatch(input, timeZone),
    })),
  );

  return {
    items: results.map((result) => ({
      input: result.input,
      ...result.preview,
    })),
  };
}

export async function addFoodEntries(
  userId: string,
  rawInput: string,
  items: AgentFoodInput[],
  timeZone: string,
) {
  const candidates = items.map((item) => buildStructuredFoodCandidate(item, timeZone));
  const lookups = await Promise.all(
    candidates.map(async (item) => ({
      item,
      result: await lookupNutritionForCandidate(item),
    })),
  );

  const successes = lookups.filter(
    (lookup): lookup is { item: StructuredFoodCandidate; result: NutritionLookupResult } =>
      lookup.result !== null,
  );
  const failures = lookups.filter((lookup) => lookup.result === null);

  if (!successes.length) {
    throw new Error("I couldn't find a reliable nutrition match for that entry.");
  }

  const groupId = crypto.randomUUID();
  const now = new Date();

  await db.$transaction(async (tx) => {
    for (const success of successes) {
      await createEntryInTransaction(
        tx,
        userId,
        rawInput,
        success.result,
        groupId,
        timeZone,
        now,
      );
    }

    await recomputeDailySummary(userId, now, tx, timeZone);
  });

  const nutrientsAdded = successes.reduce((accumulator, success) => {
    return addNutritionRecords(accumulator, success.result.nutrients);
  }, createEmptyNutritionRecord());
  const loggedNames = successes.map(
    (success) => `${success.result.quantityText} ${titleCase(success.result.description)}`,
  );
  const failureNames = failures.map((failure) => `"${failure.item.rawText}"`);

  return {
    message: `Logged ${toSentenceList(loggedNames)} for ${Math.round(nutrientsAdded.calories)} kcal.${failureNames.length ? ` I skipped ${toSentenceList(failureNames)} because I couldn't match them cleanly.` : ""}`,
    added: successes.map((success) => ({
      label: `${success.result.quantityText} ${titleCase(success.result.description)}`,
      sourceName: success.result.source.name,
      sourceType: success.result.source.type,
      calories: Math.round(success.result.nutrients.calories),
    })),
    skipped: failureNames,
    state: await getTodayStateSummary(userId, timeZone),
  };
}

export async function addManualLlmFoodEntries(
  userId: string,
  rawInput: string,
  items: LlmLoggedFoodItem[],
  timeZone: string,
  updatedTotals?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  },
) {
  if (items.length === 0) {
    throw new Error("The LLM response did not include any food items to log.");
  }

  const groupId = crypto.randomUUID();
  const now = new Date();

  await db.$transaction(async (tx) => {
    for (const item of items) {
      const record = createEmptyNutritionRecord();
      record.calories = item.nutrients.calories;
      record.protein = item.nutrients.protein;
      record.carbs = item.nutrients.carbs;
      record.fat = item.nutrients.fat;

      await tx.foodEntry.create({
        data: {
          userId,
          originalInput: rawInput,
          description: titleCase(item.description),
          quantityText: item.quantityText,
          amount: item.amount ?? undefined,
          unit: item.unit ?? undefined,
          mealType: inferMealType(now, timeZone),
          loggedAt: now,
          loggedDay: getDayStart(now, timeZone),
          groupId,
          sourceType: "MANUAL",
          sourceName: "OpenAI structured estimate",
          matchedDescription: titleCase(item.description),
          confidence: 0.7,
          isAmbiguous: false,
          ...nutritionRecordToColumns(record),
        },
      });
    }

    const summary = await recomputeDailySummary(userId, now, tx, timeZone);

    if (updatedTotals) {
      await tx.dailySummary.update({
        where: {
          id: summary.id,
        },
        data: {
          calories: updatedTotals.calories,
          protein: updatedTotals.protein,
          carbs: updatedTotals.carbs,
          fat: updatedTotals.fat,
        },
      });
    }
  });

  return {
    message: `Logged ${toSentenceList(items.map((item) => `${item.quantityText} ${titleCase(item.description)}`))}.`,
    state: await getTodayStateSummary(userId, timeZone),
  };
}

export async function removeFoodEntry(
  userId: string,
  options: {
    targetText?: string | null;
    targetEntryId?: string | null;
    timeZone: string;
  },
) {
  if (isWholeDayTarget(options.targetText ?? null)) {
    return clearTodayEntries(userId, options.timeZone);
  }

  const today = getDayStart(new Date(), options.timeZone);
  const entries = await db.foodEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      loggedDay: today,
    },
    orderBy: {
      loggedAt: "desc",
    },
  });

  const directMatch = options.targetEntryId
    ? entries.find((entry) => entry.id === options.targetEntryId)
    : null;
  const bestTextMatch = entries
    .map((entry) => ({
      entry,
      score: scoreEntryMatch(entry, options.targetText ?? ""),
    }))
    .sort((left, right) => right.score - left.score)[0];
  const match =
    directMatch ??
    (bestTextMatch && bestTextMatch.score >= 18 ? bestTextMatch.entry : null);

  if (!match) {
    throw new Error(
      options.targetText
        ? `I couldn't find "${options.targetText}" in today's log.`
        : "I couldn't find that item in today's log.",
    );
  }

  await db.$transaction(async (tx) => {
    await tx.foodEntry.update({
      where: {
        id: match.id,
      },
      data: {
        deletedAt: new Date(),
        deletedReason: "Removed from chat",
      },
    });

    await recomputeDailySummary(userId, today, tx, options.timeZone);
  });

  return {
    message: `Removed ${match.quantityText ?? "1 serving"} ${match.description} from today.`,
    state: await getTodayStateSummary(userId, options.timeZone),
  };
}

export async function clearTodayEntries(userId: string, timeZone: string) {
  const today = getDayStart(new Date(), timeZone);
  const entries = await db.foodEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      loggedDay: today,
    },
    select: {
      id: true,
    },
  });

  await db.$transaction(async (tx) => {
    if (entries.length) {
      await tx.foodEntry.updateMany({
        where: {
          id: {
            in: entries.map((entry) => entry.id),
          },
        },
        data: {
          deletedAt: new Date(),
          deletedReason: "Cleared today",
        },
      });
    }

    await recomputeDailySummary(userId, today, tx, timeZone);
  });

  return {
    message: entries.length
      ? "Cleared today's log and reset your daily totals."
      : "Today's log is already empty.",
    state: await getTodayStateSummary(userId, timeZone),
  };
}

export async function undoLastFoodAction(userId: string, timeZone: string) {
  const entry = await db.foodEntry.findFirst({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: {
      loggedAt: "desc",
    },
  });

  if (!entry) {
    throw new Error("There isn't anything to undo yet.");
  }

  const entryIds = entry.groupId
    ? (
        await db.foodEntry.findMany({
          where: {
            userId,
            deletedAt: null,
            groupId: entry.groupId,
          },
          select: {
            id: true,
          },
        })
      ).map((item) => item.id)
    : [entry.id];

  await db.$transaction(async (tx) => {
    await tx.foodEntry.updateMany({
      where: {
        id: {
          in: entryIds,
        },
      },
      data: {
        deletedAt: new Date(),
        deletedReason: "Undo",
      },
    });

    await recomputeDailySummary(userId, entry.loggedDay, tx);
  });

  return {
    message: `Undid your last log${entryIds.length > 1 ? ` (${entryIds.length} items)` : ""}.`,
    state: await getTodayStateSummary(userId, timeZone),
  };
}

export async function editFoodEntry(
  userId: string,
  rawInput: string,
  targetText: string,
  replacementText: string,
  options: {
    timeZone: string;
    targetEntryId?: string | null;
  },
) {
  const today = getDayStart(new Date(), options.timeZone);
  const entries = await db.foodEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      loggedDay: today,
    },
    orderBy: {
      loggedAt: "desc",
    },
  });

  const directMatch = options.targetEntryId
    ? entries.find((entry) => entry.id === options.targetEntryId)
    : null;
  const bestTextMatch = entries
    .map((entry) => ({
      entry,
      score: scoreEntryMatch(entry, targetText),
    }))
    .sort((left, right) => right.score - left.score)[0];
  const match =
    directMatch ??
    (bestTextMatch && bestTextMatch.score >= 18 ? bestTextMatch.entry : null);

  if (!match) {
    throw new Error(`I couldn't find "${targetText}" to edit.`);
  }

  const parsedReplacement = parseChatCommand(replacementText, {
    timeZone: options.timeZone,
  });

  if (parsedReplacement.intent !== "add" || parsedReplacement.items.length === 0) {
    throw new Error("I couldn't parse the replacement food.");
  }

  const replacementCandidate = {
    ...parsedReplacement.items[0],
    mealType: match.mealType,
  };
  const replacement = await lookupNutritionForCandidate(replacementCandidate);

  if (!replacement) {
    throw new Error(`I couldn't find nutrition data for "${replacementText}".`);
  }

  const groupId = crypto.randomUUID();

  await db.$transaction(async (tx) => {
    await tx.foodEntry.update({
      where: {
        id: match.id,
      },
      data: {
        deletedAt: new Date(),
        deletedReason: `Edited to ${replacementText}`,
      },
    });

    const newEntry = await createEntryInTransaction(
      tx,
      userId,
      rawInput,
      replacement,
      groupId,
      options.timeZone,
      match.loggedAt,
    );

    await tx.foodEntry.update({
      where: {
        id: match.id,
      },
      data: {
        replacedByEntryId: newEntry.id,
      },
    });

    await recomputeDailySummary(userId, match.loggedDay, tx);
  });

  return {
    message: `Updated ${match.description} to ${replacement.quantityText} ${titleCase(replacement.description)}.`,
    state: await getTodayStateSummary(userId, options.timeZone),
  };
}

export async function updateMacroGoals(
  userId: string,
  changes: Record<string, number>,
  timeZone: string,
) {
  const profile = await db.userProfile.findUnique({
    where: {
      userId,
    },
  });

  if (
    !profile?.age ||
    !profile?.sex ||
    !profile?.heightCm ||
    !profile?.weightKg ||
    !profile?.activityLevel ||
    !profile?.goalType
  ) {
    throw new Error("Finish your profile in settings before generating personalized goals.");
  }

  const generated = generateSuggestedGoals({
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    goalType: profile.goalType,
  });
  const merged = mergeGoalOverrides(generated, changes);

  await db.nutritionGoal.upsert({
    where: {
      userId,
    },
    update: nutritionRecordToGoalColumns(merged),
    create: {
      userId,
      ...nutritionRecordToGoalColumns(merged),
    },
  });

  const rounded = roundNutritionRecord(merged);

  return {
    message: `Updated your targets to ${Math.round(rounded.calories)} kcal and ${Math.round(rounded.protein)} g protein for the day.`,
    goals: {
      calories: rounded.calories,
      protein: rounded.protein,
      carbs: rounded.carbs,
      fat: rounded.fat,
    },
    state: await getTodayStateSummary(userId, timeZone),
  };
}
