import { defaultDailyTargets } from "@/lib/nutrition/config";
import type { ActivityLevel, GoalType, Sex } from "@/types/domain";
import type { NutritionRecord } from "@/types/nutrition";

export interface GoalProfileInput {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
}

const activityMultipliers: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  VERY_ACTIVE: 1.725,
  ATHLETE: 1.9,
};

const goalAdjustments: Record<GoalType, number> = {
  LOSE_WEIGHT: -450,
  MAINTAIN: 0,
  GAIN_MUSCLE: 300,
  PERFORMANCE: 200,
};

const proteinFactors: Record<GoalType, number> = {
  LOSE_WEIGHT: 1.8,
  MAINTAIN: 1.5,
  GAIN_MUSCLE: 2,
  PERFORMANCE: 1.8,
};

const fatRatios: Record<GoalType, number> = {
  LOSE_WEIGHT: 0.27,
  MAINTAIN: 0.3,
  GAIN_MUSCLE: 0.28,
  PERFORMANCE: 0.25,
};

export function isProfileComplete(
  profile:
    | GoalProfileInput
    | {
        age: number | null;
        sex: Sex | null;
        heightCm: number | null;
        weightKg: number | null;
        activityLevel: ActivityLevel | null;
        goalType: GoalType | null;
      },
) {
  return Boolean(
    profile.age &&
      profile.sex &&
      profile.heightCm &&
      profile.weightKg &&
      profile.activityLevel &&
      profile.goalType,
  );
}

function calculateBmr(profile: GoalProfileInput) {
  const base =
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;

  if (profile.sex === "MALE") {
    return base + 5;
  }

  if (profile.sex === "FEMALE") {
    return base - 161;
  }

  return base - 78;
}

export function generateSuggestedGoals(profile: GoalProfileInput): NutritionRecord {
  const bmr = calculateBmr(profile);
  const tdee = bmr * activityMultipliers[profile.activityLevel];
  const calories = Math.max(1400, Math.round((tdee + goalAdjustments[profile.goalType]) / 25) * 25);
  const protein = Math.round(profile.weightKg * proteinFactors[profile.goalType]);
  const fat = Math.round((calories * fatRatios[profile.goalType]) / 9);
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((calories / 1000) * 14);

  return {
    ...defaultDailyTargets,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    extra: {},
  };
}

export function mergeGoalOverrides(
  base: NutritionRecord,
  overrides: Partial<Record<Exclude<keyof NutritionRecord, "extra">, number>>,
): NutritionRecord {
  return {
    ...base,
    ...overrides,
    extra: base.extra,
  };
}
