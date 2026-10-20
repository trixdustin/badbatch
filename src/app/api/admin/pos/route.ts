import { NextRequest, NextResponse } from "next/server";
import { InventoryReason, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { posSaleSchema } from "@/lib/validation/pos";
import { decrementStock, isStockTracked } from "@/lib/inventory/stock";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const parsed = posSaleSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sale.", issues: parsed.error.issues }, { status: 400 });
  }

  const { items, paymentMethod, note } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const products = await tx.product.findMany({
          where: { id: { in: items.map((item) => item.productId) } },
          select: { id: true, price: true, isAvailable: true, stock: true },
        });
        if (products.length !== items.length) {
          return { kind: "unavailable" as const };
        }

        const productsById = new Map(products.map((product) => [product.id, product]));
        const lineItems: { productId: string; quantity: number; price: Prisma.Decimal }[] = [];
        let total = new Prisma.Decimal(0);

        for (const item of items) {
          const product = productsById.get(item.productId);
          if (!product) return { kind: "unavailable" as const };
          if (!product.isAvailable) return { kind: "unavailable" as const };
          if (product.price.lte(0)) return { kind: "prices" as const };

          // Only tracked products affect stock. Untracked (null) stock is sold
          // without a stock check, preserving backward-compatible behavior.
          if (isStockTracked(product.stock)) {
            const decremented = await decrementStock(tx, product.id, item.quantity);
            if (decremented !== 1) return { kind: "insufficient-stock" as const, productId: product.id };
          }

          lineItems.push({ productId: product.id, quantity: item.quantity, price: product.price });
          total = total.add(product.price.mul(item.quantity));
        }

        const sale = await tx.posSale.create({
          data: {
            total,
            paymentMethod: paymentMethod as PaymentMethod,
            adminId: auth.admin.id,
            items: { create: lineItems },
          },
          select: { id: true },
        });

        for (const line of lineItems) {
          await tx.inventoryAdjustment.create({
            data: {
              productId: line.productId,
              change: -line.quantity,
              reason: InventoryReason.SALE,
              note: note || `POS sale ${sale.id}`,
              adminId: auth.admin.id,
            },
          });
        }

        return { kind: "created" as const, sale };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === "unavailable") {
      return NextResponse.json(
        { error: "One or more products are no longer available.", code: "PRODUCT_UNAVAILABLE" },
        { status: 409 },
      );
    }
    if (result.kind === "prices") {
      return NextResponse.json(
        { error: "One or more products still have an unconfirmed price.", code: "PRICE_UNAVAILABLE" },
        { status: 409 },
      );
    }
    if (result.kind === "insufficient-stock") {
      return NextResponse.json(
        { error: "Not enough stock for one of the items. Refresh and try again.", code: "INSUFFICIENT_STOCK" },
        { status: 409 },
      );
    }
    return NextResponse.json({ id: result.sale.id }, { status: 201 });
  } catch (error) {
    console.error("POS sale creation failed.", error);
    return NextResponse.json({ error: "Could not record the sale." }, { status: 500 });
  }
}
