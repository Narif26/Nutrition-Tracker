import { nutrientCommandAliases } from "@/lib/nutrition/config";
import { inferMealType } from "@/lib/date";
import type { MealType } from "@/types/domain";

export interface StructuredFoodCandidate {
  rawText: string;
  searchText: string;
  displayText: string;
  amount: number;
  unit: string | null;
  quantityText: string;
  mealType: MealType;
  isEstimatedQuantity: boolean;
}

export type ParsedCommand =
  | { intent: "undo"; rawText: string }
  | {
      intent: "remove";
      rawText: string;
      targetText: string | null;
      targetEntryId?: string | null;
      mealType: MealType | null;
    }
  | {
      intent: "edit";
      rawText: string;
      targetText: string;
      targetEntryId?: string | null;
      replacementText: string;
    }
  | {
      intent: "set_goals";
      rawText: string;
      useSuggested: boolean;
      changes: Record<string, number>;
    }
  | {
      intent: "add";
      rawText: string;
      items: StructuredFoodCandidate[];
      mealType: MealType;
    };

const numberWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  quarter: 0.25,
};

const supportedUnits = [
  "cup",
  "cups",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "tsp",
  "teaspoon",
  "teaspoons",
  "oz",
  "ounce",
  "ounces",
  "gram",
  "grams",
  "g",
  "kg",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "slice",
  "slices",
  "piece",
  "pieces",
  "glass",
  "glasses",
  "bottle",
  "bottles",
  "can",
  "cans",
  "carton",
  "cartons",
  "jar",
  "jars",
  "bag",
  "bags",
  "packet",
  "packets",
  "pouch",
  "pouches",
  "bar",
  "bars",
  "serving",
  "servings",
  "bowl",
  "bowls",
  "egg",
  "eggs",
  "banana",
  "bananas",
  "apple",
  "apples",
  "package",
  "packages",
  "pack",
  "packs",
  "container",
  "containers",
  "scoop",
  "scoops",
];

function normalizeUnit(unit: string | null) {
  if (!unit) {
    return null;
  }

  const normalized = unit.toLowerCase();

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

export function extractActionableCommandText(rawInput: string) {
  const normalized = rawInput.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return normalized;
  }

  const withoutPoliteLead = normalized
    .replace(/^(?:please\s+)+/i, "")
    .replace(/^(?:just\s+)+/i, "")
    .replace(/^(?:(?:can|could|would|will)\s+you|let's)\s+/i, "");
  const commandMatch =
    /(^|[,:;.!?]\s+)(?:please\s+)?(track|log|add|remove|delete|clear|reset|wipe|undo|change|edit|update|set)\b/i.exec(
      withoutPoliteLead,
    );

  if (!commandMatch) {
    return withoutPoliteLead.trim();
  }

  const keywordIndex =
    commandMatch.index +
    commandMatch[0].toLowerCase().lastIndexOf(commandMatch[2].toLowerCase());

  return withoutPoliteLead.slice(keywordIndex).trim();
}

function stripLead(text: string) {
  return text
    .trim()
    .replace(/^(i\s+had|i\s+ate|ate|had|log|add|track)\s+/i, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function extractMealType(text: string): {
  mealType: MealType | null;
  cleanText: string;
} {
  const mealMatch = text.match(/\b(breakfast|lunch|dinner|snack|snacks)\b/i);

  if (!mealMatch) {
    return {
      mealType: null,
      cleanText: text,
    };
  }

  const token = mealMatch[1].toLowerCase();
  const mealType =
    token === "breakfast"
      ? "BREAKFAST"
      : token === "lunch"
        ? "LUNCH"
        : token === "dinner"
          ? "DINNER"
          : "SNACK";

  return {
    mealType,
    cleanText: text.replace(mealMatch[0], "").replace(/\s{2,}/g, " ").trim(),
  };
}

function parseAmount(token: string) {
  const normalized = token.toLowerCase().trim();

  if (numberWords[normalized] !== undefined) {
    return numberWords[normalized];
  }

  if (/^\d+\s*\/\s*\d+$/.test(normalized)) {
    const [numerator, denominator] = normalized.split("/").map(Number);
    return numerator / denominator;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitCandidateSegments(text: string) {
  const segments = text
    .split(/\s*,\s*/)
    .flatMap((segment) => {
      if (!/\sand\s/i.test(segment) || /\swith\s/i.test(segment)) {
        return [segment];
      }

      const pieces = segment.split(/\s+and\s+/i).map((piece) => piece.trim());
      const shouldSplit = pieces.every(
        (piece) =>
          /^\d/.test(piece) ||
          /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\b/i.test(
            piece,
          ) ||
          piece.split(/\s+/).length <= 3,
      );

      return shouldSplit ? pieces : [segment];
    })
    .map((segment) => segment.trim())
    .filter(Boolean);

  const expanded: string[] = [];

  for (const segment of segments) {
    if (!/\swith\s/i.test(segment)) {
      expanded.push(segment);
      continue;
    }

    const [head, tail] = segment.split(/\s+with\s+/i);
    const headLower = head.toLowerCase();
    const headIngredient =
      ["chicken", "steak", "tofu", "salmon", "rice", "beans", "egg", "yogurt", "oatmeal"].find(
        (keyword) => headLower.includes(keyword),
      ) ?? head;

    expanded.push(headIngredient.trim());
    expanded.push(
      ...tail
        .split(/\s*(?:,|and)\s*/i)
        .map((part) => part.trim())
        .filter(Boolean),
    );
  }

  return expanded;
}

function parseStructuredCandidate(
  text: string,
  fallbackMealType: MealType,
): StructuredFoodCandidate {
  const cleaned = text.replace(/^(the|my)\s+/i, "").trim();
  const amountLead = cleaned.match(
    /^([0-9]+(?:\.[0-9]+)?|\d+\s*\/\s*\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\s+(.+)$/i,
  );

  let amount = 1;
  let rest = cleaned;
  let isEstimatedQuantity = true;

  if (amountLead) {
    const parsedAmount = parseAmount(amountLead[1]);
    if (parsedAmount !== null) {
      amount = parsedAmount;
      rest = amountLead[2];
      isEstimatedQuantity = false;
    }
  }

  const unitLead = rest.match(
    new RegExp(`^(${supportedUnits.join("|")})(?:\\s+of)?\\s+(.+)$`, "i"),
  );

  const unit = normalizeUnit(unitLead?.[1] ?? null);
  const searchText = (unitLead?.[2] ?? rest).trim().replace(/\s{2,}/g, " ");
  const quantityText =
    amountLead && unit ? `${amountLead[1]} ${unit}` : amountLead ? amountLead[1] : "1 serving";

  return {
    rawText: cleaned,
    searchText,
    displayText: searchText,
    amount,
    unit,
    quantityText,
    mealType: fallbackMealType,
    isEstimatedQuantity,
  };
}

function parseGoalChanges(text: string) {
  const changes: Record<string, number> = {};

  for (const [nutrientKey, aliases] of Object.entries(nutrientCommandAliases)) {
    for (const alias of aliases) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`${escapedAlias}\\s*(?:goal\\s*)?(?:to|=)?\\s*(\\d+(?:\\.\\d+)?)`, "i"),
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:kcal|g|mg|mcg)?\\s*(?:of\\s+)?${escapedAlias}`, "i"),
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          changes[nutrientKey] = Number.parseFloat(match[1]);
          break;
        }
      }
    }
  }

  return changes;
}

export function parseChatCommand(
  rawInput: string,
  options?: {
    timeZone?: string | null;
  },
): ParsedCommand {
  const stripped = stripLead(extractActionableCommandText(rawInput));
  const lower = stripped.toLowerCase();

  if (/^(undo|undo last item|undo last)$/i.test(stripped)) {
    return {
      intent: "undo",
      rawText: rawInput,
    };
  }

  const editFromMatch = stripped.match(
    /^(?:change|edit|update)\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+)$/i,
  );
  if (editFromMatch) {
    return {
      intent: "edit",
      rawText: rawInput,
      targetText: `${editFromMatch[2]} ${editFromMatch[1]}`.trim(),
      replacementText: `${editFromMatch[3]} ${editFromMatch[1]}`.trim(),
    };
  }

  const editToMatch = stripped.match(/^(?:change|edit|update)\s+(.+?)\s+to\s+(.+)$/i);
  if (editToMatch) {
    return {
      intent: "edit",
      rawText: rawInput,
      targetText: editToMatch[1].trim(),
      replacementText: editToMatch[2].trim(),
    };
  }

  const removeMatch = stripped.match(
    /^(?:remove|delete|clear|reset|wipe)\s+(.+)$/i,
  );
  if (removeMatch) {
    const { mealType, cleanText } = extractMealType(removeMatch[1].trim());
    return {
      intent: "remove",
      rawText: rawInput,
      targetText: mealType ? null : cleanText,
      mealType,
    };
  }

  if (/\b(fresh start|start over)\b/i.test(stripped)) {
    return {
      intent: "remove",
      rawText: rawInput,
      targetText: stripped,
      mealType: null,
    };
  }

  const looksLikeGoalUpdate =
    /\bgoals?\b/i.test(stripped) ||
    /^(?:set|update)\s+(?:my\s+)?(?:calories?|protein|carbs?|fat|fiber|sugar|sodium|cholesterol|potassium|calcium|iron|magnesium|vitamin)/i.test(
      stripped,
    );

  if (looksLikeGoalUpdate) {
    return {
      intent: "set_goals",
      rawText: rawInput,
      useSuggested: /\b(suggest|generate|recommended|reset)\b/i.test(lower),
      changes: parseGoalChanges(stripped),
    };
  }

  const { mealType, cleanText } = extractMealType(stripped);
  const parsedMealType = mealType ?? inferMealType(new Date(), options?.timeZone);
  const items = splitCandidateSegments(cleanText).map((segment) =>
    parseStructuredCandidate(segment, parsedMealType),
  );

  return {
    intent: "add",
    rawText: rawInput,
    items,
    mealType: parsedMealType,
  };
}
