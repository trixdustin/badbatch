import { Prisma } from "@prisma/client";
import { ingredientUnitFactor, type IngredientUnit } from "@/lib/costing/units";

export function normalizeIngredientPurchase(input: {
  purchaseQuantity: number;
  purchaseUnit: IngredientUnit;
  purchaseCost: number;
}) {
  const purchaseQuantity = new Prisma.Decimal(String(input.purchaseQuantity)).toDecimalPlaces(3);
  const purchaseCost = new Prisma.Decimal(String(input.purchaseCost)).toDecimalPlaces(2);
  if (purchaseQuantity.lte(0) || purchaseCost.lte(0)) return null;

  const quantityInBaseUnits = purchaseQuantity.mul(ingredientUnitFactor(input.purchaseUnit));
  const costPerBaseUnit = purchaseCost.div(quantityInBaseUnits).toDecimalPlaces(8);
  if (costPerBaseUnit.lte(0) || costPerBaseUnit.gte(10000000000)) return null;
  return {
    purchaseQuantity: purchaseQuantity.toFixed(3),
    purchaseCost: purchaseCost.toFixed(2),
    costPerBaseUnit: costPerBaseUnit.toFixed(8),
  };
}
