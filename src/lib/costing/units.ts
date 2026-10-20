export const ingredientUnits = ["GRAM", "KILOGRAM", "MILLILITER", "LITER", "UNIT"] as const;

export type IngredientUnit = (typeof ingredientUnits)[number];
export type IngredientUnitFamily = "MASS" | "VOLUME" | "COUNT";

const unitDetails: Record<IngredientUnit, { family: IngredientUnitFamily; factor: number; label: string; base: string }> = {
  GRAM: { family: "MASS", factor: 1, label: "gram (g)", base: "g" },
  KILOGRAM: { family: "MASS", factor: 1000, label: "kilogram (kg)", base: "g" },
  MILLILITER: { family: "VOLUME", factor: 1, label: "milliliter (mL)", base: "mL" },
  LITER: { family: "VOLUME", factor: 1000, label: "liter (L)", base: "mL" },
  UNIT: { family: "COUNT", factor: 1, label: "unit", base: "unit" },
};

export function ingredientUnitDetails(unit: IngredientUnit) {
  return unitDetails[unit];
}

export function ingredientUnitFamily(unit: IngredientUnit): IngredientUnitFamily {
  return unitDetails[unit].family;
}

export function ingredientUnitFactor(unit: IngredientUnit): number {
  return unitDetails[unit].factor;
}

export function areIngredientUnitsCompatible(left: IngredientUnit, right: IngredientUnit): boolean {
  return ingredientUnitFamily(left) === ingredientUnitFamily(right);
}
