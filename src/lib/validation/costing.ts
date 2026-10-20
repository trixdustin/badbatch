import { z } from "zod";
import { ingredientUnits } from "@/lib/costing/units";

export const ingredientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    purchaseQuantity: z.number().finite().gt(0).max(999999999.999),
    purchaseUnit: z.enum(ingredientUnits),
    purchaseCost: z.number().finite().gt(0).max(1000000000),
    supplier: z.string().trim().max(200).transform((value) => value || null),
    notes: z.string().trim().max(1000).transform((value) => value || null),
  })
  .strict();

const recipeLineSchema = z
  .object({
    ingredientId: z.string().min(1).max(64),
    quantity: z.number().finite().gt(0).max(999999999.999),
    unit: z.enum(ingredientUnits),
  })
  .strict();

export const recipeVersionSchema = z
  .object({
    batchYield: z.number().int().min(1).max(100000),
    cookieWeight: z.number().finite().gt(0).max(100000).nullable(),
    packagingCostPerCookie: z.number().finite().min(0).max(99999999.99),
    additionalDirectCostPerCookie: z.number().finite().min(0).max(99999999.99),
    ingredients: z.array(recipeLineSchema).min(1).max(100),
  })
  .strict()
  .superRefine((recipe, context) => {
    const ingredientIds = recipe.ingredients.map((line) => line.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      context.addIssue({
        code: "custom",
        path: ["ingredients"],
        message: "An ingredient can only appear once in a recipe version.",
      });
    }
  });

export const costingIdSchema = z.string().min(1).max(64);
