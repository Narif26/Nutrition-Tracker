import {
  getConfiguredParserMode,
  getConfiguredParserModel,
  type ParserMode,
} from "@/lib/ai/runtime";
import { db } from "@/lib/db";
import { ensureDemoUser } from "@/lib/auth";
import {
  dateKeyFromDayStart,
  formatSeriesLabel,
  getDateWindow,
  getDayStart,
  resolveTimeZone,
} from "@/lib/date";
import { isProfileComplete } from "@/lib/goals";
import { nutrientDefinitions } from "@/lib/nutrition/config";
import {
  createEmptyNutritionRecord,
  nutritionFromRow,
  roundNutritionRecord,
} from "@/lib/nutrition/helpers";
import { recomputeDailySummary } from "@/lib/services/daily-summary";
import type { AppSnapshot, ChatMessageView, FoodEntryView } from "@/types/app";

function buildProgress(target: number, current: number) {
  if (target <= 0) {
    return 0;
  }

  return (current / target) * 100;
}

function serializeEntry(
  entry: Awaited<
    ReturnType<typeof db.foodEntry.findMany>
  >[number] & {
    sourceMetadata: {
      query: string;
      householdServingText: string | null;
      confidence: number | null;
    } | null;
  },
): FoodEntryView {
  return {
    id: entry.id,
    description: entry.description,
    originalInput: entry.originalInput,
    quantityText: entry.quantityText ?? "1 serving",
    mealType: entry.mealType,
    loggedAt: entry.loggedAt.toISOString(),
    nutrients: roundNutritionRecord(nutritionFromRow(entry)),
    source: {
      type: entry.sourceType,
      name: entry.sourceName,
      matchedDescription: entry.matchedDescription,
      brandName: entry.brandName,
      externalId: entry.sourceExternalId,
      confidence: entry.sourceMetadata?.confidence ?? entry.confidence ?? null,
      householdServingText: entry.sourceMetadata?.householdServingText ?? null,
      isAmbiguous: entry.isAmbiguous,
      query: entry.sourceMetadata?.query ?? entry.description,
    },
  };
}

function serializeMessage(
  message: Awaited<ReturnType<typeof db.chatMessage.findMany>>[number],
): ChatMessageView {
  return {
    id: message.id,
    role: message.role,
    intent: message.intent,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getAppSnapshot(options?: {
  days?: number;
  timeZone?: string | null;
  parserMode?: ParserMode;
}): Promise<AppSnapshot> {
  const user = await ensureDemoUser();
  const days = options?.days ?? 30;
  const timeZone = resolveTimeZone(options?.timeZone);
  const parserMode = options?.parserMode ?? getConfiguredParserMode();
  const today = getDayStart(new Date(), timeZone);
  const range = getDateWindow(days, timeZone);

  const [entries, messages, summaries] = await Promise.all([
    db.foodEntry.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        loggedDay: today,
      },
      include: {
        sourceMetadata: true,
      },
      orderBy: {
        loggedAt: "desc",
      },
    }),
    db.chatMessage.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
    db.dailySummary.findMany({
      where: {
        userId: user.id,
        date: {
          gte: range[0],
        },
      },
      orderBy: {
        date: "asc",
      },
    }),
  ]);

  let todaySummary = summaries.find(
    (summary) => summary.date.getTime() === today.getTime(),
  );

  if (!todaySummary) {
    todaySummary = await recomputeDailySummary(user.id, today, db, timeZone);
  }

  const totals = roundNutritionRecord(
    todaySummary ? nutritionFromRow(todaySummary) : createEmptyNutritionRecord(),
  );
  const goals = roundNutritionRecord(
    user.goals ? nutritionFromRow(user.goals) : createEmptyNutritionRecord(),
  );
  const entryViews = entries.map(serializeEntry);

  const progress = nutrientDefinitions.map((definition) => {
    const current = totals[definition.key];
    const target = goals[definition.key];

    return {
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      current,
      target,
      remaining: target - current,
      percent: buildProgress(target, current),
      kind: definition.kind,
    };
  });

  const summaryByDate = new Map(
    summaries.map((summary) => [summary.date.toISOString(), summary]),
  );
  const dailySeries = range.map((date) => {
    const summary = summaryByDate.get(date.toISOString());
    const calories = summary?.calories ?? 0;

    return {
      date: date.toISOString(),
      label: formatSeriesLabel(date, days),
      calories,
      goal: goals.calories,
    };
  });

  const messageFeed: ChatMessageView[] =
    messages.length > 0
      ? messages.reverse().map(serializeMessage)
      : [
          {
            id: "welcome",
            role: "ASSISTANT" as const,
            intent: "INFO" as const,
            content:
              "Tell me what you ate and I'll log it, update your dashboard, and keep your goals in view.",
            createdAt: new Date().toISOString(),
          },
        ];
  return {
    generatedAt: new Date().toISOString(),
    runtime: {
      parserMode,
      model: getConfiguredParserModel(),
      timeZone,
    },
    user: {
      email: user.email,
      name: user.name,
      mode: "DEMO",
    },
    profile: {
      age: user.profile?.age ?? null,
      sex: user.profile?.sex ?? null,
      heightCm: user.profile?.heightCm ?? null,
      weightKg: user.profile?.weightKg ?? null,
      activityLevel: user.profile?.activityLevel ?? null,
      goalType: user.profile?.goalType ?? null,
      isComplete: Boolean(user.profile) && isProfileComplete({
        age: user.profile?.age ?? null,
        sex: user.profile?.sex ?? null,
        heightCm: user.profile?.heightCm ?? null,
        weightKg: user.profile?.weightKg ?? null,
        activityLevel: user.profile?.activityLevel ?? null,
        goalType: user.profile?.goalType ?? null,
      }),
    },
    goals: {
      ...goals,
      updatedAt: user.goals?.updatedAt.toISOString() ?? null,
    },
    messages: messageFeed,
    today: {
      date: dateKeyFromDayStart(today),
      totals,
      entries: entryViews,
      progress,
      remainingCalories: goals.calories - totals.calories,
    },
    dailySeries,
  };
}
