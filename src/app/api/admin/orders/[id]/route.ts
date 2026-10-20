import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { orderIdSchema, orderStatusSchema } from "@/lib/validation/admin";
import { availableOrderTransitions } from "@/lib/orders/workflow";

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/orders/[id]">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const parsed = orderStatusSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order status.", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;
  const validId = orderIdSchema.safeParse(id);
  if (!validId.success) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.order.findUnique({
        where: { id: validId.data },
        select: { status: true },
      });
      if (!current) return { kind: "missing" as const };
      if (current.status === parsed.data.status) {
        return {
          kind: "updated" as const,
          order: { id: validId.data, status: current.status },
        };
      }
      if (!availableOrderTransitions(current.status).includes(parsed.data.status)) {
        return { kind: "invalid-transition" as const };
      }

      const update = await transaction.order.updateMany({
        where: { id: validId.data, status: current.status },
        data: { status: parsed.data.status },
      });
      if (update.count !== 1) return { kind: "conflict" as const };

      return {
        kind: "updated" as const,
        order: { id: validId.data, status: parsed.data.status },
      };
    });

    if (result.kind === "missing") {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (result.kind === "invalid-transition") {
      return NextResponse.json({ error: "That order status change is not allowed." }, { status: 409 });
    }
    if (result.kind === "conflict") {
      return NextResponse.json({ error: "The order changed. Refresh and try again." }, { status: 409 });
    }
    return NextResponse.json(result.order);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    console.error("Admin order status update failed.", error);
    return NextResponse.json({ error: "Could not update the order status." }, { status: 500 });
  }
}
