import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { storeSettingsSchema } from "@/lib/validation/admin";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "store" },
    select: {
      orderingEnabled: true,
      announcement: true,
      seasonalProductId: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const parsed = storeSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid store settings.", issues: parsed.error.issues }, { status: 400 });
  }

  const { seasonalProductId, ...fields } = parsed.data;
  if (seasonalProductId) {
    const seasonalProduct = await prisma.product.findFirst({
      where: { id: seasonalProductId, isSeasonal: true, isAvailable: true },
      select: { id: true },
    });
    if (!seasonalProduct) {
      return NextResponse.json({ error: "Seasonal product not found." }, { status: 400 });
    }
  }

  const data = {
    ...fields,
    ...(seasonalProductId === undefined ? {} : { seasonalProductId }),
  };
  const settings = await prisma.storeSettings.upsert({
    where: { id: "store" },
    create: { id: "store", ...data },
    update: data,
    select: {
      orderingEnabled: true,
      announcement: true,
      seasonalProductId: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(settings);
}
