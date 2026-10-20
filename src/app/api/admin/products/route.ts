import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { createProductSchema } from "@/lib/validation/product";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      subtitle: true,
      category: true,
      description: true,
      price: true,
      image: true,
      isSeasonal: true,
      isAvailable: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(products.map((product) => ({ ...product, price: product.price.toFixed(2) })));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const parsed = createProductSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product.", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: { ...parsed.data, price: parsed.data.price.toFixed(2) },
      select: { id: true, name: true, slug: true, isAvailable: true },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A product with this slug already exists.", code: "DUPLICATE_SLUG" },
        { status: 409 },
      );
    }
    console.error("Admin product creation failed.", error);
    return NextResponse.json({ error: "Could not create the product." }, { status: 500 });
  }
}
