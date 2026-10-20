import { areIngredientUnitsCompatible, ingredientUnitFactor, type IngredientUnit } from "@/lib/costing/units";

export type RecipeCostLine = {
  quantity: number;
  unit: IngredientUnit;
  costPerBaseUnit: number | null;
  ingredientUnit: IngredientUnit | null;
};

export type RecipeCostInput = {
  batchYield: number;
  packagingCostPerCookie: number;
  additionalDirectCostPerCookie: number;
  sellingPrice: number;
  ingredients: RecipeCostLine[];
};

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateRecipeCost(input: RecipeCostInput) {
  const hasCompleteIngredients =
    input.ingredients.length > 0 &&
    input.ingredients.every(
      (line) =>
        line.costPerBaseUnit !== null &&
        line.ingredientUnit !== null &&
        areIngredientUnitsCompatible(line.unit, line.ingredientUnit),
    );

  if (!hasCompleteIngredients || input.batchYield < 1) return null;

  const ingredientCostPerBatch = roundCurrency(
    input.ingredients.reduce((sum, line) => {
      const lineCost = line.quantity * ingredientUnitFactor(line.unit) * (line.costPerBaseUnit ?? 0);
      return sum + roundCurrency(lineCost);
    }, 0),
  );
  const ingredientCostPerCookie = roundCurrency(ingredientCostPerBatch / input.batchYield);
  const totalDirectCostPerBatch = roundCurrency(
    ingredientCostPerBatch +
      input.batchYield * input.packagingCostPerCookie +
      input.batchYield * input.additionalDirectCostPerCookie,
  );
  const totalDirectCostPerCookie = roundCurrency(totalDirectCostPerBatch / input.batchYield);
  const estimatedGrossProfitPerCookie = roundCurrency(input.sellingPrice - totalDirectCostPerCookie);
  const estimatedGrossMarginPercentage =
    input.sellingPrice > 0
      ? Math.round((estimatedGrossProfitPerCookie / input.sellingPrice) * 1000) / 10
      : null;

  return {
    ingredientCostPerBatch,
    ingredientCostPerCookie,
    totalDirectCostPerBatch,
    totalDirectCostPerCookie,
    estimatedGrossProfitPerCookie,
    estimatedGrossMarginPercentage,
  };
}
