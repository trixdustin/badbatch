import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      customerName: true,
      email: true,
      phone: true,
      address: true,
      notes: true,
      total: true,
      createdAt: true,
      items: {
        select: {
          quantity: true,
          price: true,
          setId: true,
          setContents: true,
          product: { select: { name: true } },
        },
      },
    },
    take: 100,
  });
  return NextResponse.json(
    orders.map((order) => ({
      ...order,
      total: order.total.toFixed(2),
      items: order.items.map((item) => ({ ...item, price: item.price.toFixed(2) })),
    })),
  );
}
