import type { MealType, SourceType } from "@/types/domain";

export interface ExtraNutrient {
  label: string;
  unit: string;
  value: number;
}

export type ExtraNutrientMap = Record<string, ExtraNutrient>;

export interface NutritionRecord {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
  saturatedFat: number;
  potassium: number;
  calcium: number;
  iron: number;
  magnesium: number;
  vitaminA: number;
  vitaminC: number;
  vitaminD: number;
  vitaminB12: number;
  extra: ExtraNutrientMap;
}

export interface NutritionLookupSource {
  type: SourceType;
  name: string;
  query: string;
  matchedDescription: string;
  brandName?: string | null;
  externalId?: string | null;
  confidence?: number | null;
  householdServingText?: string | null;
  raw?: unknown;
  isAmbiguous?: boolean;
}

export interface NutritionLookupResult {
  description: string;
  quantityText: string;
  amount: number;
  unit: string | null;
  servingGrams: number | null;
  mealType: MealType;
  nutrients: NutritionRecord;
  source: NutritionLookupSource;
}
