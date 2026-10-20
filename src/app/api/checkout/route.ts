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
        select: { orderingEnabled: true },
      });
      if (!settings?.orderingEnabled) return { kind: "closed" as const };

      const products = await transaction.product.findMany({
        where: {
          id: { in: parsed.data.items.map((item) => item.productId) },
          isAvailable: true,
        },
        select: { id: true, price: true, stock: true },
      });
      if (products.length !== parsed.data.items.length) {
        return { kind: "unavailable" as const };
      }
      if (products.some((product) => product.price.lte(0))) {
        return { kind: "prices" as const };
      }

      const productsById = new Map(products.map((product) => [product.id, product]));

      // Deduct tracked stock atomically before committing the order. Untracked
      // products (stock === null) are sold without a stock check. Because this
      // runs inside the Serializable transaction, concurrent checkouts cannot
      // oversell; a failed decrement rolls the whole order back.
      for (const item of parsed.data.items) {
        const product = productsById.get(item.productId);
        if (!product) return { kind: "unavailable" as const };
        if (isStockTracked(product.stock)) {
          const decremented = await decrementStock(transaction, product.id, item.quantity);
          if (decremented !== 1) return { kind: "insufficient-stock" as const };
        }
      }

      const items = parsed.data.items.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) throw new Error("Validated product disappeared during checkout.");
        return {
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
        };
      });
      const total = items.reduce(
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
          items: { create: items },
        },
        select: { id: true, publicNumber: true, customerName: true, email: true, total: true },
      });

      for (const item of parsed.data.items) {
        const product = productsById.get(item.productId);
        if (product && isStockTracked(product.stock)) {
          await transaction.inventoryAdjustment.create({
            data: {
              productId: product.id,
              change: -item.quantity,
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



