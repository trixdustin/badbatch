import { NextRequest, NextResponse } from "next/server";
import { InventoryReason, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { posSaleSchema } from "@/lib/validation/pos";
import { decrementStock, isStockTracked } from "@/lib/inventory/stock";
import { COOKIE_RETAIL_CENTS, COOKIE_SET_RULES, doubleTroublePrice } from "@/lib/storefront/sets";

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
        const productIds = items.flatMap((item) => item.productId ? [item.productId] : []);
        const needsSets = items.some((item) => item.setId);
        const settings = needsSets ? await tx.storeSettings.findUnique({ where: { id: "store" }, select: { seasonalProductId: true } }) : null;
        const products = await tx.product.findMany({
          where: { OR: [{ id: { in: productIds } }, ...(needsSets ? [{ slug: { in: ["the-classic", "the-dark", "the-third", "seasonal"] } }, ...(settings?.seasonalProductId ? [{ id: settings.seasonalProductId }] : [])] : [])] },
          select: { id: true, slug: true, name: true, price: true, isAvailable: true, stock: true },
        });
        const unavailableIds = productIds.filter((id) => !products.some((product) => product.id === id));
        if (unavailableIds.length > 0) {
          return { kind: "unavailable" as const };
        }

        const productsById = new Map(products.map((product) => [product.id, product]));
        const lineItems: { productId: string; quantity: number; price: Prisma.Decimal; setId?: string; setContents?: Prisma.InputJsonValue }[] = [];
        const stockNeeds = new Map<string, number>();
        let total = new Prisma.Decimal(0);

        for (const item of items) {
          if (item.productId) {
            const product = productsById.get(item.productId);
            if (!product || !product.isAvailable) return { kind: "unavailable" as const };
            if (product.price.lte(0)) return { kind: "prices" as const };
            stockNeeds.set(product.id, (stockNeeds.get(product.id) ?? 0) + item.quantity);
            lineItems.push({ productId: product.id, quantity: item.quantity, price: product.price });
            total = total.add(product.price.mul(item.quantity));
            continue;
          }
          const currentSeason = products.find((product) => product.id === settings?.seasonalProductId) ?? products.find((product) => product.slug === "seasonal");
          const contents = item.setId === "usual4" ? COOKIE_SET_RULES.usual4.contents : item.setId === "fullBatch" ? [...COOKIE_SET_RULES.fullBatch.contents.slice(0, 3), ...(currentSeason ? [{ slug: currentSeason.slug, quantity: 1 }] : [])] : item.flavorSlug ? [{ slug: item.flavorSlug, quantity: 2 }] : [];
          const retailCents = item.flavorSlug ? COOKIE_RETAIL_CENTS[item.flavorSlug] ?? (item.flavorSlug === currentSeason?.slug ? 8000 : undefined) : undefined;
          if (!item.setId || !contents.length || (item.setId === "doubleTrouble" && !retailCents)) return { kind: "invalid-set" as const };
          const components = contents.map((part) => products.find((product) => product.slug === part.slug));
          if (components.some((product) => !product || !product.isAvailable)) return { kind: "unavailable" as const };
          const priceCents = item.setId === "usual4" ? 26000 : item.setId === "fullBatch" ? 30000 : retailCents ? retailCents * 2 - 1000 : doubleTroublePrice(item.flavorSlug ?? "");
          if (!priceCents) return { kind: "invalid-set" as const };
          contents.forEach((part, index) => {
            const product = components[index]!;
            stockNeeds.set(product.id, (stockNeeds.get(product.id) ?? 0) + part.quantity * item.quantity);
          });
          lineItems.push({ productId: components[0]!.id, quantity: item.quantity, price: new Prisma.Decimal(priceCents).div(100), setId: item.setId, setContents: contents as unknown as Prisma.InputJsonValue });
          total = total.add(new Prisma.Decimal(priceCents).div(100).mul(item.quantity));
        }

        // Decrement each actual product once per transaction using its combined
        // component quantity. The corresponding ledger rows below only record
        // the same single deduction; they do not decrement stock again.
        for (const [productId, quantity] of stockNeeds) {
          const product = productsById.get(productId) ?? products.find((candidate) => candidate.id === productId);
          if (!product) return { kind: "unavailable" as const };
          if (isStockTracked(product.stock)) {
            const decremented = await decrementStock(tx, product.id, quantity);
            if (decremented !== 1) return { kind: "insufficient-stock" as const, productId };
          }
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

        for (const [productId, quantity] of stockNeeds) {
          await tx.inventoryAdjustment.create({
            data: {
              productId,
              change: -quantity,
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
    if (result.kind === "invalid-set") return NextResponse.json({ error: "Invalid cookie set.", code: "INVALID_SET" }, { status: 400 });
    return NextResponse.json({ id: result.sale.id }, { status: 201 });
  } catch (error) {
    console.error("POS sale creation failed.", error);
    return NextResponse.json({ error: "Could not record the sale." }, { status: 500 });
  }
}
