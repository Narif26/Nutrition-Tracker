import type { DailySummary, FoodEntry, NutritionGoal, Prisma } from "@prisma/client";
import type {
  ExtraNutrient,
  ExtraNutrientMap,
  NutritionRecord,
} from "@/types/nutrition";
import { trackedNutrientKeys, type TrackedNutrientKey } from "@/lib/nutrition/config";
import { roundTo } from "@/lib/utils";

type NutritionRow = Pick<
  FoodEntry | DailySummary | NutritionGoal,
  TrackedNutrientKey
> & {
  extraNutrients?: unknown;
  extraTargets?: unknown;
};

export function createEmptyNutritionRecord(): NutritionRecord {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    cholesterol: 0,
    saturatedFat: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    magnesium: 0,
    vitaminA: 0,
    vitaminC: 0,
    vitaminD: 0,
    vitaminB12: 0,
    extra: {},
  };
}

export function normalizeExtraNutrients(input: unknown): ExtraNutrientMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const normalized: ExtraNutrientMap = {};

  for (const [key, rawValue] of Object.entries(input)) {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      continue;
    }

    const value = rawValue as Partial<ExtraNutrient>;
    if (
      typeof value.label === "string" &&
      typeof value.unit === "string" &&
      typeof value.value === "number"
    ) {
      normalized[key] = {
        label: value.label,
        unit: value.unit,
        value: value.value,
      };
    }
  }

  return normalized;
}

export function nutritionFromRow(row: NutritionRow): NutritionRecord {
  const record = createEmptyNutritionRecord();
  const extra = "extraTargets" in row ? row.extraTargets : row.extraNutrients;

  for (const key of trackedNutrientKeys) {
    record[key] = typeof row[key] === "number" ? row[key] : 0;
  }

  record.extra = normalizeExtraNutrients(extra);
  return record;
}

export function addNutritionRecords(
  base: NutritionRecord,
  next: NutritionRecord,
): NutritionRecord {
  const combined = createEmptyNutritionRecord();

  for (const key of trackedNutrientKeys) {
    combined[key] = base[key] + next[key];
  }

  const extra: ExtraNutrientMap = {};

  for (const [key, value] of Object.entries(base.extra)) {
    extra[key] = { ...value };
  }

  for (const [key, value] of Object.entries(next.extra)) {
    const existing = extra[key];
    extra[key] = {
      label: value.label,
      unit: value.unit,
      value: (existing?.value ?? 0) + value.value,
    };
  }

  combined.extra = extra;
  return combined;
}

export function scaleNutritionRecord(
  record: NutritionRecord,
  multiplier: number,
): NutritionRecord {
  const scaled = createEmptyNutritionRecord();

  for (const key of trackedNutrientKeys) {
    scaled[key] = record[key] * multiplier;
  }

  const extra: ExtraNutrientMap = {};
  for (const [key, value] of Object.entries(record.extra)) {
    extra[key] = {
      label: value.label,
      unit: value.unit,
      value: value.value * multiplier,
    };
  }

  scaled.extra = extra;
  return scaled;
}

export function roundNutritionRecord(record: NutritionRecord) {
  const rounded = createEmptyNutritionRecord();

  for (const key of trackedNutrientKeys) {
    rounded[key] = roundTo(record[key], key === "calories" ? 0 : 1);
  }

  const extra: ExtraNutrientMap = {};

  for (const [key, value] of Object.entries(record.extra)) {
    extra[key] = {
      label: value.label,
      unit: value.unit,
      value: roundTo(value.value),
    };
  }

  rounded.extra = extra;
  return rounded;
}

export function nutritionRecordToColumns(record: NutritionRecord) {
  const rounded = roundNutritionRecord(record);

  return {
    calories: rounded.calories,
    protein: rounded.protein,
    carbs: rounded.carbs,
    fat: rounded.fat,
    fiber: rounded.fiber,
    sugar: rounded.sugar,
    sodium: rounded.sodium,
    cholesterol: rounded.cholesterol,
    saturatedFat: rounded.saturatedFat,
    potassium: rounded.potassium,
    calcium: rounded.calcium,
    iron: rounded.iron,
    magnesium: rounded.magnesium,
    vitaminA: rounded.vitaminA,
    vitaminC: rounded.vitaminC,
    vitaminD: rounded.vitaminD,
    vitaminB12: rounded.vitaminB12,
    extraNutrients: rounded.extra as unknown as Prisma.InputJsonObject,
  };
}

export function nutritionRecordToGoalColumns(record: NutritionRecord) {
  const rounded = roundNutritionRecord(record);

  return {
    calories: rounded.calories,
    protein: rounded.protein,
    carbs: rounded.carbs,
    fat: rounded.fat,
    fiber: rounded.fiber,
    sugar: rounded.sugar,
    sodium: rounded.sodium,
    cholesterol: rounded.cholesterol,
    saturatedFat: rounded.saturatedFat,
    potassium: rounded.potassium,
    calcium: rounded.calcium,
    iron: rounded.iron,
    magnesium: rounded.magnesium,
    vitaminA: rounded.vitaminA,
    vitaminC: rounded.vitaminC,
    vitaminD: rounded.vitaminD,
    vitaminB12: rounded.vitaminB12,
    extraTargets: rounded.extra as unknown as Prisma.InputJsonObject,
  };
}

export function sortExtraNutrients(extra: ExtraNutrientMap) {
  return Object.entries(extra)
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) => right.value - left.value);
}
