import { NextRequest, NextResponse } from "next/server";
import { InventoryReason, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { checkoutSchema } from "@/lib/validation/checkout";
import { readJson } from "@/lib/http/read-json";
import { UNCONFIRMED_FULFILLMENT } from "@/lib/orders/fulfillment";
import { decrementStock, isStockTracked } from "@/lib/inventory/stock";
import {
  assertOrderConfirmationConfigured,
  createOrderConfirmationToken,
} from "@/lib/auth/order-confirmation";
import { sendOrderReceivedEmail } from "@/lib/email/notifications";
import { COOKIE_RETAIL_CENTS, COOKIE_SET_RULES, doubleTroublePrice } from "@/lib/storefront/sets";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout details.", issues: parsed.error.issues }, { status: 400 });
  }
  assertOrderConfirmationConfigured();
  const result = await prisma.$transaction(
    async (transaction) => {
      const settings = await transaction.storeSettings.findUnique({
        where: { id: "store" },
        select: { orderingEnabled: true, seasonalProductId: true },
      });
      if (!settings?.orderingEnabled) return { kind: "closed" as const };

      const productIds = parsed.data.items.flatMap((item) => item.productId ? [item.productId] : []);
      const needsSets = parsed.data.items.some((item) => item.setId);
      const products = await transaction.product.findMany({
        where: {
          OR: [
            { id: { in: productIds } },
            ...(needsSets ? [{ slug: { in: ["the-classic", "the-dark", "the-third", "seasonal"] } }, ...(settings.seasonalProductId ? [{ id: settings.seasonalProductId }] : [])] : []),
          ],
          isAvailable: true,
        },
        select: { id: true, name: true, slug: true, price: true, stock: true },
      });
      if (products.length < productIds.length) {
        return { kind: "unavailable" as const };
      }
      if (products.some((product) => productIds.includes(product.id) && product.price.lte(0))) {
        return { kind: "prices" as const };
      }

      const productsById = new Map(products.map((product) => [product.id, product]));

      // Deduct tracked stock atomically before committing the order. Untracked
      // products (stock === null) are sold without a stock check. Because this
      // runs inside the Serializable transaction, concurrent checkouts cannot
      // oversell; a failed decrement rolls the whole order back.
      const lineItems: { productId: string; quantity: number; price: Prisma.Decimal; setId?: string; setContents?: Prisma.InputJsonValue }[] = [];
      const stockNeeds = new Map<string, number>();
      for (const item of parsed.data.items) {
        if (item.productId) {
          const product = productsById.get(item.productId);
          if (!product) return { kind: "unavailable" as const };
          stockNeeds.set(product.id, (stockNeeds.get(product.id) ?? 0) + item.quantity);
          lineItems.push({ productId: product.id, quantity: item.quantity, price: product.price });
          continue;
        }
        const setId = item.setId;
        const currentSeason = products.find((product) => product.id === settings.seasonalProductId) ?? products.find((product) => product.slug === "seasonal");
        const contents = setId === "usual4" ? COOKIE_SET_RULES.usual4.contents : setId === "fullBatch" ? [...COOKIE_SET_RULES.fullBatch.contents.slice(0, 3), ...(currentSeason ? [{ slug: currentSeason.slug, quantity: 1 }] : [])] : item.flavorSlug ? [{ slug: item.flavorSlug, quantity: 2 }] : [];
        const doubleFlavorPrice = item.flavorSlug ? COOKIE_RETAIL_CENTS[item.flavorSlug] ?? (item.flavorSlug === currentSeason?.slug ? 8000 : undefined) : undefined;
        if (!setId || contents.length === 0 || (setId === "doubleTrouble" && (!item.flavorSlug || !doubleFlavorPrice))) return { kind: "invalid-set" as const };
        const components = contents.map((part) => products.find((product) => product.slug === part.slug));
        if (components.some((product) => !product)) return { kind: "unavailable" as const };
        const totalCents = setId === "usual4" ? 26000 : setId === "fullBatch" ? 30000 : doubleFlavorPrice ? doubleFlavorPrice * 2 - 1000 : doubleTroublePrice(item.flavorSlug ?? "");
        if (!totalCents) return { kind: "invalid-set" as const };
        for (let index = 0; index < contents.length; index++) {
          const product = components[index]!;
          stockNeeds.set(product.id, (stockNeeds.get(product.id) ?? 0) + contents[index].quantity * item.quantity);
        }
        lineItems.push({ productId: components[0]!.id, quantity: item.quantity, price: new Prisma.Decimal(totalCents).div(100), setId, setContents: contents as unknown as Prisma.InputJsonValue });
      }
      for (const [productId, quantity] of stockNeeds) {
        const product = productsById.get(productId) ?? products.find((candidate) => candidate.id === productId);
        if (!product) return { kind: "unavailable" as const };
        if (isStockTracked(product.stock)) {
          const decremented = await decrementStock(transaction, product.id, quantity);
          if (decremented !== 1) return { kind: "insufficient-stock" as const };
        }
      }

      const total = lineItems.reduce(
        (sum, item) => sum.add(item.price.mul(item.quantity)),
        new Prisma.Decimal(0),
      );

      const [sequence] = await transaction.$queryRaw<{ value: bigint }[]>`SELECT nextval('"OrderPublicNumber_seq"') AS value`;
      if (sequence.value > BigInt(999999)) throw new Error("Public order number space exhausted.");
      const order = await transaction.order.create({
        data: {
          publicNumber: String(sequence.value).padStart(6, "0"),
          customerName: parsed.data.customerName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          address: parsed.data.address || UNCONFIRMED_FULFILLMENT,
          notes: parsed.data.notes,
          total,
          paymentStatus: "AWAITING_PAYMENT",
          items: { create: lineItems },
        },
        select: { id: true, publicNumber: true, customerName: true, email: true, total: true },
      });

      for (const [productId, quantity] of stockNeeds) {
        const product = productsById.get(productId) ?? products.find((candidate) => candidate.id === productId);
        if (product && isStockTracked(product.stock)) {
          await transaction.inventoryAdjustment.create({
            data: {
              productId: product.id,
              change: -quantity,
              reason: InventoryReason.ONLINE_ORDER,
              note: `Online order ${order.publicNumber}`,
            },
          });
        }
      }

      return { kind: "created" as const, order };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (result.kind === "closed") {
    return NextResponse.json(
      { error: "Ordering is currently closed.", code: "ORDERING_CLOSED" },
      { status: 409 },
    );
  }

  if (result.kind === "unavailable") {
    return NextResponse.json(
      { error: "One or more cookies in your batch are no longer available.", code: "PRODUCT_UNAVAILABLE" },
      { status: 409 },
    );
  }
  if (result.kind === "prices") {
    return NextResponse.json(
      { error: "One or more cookie prices are still being confirmed.", code: "PRICE_UNAVAILABLE" },
      { status: 409 },
    );
  }
  if (result.kind === "insufficient-stock") {
    return NextResponse.json(
      { error: "One or more cookies just sold out. Please update your batch.", code: "STOCK_UNAVAILABLE" },
      { status: 409 },
    );
  }
  if (result.kind === "invalid-set") return NextResponse.json({ error: "Invalid cookie set.", code: "INVALID_SET" }, { status: 400 });

  const emailSent = await sendOrderReceivedEmail({
    to: result.order.email,
    customerName: result.order.customerName,
    orderNumber: result.order.publicNumber,
    total: Number(result.order.total),
  });
  if (!emailSent) console.warn("Order-received email was not sent; the order was still created.");
  const response = NextResponse.json({ id: result.order.id }, { status: 201 });
  response.cookies.set(
    "badbatch_order_confirmation",
    await createOrderConfirmationToken(result.order.id),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: `/order/${result.order.id}`,
      maxAge: 60 * 60 * 24 * 7,
    },
  );
  return response;
}



