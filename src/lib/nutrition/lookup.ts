import { lookupFallbackFood } from "@/lib/nutrition/fallback-foods";
import {
  lookupOpenFoodFactsBarcode,
  lookupOpenFoodFactsProduct,
} from "@/lib/nutrition/open-food-facts";
import { lookupUsdaFood } from "@/lib/nutrition/usda";
import type { StructuredFoodCandidate } from "@/lib/parser/chat-command";
import type { NutritionLookupResult } from "@/types/nutrition";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCandidateVariant(
  candidate: StructuredFoodCandidate,
  searchText: string,
): StructuredFoodCandidate {
  return {
    ...candidate,
    searchText,
    displayText: candidate.displayText,
  };
}

function createSearchVariants(candidate: StructuredFoodCandidate) {
  const variants = new Set<string>();
  const base = normalizeText(candidate.searchText);
  const strippedContainer = base.replace(
    /^(glass|bottle|can|carton|jar|bag|packet|pouch|bar|cup|bowl|plate|order|side)\s+(of\s+)?/,
    "",
  );

  variants.add(candidate.searchText);

  if (strippedContainer && strippedContainer !== base) {
    variants.add(strippedContainer);
  }

  if (base.endsWith("s") && base.length > 4) {
    variants.add(base.slice(0, -1));
  }

  if (base.includes("tater tots")) {
    variants.add("tater tots");
    variants.add("potato puffs");
    variants.add("frozen tater tots");
  }

  if (base.includes("juice")) {
    variants.add("juice");
    variants.add("fruit juice");
    variants.add("orange juice");
  }

  if (base.includes("powdered peanut butter") || base.includes("pb health")) {
    variants.add("powdered peanut butter");
    variants.add("pb health powdered peanut butter");
    variants.add("pbfit powdered peanut butter");
  }

  return [...variants]
    .filter(Boolean)
    .map((searchText) => buildCandidateVariant(candidate, searchText));
}

function looksBrandedOrPackaged(searchText: string) {
  return /\b(protein|powder|powdered|bar|chips|cereal|cookies?|crackers?|soda|juice|yogurt|branded|peanut\s+butter|pb\s*health|pbfit|quest|kirkland|trader\s+joe|chipotle|starbucks)\b/i.test(
    searchText,
  );
}

async function firstResolved(
  candidates: StructuredFoodCandidate[],
  resolver: (candidate: StructuredFoodCandidate) => Promise<NutritionLookupResult | null>,
) {
  for (const candidate of candidates) {
    const result = await resolver(candidate);
    if (result) {
      return result;
    }
  }

  return null;
}

export async function lookupNutritionForCandidate(
  candidate: StructuredFoodCandidate,
): Promise<NutritionLookupResult | null> {
  const variants = createSearchVariants(candidate);
  const brandedFirst = looksBrandedOrPackaged(candidate.searchText);

  const barcodeResult = await lookupOpenFoodFactsBarcode(candidate);
  if (barcodeResult) {
    return barcodeResult;
  }

  if (brandedFirst) {
    const openFoodFactsProduct = await firstResolved(variants, lookupOpenFoodFactsProduct);
    if (openFoodFactsProduct) {
      return openFoodFactsProduct;
    }
  }

  const usdaResult = await firstResolved(variants, lookupUsdaFood);
  if (usdaResult) {
    return usdaResult;
  }

  const openFoodFactsProduct = await firstResolved(variants, lookupOpenFoodFactsProduct);
  if (openFoodFactsProduct) {
    return openFoodFactsProduct;
  }

  for (const variant of variants) {
    const fallbackResult = lookupFallbackFood(variant);
    if (fallbackResult) {
      return fallbackResult;
    }
  }

  return null;
}
