export const sexValues = [
  "FEMALE",
  "MALE",
  "OTHER",
  "PREFER_NOT_TO_SAY",
] as const;

export const activityLevelValues = [
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "VERY_ACTIVE",
  "ATHLETE",
] as const;

export const goalTypeValues = [
  "LOSE_WEIGHT",
  "MAINTAIN",
  "GAIN_MUSCLE",
  "PERFORMANCE",
] as const;

export const mealTypeValues = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;

export const sourceTypeValues = [
  "USDA",
  "OPEN_FOOD_FACTS",
  "FALLBACK",
  "MANUAL",
] as const;

export const messageRoleValues = ["USER", "ASSISTANT"] as const;

export const messageIntentValues = [
  "ADD",
  "EDIT",
  "REMOVE",
  "UNDO",
  "SET_GOALS",
  "ERROR",
  "INFO",
] as const;

export type Sex = (typeof sexValues)[number];
export type ActivityLevel = (typeof activityLevelValues)[number];
export type GoalType = (typeof goalTypeValues)[number];
export type MealType = (typeof mealTypeValues)[number];
export type SourceType = (typeof sourceTypeValues)[number];
export type MessageRole = (typeof messageRoleValues)[number];
export type MessageIntent = (typeof messageIntentValues)[number];
