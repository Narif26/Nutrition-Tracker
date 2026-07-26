import { scaleNutritionRecord } from "@/lib/nutrition/helpers";
import type { StructuredFoodCandidate } from "@/lib/parser/chat-command";
import type { ExtraNutrientMap, NutritionLookupResult, NutritionRecord } from "@/types/nutrition";

interface UsdaSearchFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  score?: number;
}

interface UsdaFoodPortion {
  amount?: number;
  gramWeight?: number;
  modifier?: string;
  portionDescription?: string;
  measureUnit?: {
    name?: string;
    abbreviation?: string;
  };
}

interface UsdaFoodNutrient {
  amount?: number;
  nutrient?: {
    name?: string;
    number?: string;
    unitName?: string;
  };
  nutrientName?: string;
  unitName?: string;
}

interface UsdaFoodDetail {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodPortions?: UsdaFoodPortion[];
  labelNutrients?: Record<string, { value?: number }>;
  foodNutrients?: UsdaFoodNutrient[];
}

const nutrientMatchers: Record<Exclude<keyof NutritionRecord, "extra">, RegExp[]> = {
  calories: [/^energy$/i, /^calories$/i],
  protein: [/^protein$/i],
  carbs: [/^carbohydrate/i, /^total carbohydrate$/i],
  fat: [/^total lipid/i, /^total fat$/i],
  fiber: [/^fiber/i, /^dietary fiber$/i],
  sugar: [/^sugars/i, /^total sugars$/i],
  sodium: [/^sodium/i],
  cholesterol: [/^cholesterol$/i],
  saturatedFat: [/^fatty acids, total saturated$/i, /^saturated fat$/i],
  potassium: [/^potassium/i],
  calcium: [/^calcium/i],
  iron: [/^iron/i],
  magnesium: [/^magnesium/i],
  vitaminA: [/^vitamin a, rae$/i, /^vitamin a$/i],
  vitaminC: [/^vitamin c/i],
  vitaminD: [/^vitamin d/i],
  vitaminB12: [/^vitamin b-?12$/i],
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUnit(unit: string | null | undefined) {
  if (!unit) {
    return null;
  }

  const lower = unit.toLowerCase();
  if (["ounces", "ounce"].includes(lower)) {
    return "oz";
  }
  if (["grams", "gram"].includes(lower)) {
    return "g";
  }
  if (["pounds", "pound", "lbs"].includes(lower)) {
    return "lb";
  }
  if (["tablespoons", "tablespoon"].includes(lower)) {
    return "tbsp";
  }
  if (["teaspoons", "teaspoon"].includes(lower)) {
    return "tsp";
  }

  return lower.endsWith("s") ? lower.slice(0, -1) : lower;
}

function toMassInGrams(amount: number, unit: string | null | undefined) {
  const normalized = normalizeUnit(unit);

  if (!normalized) {
    return null;
  }

  if (normalized === "g") {
    return amount;
  }

  if (normalized === "kg") {
    return amount * 1000;
  }

  if (normalized === "oz") {
    return amount * 28.3495;
  }

  if (normalized === "lb") {
    return amount * 453.592;
  }

  return null;
}

function getNutrientName(nutrient: UsdaFoodNutrient) {
  return nutrient.nutrient?.name ?? nutrient.nutrientName ?? "";
}

function getNutrientUnit(nutrient: UsdaFoodNutrient) {
  return nutrient.nutrient?.unitName ?? nutrient.unitName ?? "";
}

function buildBaseRecord(): NutritionRecord {
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

function extractNutritionRecord(detail: UsdaFoodDetail): NutritionRecord {
  const record = buildBaseRecord();
  const extra: ExtraNutrientMap = {};

  for (const nutrient of detail.foodNutrients ?? []) {
    const name = getNutrientName(nutrient);
    const amount = nutrient.amount ?? 0;
    const unit = getNutrientUnit(nutrient);

    if (!name || !amount) {
      continue;
    }

    let matched = false;

    for (const [key, matchers] of Object.entries(nutrientMatchers)) {
      if (matchers.some((matcher) => matcher.test(name))) {
        record[key as Exclude<keyof NutritionRecord, "extra">] = amount;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const normalizedKey = normalizeText(name).replace(/\s+/g, "_");
      extra[normalizedKey] = {
        label: name,
        unit,
        value: amount,
      };
    }
  }

  const labelNutrients = detail.labelNutrients;
  if (labelNutrients) {
    record.calories = labelNutrients.calories?.value ?? record.calories;
    record.fat = labelNutrients.fat?.value ?? record.fat;
    record.saturatedFat = labelNutrients.saturatedFat?.value ?? record.saturatedFat;
    record.cholesterol = labelNutrients.cholesterol?.value ?? record.cholesterol;
    record.sodium = labelNutrients.sodium?.value ?? record.sodium;
    record.carbs = labelNutrients.carbohydrates?.value ?? record.carbs;
    record.fiber = labelNutrients.fiber?.value ?? record.fiber;
    record.sugar = labelNutrients.sugars?.value ?? record.sugar;
    record.protein = labelNutrients.protein?.value ?? record.protein;
    record.potassium = labelNutrients.potassium?.value ?? record.potassium;
  }

  record.extra = extra;
  return record;
}

function scoreUsdaSearchResult(result: UsdaSearchFood, query: string) {
  const normalizedQuery = normalizeText(query);
  const description = normalizeText(result.description);
  const tokens = normalizedQuery.split(" ");
  const tokenOverlap = tokens.filter((token) => description.includes(token)).length;

  let score = tokenOverlap * 12 + (result.score ?? 0);

  if (description === normalizedQuery) {
    score += 120;
  } else if (description.includes(normalizedQuery)) {
    score += 70;
  }

  if (result.dataType === "Foundation" || result.dataType === "SR Legacy") {
    score += 18;
  }

  if (result.dataType === "Branded" && /\bbrand|\bprotein|\bbar|\bchips|\bpack/i.test(query)) {
    score += 12;
  }

  return score;
}

function portionMatchScore(portion: UsdaFoodPortion, unit: string | null, query: string) {
  const haystack = normalizeText(
    [
      portion.portionDescription,
      portion.modifier,
      portion.measureUnit?.name,
      portion.measureUnit?.abbreviation,
    ]
      .filter(Boolean)
      .join(" "),
  );

  let score = 0;
  if (unit && haystack.includes(unit)) {
    score += 40;
  }

  const queryTokens = normalizeText(query).split(" ");
  score += queryTokens.filter((token) => haystack.includes(token)).length * 6;

  return score;
}

function resolvePortion(
  detail: UsdaFoodDetail,
  candidate: StructuredFoodCandidate,
) {
  const directMass = toMassInGrams(candidate.amount, candidate.unit);

  if (directMass) {
    return {
      grams: directMass,
      householdServingText: `${candidate.amount} ${candidate.unit}`,
    };
  }

  const normalizedUnit = normalizeUnit(candidate.unit);
  const portions = detail.foodPortions ?? [];
  const rankedPortion = portions
    .map((portion) => ({
      portion,
      score: portionMatchScore(portion, normalizedUnit, candidate.searchText),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (rankedPortion?.portion.gramWeight) {
    const amountBase = rankedPortion.portion.amount ?? 1;
    return {
      grams: (candidate.amount / amountBase) * rankedPortion.portion.gramWeight,
      householdServingText:
        rankedPortion.portion.portionDescription ??
        rankedPortion.portion.modifier ??
        detail.householdServingFullText ??
        null,
    };
  }

  if (detail.servingSize) {
    const normalizedServingUnit = normalizeUnit(detail.servingSizeUnit);
    const matchesServing =
      !normalizedUnit ||
      normalizedUnit === "serving" ||
      normalizedUnit === normalizedServingUnit;

    if (matchesServing) {
      return {
        grams: detail.servingSize * candidate.amount,
        householdServingText: detail.householdServingFullText ?? null,
      };
    }
  }

  return {
    grams: candidate.amount * 100,
    householdServingText: detail.householdServingFullText ?? "100 g",
  };
}

async function fetchUsdaFoodDetail(
  fdcId: number,
  apiKey: string,
): Promise<UsdaFoodDetail | null> {
  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`,
    {
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as UsdaFoodDetail;
}

export async function lookupUsdaFood(
  candidate: StructuredFoodCandidate,
): Promise<NutritionLookupResult | null> {
  const apiKey = process.env.USDA_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: candidate.searchText,
        pageSize: 6,
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"],
      }),
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { foods?: UsdaSearchFood[] };
  const foods = payload.foods ?? [];

  if (!foods.length) {
    return null;
  }

  const rankedResults = foods
    .map((food) => ({
      food,
      score: scoreUsdaSearchResult(food, candidate.searchText),
    }))
    .sort((left, right) => right.score - left.score);
  const top = rankedResults[0];
  const runnerUp = rankedResults[1];

  const detail = await fetchUsdaFoodDetail(top.food.fdcId, apiKey);

  if (!detail) {
    return null;
  }

  const baseRecord = extractNutritionRecord(detail);
  const portion = resolvePortion(detail, candidate);
  const isBranded = detail.dataType === "Branded";
  const multiplier =
    isBranded && detail.servingSize
      ? portion.grams / detail.servingSize
      : portion.grams / 100;
  const nutrients = scaleNutritionRecord(baseRecord, multiplier);
  const ambiguityDelta = top.score - (runnerUp?.score ?? 0);

  return {
    description: candidate.displayText,
    quantityText:
      candidate.quantityText === "1 serving"
        ? `${candidate.amount} serving (estimated)`
        : candidate.quantityText,
    amount: candidate.amount,
    unit: candidate.unit,
    servingGrams: Math.round(portion.grams),
    mealType: candidate.mealType,
    nutrients,
    source: {
      type: "USDA",
      name: "USDA FoodData Central",
      query: candidate.searchText,
      matchedDescription: detail.description,
      brandName: detail.brandOwner ?? null,
      externalId: String(detail.fdcId),
      confidence: Math.min(0.99, top.score / 140),
      householdServingText: portion.householdServingText,
      isAmbiguous: ambiguityDelta < 12,
      raw: {
        fdcId: detail.fdcId,
        description: detail.description,
        dataType: detail.dataType,
        brandOwner: detail.brandOwner,
        householdServingFullText: detail.householdServingFullText,
      },
    },
  };
}
