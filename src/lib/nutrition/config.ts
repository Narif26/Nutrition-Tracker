import type { NutritionRecord } from "@/types/nutrition";
import type { ActivityLevel, GoalType, MealType, Sex } from "@/types/domain";

export const nutrientDefinitions = [
  { key: "calories", label: "Calories", unit: "kcal", kind: "minimum" },
  { key: "protein", label: "Protein", unit: "g", kind: "minimum" },
  { key: "carbs", label: "Carbs", unit: "g", kind: "minimum" },
  { key: "fat", label: "Fat", unit: "g", kind: "minimum" },
  { key: "fiber", label: "Fiber", unit: "g", kind: "minimum" },
  { key: "sugar", label: "Sugar", unit: "g", kind: "maximum" },
  { key: "sodium", label: "Sodium", unit: "mg", kind: "maximum" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg", kind: "maximum" },
  { key: "saturatedFat", label: "Saturated Fat", unit: "g", kind: "maximum" },
  { key: "potassium", label: "Potassium", unit: "mg", kind: "minimum" },
  { key: "calcium", label: "Calcium", unit: "mg", kind: "minimum" },
  { key: "iron", label: "Iron", unit: "mg", kind: "minimum" },
  { key: "magnesium", label: "Magnesium", unit: "mg", kind: "minimum" },
  { key: "vitaminA", label: "Vitamin A", unit: "mcg", kind: "minimum" },
  { key: "vitaminC", label: "Vitamin C", unit: "mg", kind: "minimum" },
  { key: "vitaminD", label: "Vitamin D", unit: "mcg", kind: "minimum" },
  { key: "vitaminB12", label: "Vitamin B12", unit: "mcg", kind: "minimum" },
] as const;

export type TrackedNutrientKey = (typeof nutrientDefinitions)[number]["key"];

export const trackedNutrientKeys = nutrientDefinitions.map(
  (definition) => definition.key,
) as TrackedNutrientKey[];

export const coreMetricKeys = [
  "calories",
  "protein",
  "carbs",
  "fat",
] as const satisfies TrackedNutrientKey[];

export type CoreMetricKey = (typeof coreMetricKeys)[number];

export function isCoreMetricKey(key: TrackedNutrientKey): key is CoreMetricKey {
  return (coreMetricKeys as readonly string[]).includes(key);
}

export const coreMetricDefinitions = nutrientDefinitions.filter((definition) =>
  isCoreMetricKey(definition.key),
);

export const macroNutrientKeys: TrackedNutrientKey[] = [
  "protein",
  "carbs",
  "fat",
  "fiber",
];

export const micronutrientKeys: TrackedNutrientKey[] = [
  "sugar",
  "sodium",
  "cholesterol",
  "saturatedFat",
  "potassium",
  "calcium",
  "iron",
  "magnesium",
  "vitaminA",
  "vitaminC",
  "vitaminD",
  "vitaminB12",
];

export const mealTypeLabels: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snacks",
};

export const sexLabels: Record<Sex, string> = {
  FEMALE: "Female",
  MALE: "Male",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

export const activityLevelLabels: Record<ActivityLevel, string> = {
  SEDENTARY: "Sedentary",
  LIGHT: "Lightly active",
  MODERATE: "Moderately active",
  VERY_ACTIVE: "Very active",
  ATHLETE: "Athlete",
};

export const goalTypeLabels: Record<GoalType, string> = {
  LOSE_WEIGHT: "Lose weight",
  MAINTAIN: "Maintain",
  GAIN_MUSCLE: "Gain muscle",
  PERFORMANCE: "Performance",
};

export const nutrientCommandAliases: Record<TrackedNutrientKey, string[]> = {
  calories: ["calorie", "calories", "kcal"],
  protein: ["protein"],
  carbs: ["carb", "carbs", "carbohydrate", "carbohydrates"],
  fat: ["fat", "fats"],
  fiber: ["fiber", "fibre"],
  sugar: ["sugar", "sugars"],
  sodium: ["sodium"],
  cholesterol: ["cholesterol"],
  saturatedFat: ["saturated fat", "sat fat"],
  potassium: ["potassium"],
  calcium: ["calcium"],
  iron: ["iron"],
  magnesium: ["magnesium"],
  vitaminA: ["vitamin a"],
  vitaminC: ["vitamin c"],
  vitaminD: ["vitamin d"],
  vitaminB12: ["vitamin b12", "b12"],
};

export const defaultDailyTargets: NutritionRecord = {
  calories: 2000,
  protein: 150,
  carbs: 225,
  fat: 67,
  fiber: 28,
  sugar: 50,
  sodium: 2300,
  cholesterol: 300,
  saturatedFat: 20,
  potassium: 4700,
  calcium: 1300,
  iron: 18,
  magnesium: 420,
  vitaminA: 900,
  vitaminC: 90,
  vitaminD: 20,
  vitaminB12: 2.4,
  extra: {},
};
