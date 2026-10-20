import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { ingredientUnitFamily } from "@/lib/costing/units";
import { normalizeIngredientPurchase } from "@/lib/costing/pricing";
import { costingIdSchema, ingredientSchema } from "@/lib/validation/costing";

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/ingredients/[id]">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await params;
  const validId = costingIdSchema.safeParse(id);
  if (!validId.success) return NextResponse.json({ error: "Ingredient not found." }, { status: 404 });

  const parsed = ingredientSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter valid ingredient details.", issues: parsed.error.issues }, { status: 400 });
  }

  const normalized = normalizeIngredientPurchase(parsed.data);
  if (!normalized) {
    return NextResponse.json({ error: "Purchase quantity and cost must remain positive at the stored precision." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.ingredient.findUnique({
        where: { id: validId.data },
        select: { id: true, purchaseUnit: true },
      });
      if (!existing) return { kind: "missing" as const };

      if (ingredientUnitFamily(existing.purchaseUnit) !== ingredientUnitFamily(parsed.data.purchaseUnit)) {
        const recipeUseCount = await tx.recipeVersionIngredient.count({ where: { ingredientId: existing.id } });
        if (recipeUseCount > 0) return { kind: "unit-family-in-use" as const };
      }

      const updated = await tx.ingredient.update({
        where: { id: validId.data },
        data: { ...parsed.data, ...normalized },
        select: { id: true },
      });
      return { kind: "updated" as const, ingredient: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "missing") return NextResponse.json({ error: "Ingredient not found." }, { status: 404 });
    if (result.kind === "unit-family-in-use") {
      return NextResponse.json({ error: "This ingredient is used by a saved recipe; its unit family cannot change. Create a separate ingredient for a different measure." }, { status: 409 });
    }
    return NextResponse.json(result.ingredient);
  } catch (error) {
    console.error("Ingredient update failed.", error);
    return NextResponse.json({ error: "Could not update the ingredient." }, { status: 500 });
  }
}
