import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { normalizeIngredientPurchase } from "@/lib/costing/pricing";
import { ingredientSchema } from "@/lib/validation/costing";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const parsed = ingredientSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter valid ingredient details.", issues: parsed.error.issues }, { status: 400 });
  }

  const normalized = normalizeIngredientPurchase(parsed.data);
  if (!normalized) {
    return NextResponse.json({ error: "Purchase quantity and cost must remain positive at the stored precision." }, { status: 400 });
  }

  try {
    const ingredient = await prisma.ingredient.create({
      data: {
        ...parsed.data,
        ...normalized,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: ingredient.id }, { status: 201 });
  } catch (error) {
    console.error("Ingredient creation failed.", error);
    return NextResponse.json({ error: "Could not save the ingredient." }, { status: 500 });
  }
}
