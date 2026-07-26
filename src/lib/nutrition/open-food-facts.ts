import type { StructuredFoodCandidate } from "@/lib/parser/chat-command";
import type { NutritionLookupResult } from "@/types/nutrition";

interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_quantity?: number;
  serving_quantity_unit?: string;
  serving_size?: string;
  nutriments?: Record<string, number>;
}

interface OpenFoodFactsProductResponse {
  product?: OpenFoodFactsProduct;
}

interface OpenFoodFactsSearchResponse {
  products?: OpenFoodFactsProduct[];
}

function getBaseUrl() {
  return (
    process.env.OPEN_FOOD_FACTS_BASE_URL ?? "https://world.openfoodfacts.org"
  ).replace(/\/$/, "");
}

function isLikelyBarcode(input: string) {
  return /^\d{8,14}$/.test(input.trim());
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(unit: string | null | undefined) {
  if (!unit) {
    return null;
  }

  const normalized = unit.toLowerCase().trim();

  if (["grams", "gram"].includes(normalized)) {
    return "g";
  }

  if (["ounces", "ounce"].includes(normalized)) {
    return "oz";
  }

  if (["pounds", "pound", "lbs"].includes(normalized)) {
    return "lb";
  }

  if (["milliliters", "milliliter"].includes(normalized)) {
    return "ml";
  }

  return normalized.endsWith("s") && normalized.length > 2
    ? normalized.slice(0, -1)
    : normalized;
}

function toMassInGrams(amount: number, unit: string | null | undefined) {
  const normalized = normalizeUnit(unit);

  if (!normalized) {
    return null;
  }

  if (normalized === "g") {
    return amount;
  }

  if (normalized === "oz") {
    return amount * 28.3495;
  }

  if (normalized === "lb") {
    return amount * 453.592;
  }

  return null;
}

function getServingQuantity(product: OpenFoodFactsProduct) {
  return typeof product.serving_quantity === "number" && Number.isFinite(product.serving_quantity)
    ? product.serving_quantity
    : null;
}

function getPerServingValue(nutriments: Record<string, number>, key: string) {
  return toNumber(nutriments[`${key}_serving`]);
}

function getPer100gValue(nutriments: Record<string, number>, key: string) {
  return toNumber(nutriments[`${key}_100g`]);
}

function buildQuantityText(candidate: StructuredFoodCandidate, product: OpenFoodFactsProduct) {
  if (candidate.quantityText && candidate.quantityText !== "1 serving") {
    return candidate.quantityText;
  }

  const unit = candidate.unit ?? normalizeUnit(product.serving_quantity_unit) ?? "serving";
  return `${candidate.amount || 1} ${unit}`;
}

function buildServingMetadata(
  product: OpenFoodFactsProduct,
  candidate: StructuredFoodCandidate,
  nutriments: Record<string, number>,
) {
  const servingQuantity = getServingQuantity(product);
  const directMass = toMassInGrams(candidate.amount, candidate.unit);
  const hasServingNutrition =
    getPerServingValue(nutriments, "energy-kcal") > 0 ||
    getPerServingValue(nutriments, "proteins") > 0 ||
    getPerServingValue(nutriments, "carbohydrates") > 0 ||
    getPerServingValue(nutriments, "fat") > 0;

  if (hasServingNutrition) {
    return {
      multiplier: candidate.amount || 1,
      servingGrams: servingQuantity ? Math.round(servingQuantity * (candidate.amount || 1)) : null,
    };
  }

  if (directMass) {
    return {
      multiplier: directMass / 100,
      servingGrams: Math.round(directMass),
    };
  }

  if (servingQuantity) {
    return {
      multiplier: (servingQuantity / 100) * (candidate.amount || 1),
      servingGrams: Math.round(servingQuantity * (candidate.amount || 1)),
    };
  }

  return {
    multiplier: candidate.amount || 1,
    servingGrams: null,
  };
}

function buildOpenFoodFactsResult(
  product: OpenFoodFactsProduct,
  candidate: StructuredFoodCandidate,
  query: string,
  confidence: number,
): NutritionLookupResult | null {
  if (!product.product_name || !product.nutriments) {
    return null;
  }

  const nutriments = product.nutriments;
  const { multiplier, servingGrams } = buildServingMetadata(product, candidate, nutriments);

  const nutrients = {
    calories:
      (getPerServingValue(nutriments, "energy-kcal") ||
        getPer100gValue(nutriments, "energy-kcal")) * multiplier,
    protein:
      (getPerServingValue(nutriments, "proteins") ||
        getPer100gValue(nutriments, "proteins")) * multiplier,
    carbs:
      (getPerServingValue(nutriments, "carbohydrates") ||
        getPer100gValue(nutriments, "carbohydrates")) * multiplier,
    fat:
      (getPerServingValue(nutriments, "fat") ||
        getPer100gValue(nutriments, "fat")) * multiplier,
    fiber:
      (getPerServingValue(nutriments, "fiber") ||
        getPer100gValue(nutriments, "fiber")) * multiplier,
    sugar:
      (getPerServingValue(nutriments, "sugars") ||
        getPer100gValue(nutriments, "sugars")) * multiplier,
    sodium:
      (getPerServingValue(nutriments, "sodium") ||
        getPer100gValue(nutriments, "sodium")) *
      1000 *
      multiplier,
    cholesterol:
      (getPerServingValue(nutriments, "cholesterol") ||
        getPer100gValue(nutriments, "cholesterol")) * multiplier,
    saturatedFat:
      (getPerServingValue(nutriments, "saturated-fat") ||
        getPer100gValue(nutriments, "saturated-fat")) * multiplier,
    potassium:
      (getPerServingValue(nutriments, "potassium") ||
        getPer100gValue(nutriments, "potassium")) * multiplier,
    calcium:
      (getPerServingValue(nutriments, "calcium") ||
        getPer100gValue(nutriments, "calcium")) * multiplier,
    iron:
      (getPerServingValue(nutriments, "iron") ||
        getPer100gValue(nutriments, "iron")) * multiplier,
    magnesium:
      (getPerServingValue(nutriments, "magnesium") ||
        getPer100gValue(nutriments, "magnesium")) * multiplier,
    vitaminA:
      (getPerServingValue(nutriments, "vitamin-a") ||
        getPer100gValue(nutriments, "vitamin-a")) * multiplier,
    vitaminC:
      (getPerServingValue(nutriments, "vitamin-c") ||
        getPer100gValue(nutriments, "vitamin-c")) * multiplier,
    vitaminD:
      (getPerServingValue(nutriments, "vitamin-d") ||
        getPer100gValue(nutriments, "vitamin-d")) * multiplier,
    vitaminB12:
      (getPerServingValue(nutriments, "vitamin-b12") ||
        getPer100gValue(nutriments, "vitamin-b12")) * multiplier,
    extra: {},
  };

  if (
    nutrients.calories <= 0 &&
    nutrients.protein <= 0 &&
    nutrients.carbs <= 0 &&
    nutrients.fat <= 0
  ) {
    return null;
  }

  return {
    description: candidate.displayText,
    quantityText: buildQuantityText(candidate, product),
    amount: candidate.amount,
    unit: candidate.unit ?? normalizeUnit(product.serving_quantity_unit),
    servingGrams,
    mealType: candidate.mealType,
    nutrients,
    source: {
      type: "OPEN_FOOD_FACTS",
      name: "Open Food Facts",
      query,
      matchedDescription: product.product_name,
      brandName: product.brands ?? null,
      externalId: product.code ?? null,
      confidence,
      householdServingText:
        product.serving_size ??
        (getServingQuantity(product)
          ? `${getServingQuantity(product)} ${product.serving_quantity_unit ?? "g"}`
          : null),
      isAmbiguous: confidence < 0.82,
      raw: {
        code: product.code,
        product_name: product.product_name,
        brands: product.brands,
        serving_size: product.serving_size,
      },
    },
  };
}

function scoreProductMatch(product: OpenFoodFactsProduct, query: string) {
  const normalizedQuery = normalizeText(query);
  const name = normalizeText(product.product_name ?? "");
  const brand = normalizeText(product.brands ?? "");
  const haystack = `${name} ${brand}`.trim();
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  let score = 0;
  if (name === normalizedQuery) {
    score += 140;
  } else if (haystack.includes(normalizedQuery)) {
    score += 90;
  }

  score += tokens.filter((token) => haystack.includes(token)).length * 16;

  if (brand && tokens.some((token) => brand.includes(token))) {
    score += 18;
  }

  if (product.nutriments) {
    score += 12;
  }

  if (getServingQuantity(product)) {
    score += 6;
  }

  return score;
}

async function searchOpenFoodFactsProducts(query: string) {
  const baseUrl = getBaseUrl();
  const response = await fetch(
    `${baseUrl}/cgi/search.pl?search_terms=${encodeURIComponent(
      query,
    )}&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,brands,serving_quantity,serving_quantity_unit,serving_size,nutriments`,
    {
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as OpenFoodFactsSearchResponse;
  return payload.products ?? [];
}

export async function lookupOpenFoodFactsBarcode(
  candidate: StructuredFoodCandidate,
): Promise<NutritionLookupResult | null> {
  if (!isLikelyBarcode(candidate.searchText)) {
    return null;
  }

  const response = await fetch(
    `${getBaseUrl()}/api/v2/product/${candidate.searchText}.json?fields=code,product_name,brands,serving_quantity,serving_quantity_unit,serving_size,nutriments`,
    {
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OpenFoodFactsProductResponse;
  return payload.product
    ? buildOpenFoodFactsResult(payload.product, candidate, candidate.searchText, 0.95)
    : null;
}

export async function lookupOpenFoodFactsProduct(
  candidate: StructuredFoodCandidate,
): Promise<NutritionLookupResult | null> {
  const products = await searchOpenFoodFactsProducts(candidate.searchText);

  if (!products.length) {
    return null;
  }

  const ranked = products
    .map((product) => ({
      product,
      score: scoreProductMatch(product, candidate.searchText),
    }))
    .sort((left, right) => right.score - left.score);

  const top = ranked[0];

  if (!top || top.score < 22) {
    return null;
  }

  return buildOpenFoodFactsResult(
    top.product,
    candidate,
    candidate.searchText,
    Math.min(0.96, top.score / 120),
  );
}
