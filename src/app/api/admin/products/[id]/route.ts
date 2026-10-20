import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { updateProductSchema, productIdSchema } from "@/lib/validation/product";

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/products/[id]">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const parsed = updateProductSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product update.", issues: parsed.error.issues }, { status: 400 });
  }

  const data = {
    ...parsed.data,
    ...(parsed.data.price === undefined ? {} : { price: parsed.data.price.toFixed(2) }),
  };
  const { id } = await params;
  const validId = productIdSchema.safeParse(id);
  if (!validId.success) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  try {
    const product = await prisma.product.update({
      where: { id: validId.data },
      data,
      select: { id: true, name: true, slug: true, isSeasonal: true, isAvailable: true },
    });
    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Product not found." }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A product with this slug already exists.", code: "DUPLICATE_SLUG" },
          { status: 409 },
        );
      }
    }
    console.error("Admin product update failed.", error);
    return NextResponse.json({ error: "Could not update the product." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext<"/api/admin/products/[id]">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await params;
  const validId = productIdSchema.safeParse(id);
  if (!validId.success) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  try {
    // isAvailable is the existing archive flag. Keep the product row so saved
    // recipes, POS/order history, and product identifiers remain intact.
    const [archived] = await prisma.$transaction([
      prisma.product.update({
        where: { id: validId.data },
        data: { isAvailable: false },
        select: { id: true, name: true, slug: true, isAvailable: true },
      }),
      prisma.storeSettings.updateMany({
        where: { seasonalProductId: validId.data },
        data: { seasonalProductId: null },
      }),
    ]);
    return NextResponse.json({
      outcome: "archived",
      message: "Product archived (hidden from new sales). Existing recipes and sales history are preserved.",
      product: archived,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    console.error("Admin product delete failed.", error);
    return NextResponse.json({ error: "Could not delete the product." }, { status: 500 });
  }
}

