import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { ingredientUnitFactor, ingredientUnitFamily } from "@/lib/costing/units";
import { readJson } from "@/lib/http/read-json";
import { costingIdSchema, recipeVersionSchema } from "@/lib/validation/costing";

class RecipeCostOverflowError extends Error {}

export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/recipes/[productId]">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { productId } = await params;
  const validProductId = costingIdSchema.safeParse(productId);
  if (!validProductId.success) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const parsed = recipeVersionSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a complete recipe version.", issues: parsed.error.issues }, { status: 400 });
  }

  const quantities = parsed.data.ingredients.map((line) => ({
    ...line,
    quantity: new Prisma.Decimal(String(line.quantity)).toDecimalPlaces(3),
  }));
  if (quantities.some((line) => line.quantity.lte(0))) {
    return NextResponse.json({ error: "Ingredient quantities must remain positive at the stored precision." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: validProductId.data },
        select: { id: true, price: true },
      });
      if (!product) return { kind: "missing-product" as const };

      const ingredientIds = quantities.map((line) => line.ingredientId);
      const ingredients = await tx.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true, name: true, purchaseUnit: true, costPerBaseUnit: true },
      });
      if (ingredients.length !== ingredientIds.length) return { kind: "missing-ingredient" as const };

      const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
      for (const line of quantities) {
        const ingredient = ingredientById.get(line.ingredientId);
        if (!ingredient || ingredientUnitFamily(ingredient.purchaseUnit) !== ingredientUnitFamily(line.unit)) {
          return { kind: "incompatible-units" as const };
        }
      }

      const existingRecipe = await tx.productRecipe.findUnique({
        where: { productId: product.id },
        select: { id: true },
      });
      const recipe = existingRecipe ?? await tx.productRecipe.create({
        data: { productId: product.id },
        select: { id: true },
      });
      const latest = await tx.recipeVersion.findFirst({
        where: { recipeId: recipe.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const snapshotLines = [];
      for (const line of quantities) {
        const ingredient = ingredientById.get(line.ingredientId);
        if (!ingredient) throw new Error("Validated ingredient disappeared during recipe save.");
        const costPerBaseUnit = ingredient.costPerBaseUnit;
        const normalizedQuantity = line.quantity.mul(ingredientUnitFactor(line.unit));
        const ingredientCostSnapshot = costPerBaseUnit
          .mul(normalizedQuantity)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        if (ingredientCostSnapshot.gte(10000000000)) throw new RecipeCostOverflowError();
        snapshotLines.push({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantity: line.quantity.toFixed(3),
          unit: line.unit,
          costPerBaseUnitSnapshot: costPerBaseUnit.toFixed(8),
          ingredientCostSnapshot: ingredientCostSnapshot.toFixed(2),
        });
      }

      const cookieWeight = parsed.data.cookieWeight === null
        ? null
        : new Prisma.Decimal(String(parsed.data.cookieWeight)).toDecimalPlaces(3);
      const version = await tx.recipeVersion.create({
        data: {
          recipeId: recipe.id,
          version: (latest?.version ?? 0) + 1,
          batchYield: parsed.data.batchYield,
          sellingPriceSnapshot: product.price.toFixed(2),
          cookieWeight: cookieWeight?.toFixed(3) ?? null,
          packagingCostPerCookie: new Prisma.Decimal(String(parsed.data.packagingCostPerCookie)).toFixed(2),
          additionalDirectCostPerCookie: new Prisma.Decimal(String(parsed.data.additionalDirectCostPerCookie)).toFixed(2),
          ingredients: { create: snapshotLines },
        },
        select: { id: true, version: true },
      });
      return { kind: "saved" as const, version };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "missing-product") return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (result.kind === "missing-ingredient") return NextResponse.json({ error: "Choose existing ingredients for every recipe line." }, { status: 400 });
    if (result.kind === "incompatible-units") {
      return NextResponse.json({ error: "Recipe quantities must use units compatible with each ingredient's purchase unit. Grams convert to kilograms; milliliters convert to liters; units remain separate." }, { status: 400 });
    }
    return NextResponse.json(result.version, { status: 201 });
  } catch (error) {
    if (error instanceof RecipeCostOverflowError) {
      return NextResponse.json({ error: "An ingredient line cost exceeds the supported range. Check the quantity and price." }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      return NextResponse.json({ error: "Another recipe update was saved at the same time. Refresh and try again." }, { status: 409 });
    }
    console.error("Recipe version save failed.", error);
    return NextResponse.json({ error: "Could not save the recipe version." }, { status: 500 });
  }
}
