import { NextRequest, NextResponse } from "next/server";
import { InventoryReason, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { productIdSchema } from "@/lib/validation/product";
import { inventoryAdjustmentSchema } from "@/lib/validation/inventory";

export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/products/[id]/inventory">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const parsed = inventoryAdjustmentSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid inventory adjustment.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id } = await params;
  const validId = productIdSchema.safeParse(id);
  if (!validId.success || validId.data !== parsed.data.productId) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const { change, reason, note } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: validId.data },
          select: { id: true, stock: true },
        });
        if (!product) return { kind: "missing" as const };

        // First adjustment on an untracked product turns tracking on at 0,
        // then applies the signed change.
        const current = product.stock ?? 0;
        const next = current + change;
        if (next < 0) {
          return { kind: "negative" as const, current };
        }

        const updated = await tx.product.update({
          where: { id: validId.data },
          data: { stock: next },
          select: { id: true, name: true, slug: true, stock: true },
        });

        await tx.inventoryAdjustment.create({
          data: {
            productId: validId.data,
            change,
            reason: reason as InventoryReason,
            note,
            adminId: auth.admin.id,
          },
        });

        return { kind: "adjusted" as const, product: updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === "missing") {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (result.kind === "negative") {
      return NextResponse.json(
        {
          error: `That change would make stock negative (currently ${result.current}).`,
          code: "NEGATIVE_STOCK",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(result.product);
  } catch (error) {
    console.error("Admin inventory adjustment failed.", error);
    return NextResponse.json({ error: "Could not record the inventory adjustment." }, { status: 500 });
  }
}
