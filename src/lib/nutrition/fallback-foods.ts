import type { StructuredFoodCandidate } from "@/lib/parser/chat-command";
import { scaleNutritionRecord } from "@/lib/nutrition/helpers";
import type { NutritionLookupResult, NutritionRecord } from "@/types/nutrition";

interface FallbackFood {
  id: string;
  name: string;
  aliases: string[];
  servingAmount: number;
  servingUnit: string;
  servingGrams: number;
  unitFactors: Record<string, number>;
  nutrients: NutritionRecord;
}

function makeRecord(values: Omit<NutritionRecord, "extra">): NutritionRecord {
  return {
    ...values,
    extra: {},
  };
}

const catalog: FallbackFood[] = [
  {
    id: "egg",
    name: "Egg, whole, large",
    aliases: ["egg", "eggs", "whole egg", "whole eggs"],
    servingAmount: 1,
    servingUnit: "egg",
    servingGrams: 50,
    unitFactors: { egg: 1, serving: 1 },
    nutrients: makeRecord({
      calories: 72,
      protein: 6.3,
      carbs: 0.4,
      fat: 4.8,
      fiber: 0,
      sugar: 0.2,
      sodium: 71,
      cholesterol: 186,
      saturatedFat: 1.6,
      potassium: 69,
      calcium: 28,
      iron: 0.9,
      magnesium: 6,
      vitaminA: 80,
      vitaminC: 0,
      vitaminD: 1.1,
      vitaminB12: 0.5,
    }),
  },
  {
    id: "toast",
    name: "Whole wheat toast",
    aliases: ["toast", "slice toast", "bread", "whole wheat toast"],
    servingAmount: 1,
    servingUnit: "slice",
    servingGrams: 31,
    unitFactors: { slice: 1, serving: 1 },
    nutrients: makeRecord({
      calories: 81,
      protein: 4,
      carbs: 13.8,
      fat: 1.1,
      fiber: 1.9,
      sugar: 1.4,
      sodium: 144,
      cholesterol: 0,
      saturatedFat: 0.2,
      potassium: 62,
      calcium: 40,
      iron: 0.9,
      magnesium: 23,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "banana",
    name: "Banana, medium",
    aliases: ["banana", "bananas"],
    servingAmount: 1,
    servingUnit: "banana",
    servingGrams: 118,
    unitFactors: { banana: 1, serving: 1 },
    nutrients: makeRecord({
      calories: 105,
      protein: 1.3,
      carbs: 27,
      fat: 0.4,
      fiber: 3.1,
      sugar: 14.4,
      sodium: 1,
      cholesterol: 0,
      saturatedFat: 0.1,
      potassium: 422,
      calcium: 6,
      iron: 0.3,
      magnesium: 32,
      vitaminA: 4,
      vitaminC: 10.3,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "chicken-breast",
    name: "Chicken breast, cooked",
    aliases: ["chicken", "chicken breast", "grilled chicken", "chipotle chicken"],
    servingAmount: 4,
    servingUnit: "oz",
    servingGrams: 113,
    unitFactors: { oz: 0.25, serving: 1 },
    nutrients: makeRecord({
      calories: 187,
      protein: 35,
      carbs: 0,
      fat: 4,
      fiber: 0,
      sugar: 0,
      sodium: 120,
      cholesterol: 104,
      saturatedFat: 1.1,
      potassium: 331,
      calcium: 15,
      iron: 0.9,
      magnesium: 32,
      vitaminA: 11,
      vitaminC: 0,
      vitaminD: 0.1,
      vitaminB12: 0.3,
    }),
  },
  {
    id: "white-rice",
    name: "White rice, cooked",
    aliases: ["white rice", "rice", "jasmine rice"],
    servingAmount: 1,
    servingUnit: "cup",
    servingGrams: 158,
    unitFactors: { cup: 1, serving: 1 },
    nutrients: makeRecord({
      calories: 205,
      protein: 4.3,
      carbs: 44.5,
      fat: 0.4,
      fiber: 0.6,
      sugar: 0.1,
      sodium: 2,
      cholesterol: 0,
      saturatedFat: 0.1,
      potassium: 55,
      calcium: 16,
      iron: 1.9,
      magnesium: 19,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "black-beans",
    name: "Black beans, cooked",
    aliases: ["black beans", "beans"],
    servingAmount: 0.5,
    servingUnit: "cup",
    servingGrams: 86,
    unitFactors: { cup: 2, serving: 1 },
    nutrients: makeRecord({
      calories: 114,
      protein: 7.6,
      carbs: 20.4,
      fat: 0.5,
      fiber: 7.5,
      sugar: 0.3,
      sodium: 1,
      cholesterol: 0,
      saturatedFat: 0.1,
      potassium: 305,
      calcium: 23,
      iron: 1.8,
      magnesium: 60,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "oatmeal",
    name: "Oatmeal, cooked",
    aliases: ["oatmeal", "oats"],
    servingAmount: 1,
    servingUnit: "cup",
    servingGrams: 234,
    unitFactors: { cup: 1, serving: 1 },
    nutrients: makeRecord({
      calories: 154,
      protein: 5.4,
      carbs: 27.4,
      fat: 2.6,
      fiber: 4,
      sugar: 1.1,
      sodium: 2,
      cholesterol: 0,
      saturatedFat: 0.5,
      potassium: 164,
      calcium: 21,
      iron: 2.1,
      magnesium: 63,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "greek-yogurt",
    name: "Greek yogurt, plain",
    aliases: ["greek yogurt", "yogurt", "plain greek yogurt"],
    servingAmount: 1,
    servingUnit: "cup",
    servingGrams: 245,
    unitFactors: { cup: 1, serving: 1, container: 1, package: 1 },
    nutrients: makeRecord({
      calories: 149,
      protein: 20,
      carbs: 8,
      fat: 4,
      fiber: 0,
      sugar: 7,
      sodium: 65,
      cholesterol: 15,
      saturatedFat: 2.6,
      potassium: 240,
      calcium: 220,
      iron: 0.1,
      magnesium: 19,
      vitaminA: 27,
      vitaminC: 0,
      vitaminD: 0.1,
      vitaminB12: 1.3,
    }),
  },
  {
    id: "salmon",
    name: "Salmon, cooked",
    aliases: ["salmon"],
    servingAmount: 4,
    servingUnit: "oz",
    servingGrams: 113,
    unitFactors: { oz: 0.25, serving: 1 },
    nutrients: makeRecord({
      calories: 233,
      protein: 25.2,
      carbs: 0,
      fat: 14,
      fiber: 0,
      sugar: 0,
      sodium: 75,
      cholesterol: 71,
      saturatedFat: 3.2,
      potassium: 372,
      calcium: 12,
      iron: 0.7,
      magnesium: 30,
      vitaminA: 25,
      vitaminC: 0,
      vitaminD: 11.1,
      vitaminB12: 3.9,
    }),
  },
  {
    id: "avocado",
    name: "Avocado",
    aliases: ["avocado", "half avocado"],
    servingAmount: 0.5,
    servingUnit: "serving",
    servingGrams: 68,
    unitFactors: { serving: 1, avocado: 2 },
    nutrients: makeRecord({
      calories: 120,
      protein: 1.5,
      carbs: 6.4,
      fat: 10.9,
      fiber: 5,
      sugar: 0.2,
      sodium: 5,
      cholesterol: 0,
      saturatedFat: 1.6,
      potassium: 364,
      calcium: 10,
      iron: 0.3,
      magnesium: 29,
      vitaminA: 7,
      vitaminC: 10,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "peanut-butter",
    name: "Peanut butter",
    aliases: ["peanut butter"],
    servingAmount: 2,
    servingUnit: "tbsp",
    servingGrams: 32,
    unitFactors: { tbsp: 0.5, serving: 1 },
    nutrients: makeRecord({
      calories: 188,
      protein: 8,
      carbs: 6.8,
      fat: 16,
      fiber: 2.6,
      sugar: 3.2,
      sodium: 147,
      cholesterol: 0,
      saturatedFat: 3.3,
      potassium: 208,
      calcium: 17,
      iron: 0.6,
      magnesium: 57,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "powdered-peanut-butter",
    name: "Powdered peanut butter",
    aliases: [
      "powdered peanut butter",
      "peanut butter powder",
      "pbfit",
      "pbfit powdered peanut butter",
      "pb health powdered peanut butter",
      "pb health",
    ],
    servingAmount: 2,
    servingUnit: "tbsp",
    servingGrams: 13,
    unitFactors: { tbsp: 0.5, serving: 1 },
    nutrients: makeRecord({
      calories: 60,
      protein: 8,
      carbs: 5,
      fat: 1.5,
      fiber: 2,
      sugar: 2,
      sodium: 85,
      cholesterol: 0,
      saturatedFat: 0.3,
      potassium: 170,
      calcium: 18,
      iron: 0.5,
      magnesium: 28,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "tater-tots",
    name: "Tater tots",
    aliases: ["tater tots", "tater tot", "potato puffs", "frozen tater tots"],
    servingAmount: 10,
    servingUnit: "piece",
    servingGrams: 86,
    unitFactors: { piece: 0.1, tot: 0.1, serving: 1 },
    nutrients: makeRecord({
      calories: 160,
      protein: 2,
      carbs: 20,
      fat: 8,
      fiber: 2,
      sugar: 1,
      sodium: 420,
      cholesterol: 0,
      saturatedFat: 1.2,
      potassium: 320,
      calcium: 12,
      iron: 0.7,
      magnesium: 18,
      vitaminA: 0,
      vitaminC: 3,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
  {
    id: "orange-juice",
    name: "Orange juice",
    aliases: ["orange juice", "juice", "fruit juice", "glass of juice"],
    servingAmount: 1,
    servingUnit: "glass",
    servingGrams: 248,
    unitFactors: { glass: 1, cup: 1, bottle: 1, serving: 1 },
    nutrients: makeRecord({
      calories: 112,
      protein: 1.7,
      carbs: 26,
      fat: 0.5,
      fiber: 0.5,
      sugar: 21,
      sodium: 2,
      cholesterol: 0,
      saturatedFat: 0.1,
      potassium: 496,
      calcium: 27,
      iron: 0.5,
      magnesium: 27,
      vitaminA: 25,
      vitaminC: 124,
      vitaminD: 0,
      vitaminB12: 0,
    }),
  },
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function findFallbackFood(searchText: string) {
  const normalizedSearch = normalizeText(searchText);

  return catalog
    .map((food) => {
      let score = 0;
      const haystack = [food.name, ...food.aliases].map(normalizeText);

      for (const alias of haystack) {
        if (alias === normalizedSearch) {
          score += 120;
        } else if (alias.includes(normalizedSearch) || normalizedSearch.includes(alias)) {
          score += 50;
        }

        const tokenOverlap = normalizedSearch
          .split(" ")
          .filter((token) => alias.includes(token)).length;

        score += tokenOverlap * 12;
      }

      return {
        food,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)[0];
}

function inferUnitKey(
  food: FallbackFood,
  candidate: StructuredFoodCandidate,
) {
  if (candidate.unit && food.unitFactors[candidate.unit] !== undefined) {
    return candidate.unit;
  }

  const normalizedSearch = normalizeText(candidate.searchText);
  const tokens = normalizedSearch.split(" ").filter(Boolean);
  const lastToken = tokens[tokens.length - 1];
  const singularLastToken =
    lastToken && lastToken.endsWith("s") ? lastToken.slice(0, -1) : lastToken;

  if (lastToken && food.unitFactors[lastToken] !== undefined) {
    return lastToken;
  }

  if (singularLastToken && food.unitFactors[singularLastToken] !== undefined) {
    return singularLastToken;
  }

  return null;
}

export function lookupFallbackFood(
  candidate: StructuredFoodCandidate,
): NutritionLookupResult | null {
  const ranked = findFallbackFood(candidate.searchText);

  if (!ranked || ranked.score < 24) {
    return null;
  }

  const { food } = ranked;
  const unitKey = inferUnitKey(food, candidate) ?? "serving";
  const factor =
    food.unitFactors[unitKey] ??
    (candidate.unit === null && candidate.amount ? candidate.amount : 1);
  const quantityFactor =
    unitKey === "serving" && candidate.unit === null ? candidate.amount : candidate.amount * factor;
  const nutrients = scaleNutritionRecord(food.nutrients, quantityFactor);

  return {
    description: candidate.displayText,
    quantityText:
      candidate.isEstimatedQuantity && candidate.quantityText === "1 serving"
        ? `1 ${food.servingUnit} (estimated)`
        : candidate.quantityText,
    amount: candidate.amount,
    unit: candidate.unit,
    servingGrams: Math.round(food.servingGrams * quantityFactor),
    mealType: candidate.mealType,
    nutrients,
    source: {
      type: "FALLBACK",
      name: "Curated fallback library",
      query: candidate.searchText,
      matchedDescription: food.name,
      confidence: Math.min(0.98, ranked.score / 120),
      householdServingText: `${food.servingAmount} ${food.servingUnit}`,
      isAmbiguous: ranked.score < 60,
      raw: {
        fallbackId: food.id,
        aliases: food.aliases,
      },
    },
  };
}
