import { SetsPage } from "@/components/storefront/sets-page";
import { connection } from "next/server";
import { prisma } from "@/lib/db/prisma";

export default async function CookieSetsPage() {
  await connection();
  const settings = await prisma.storeSettings.findUnique({ where: { id: "store" }, select: { seasonalProductId: true } });
  const product = settings?.seasonalProductId ? await prisma.product.findUnique({ where: { id: settings.seasonalProductId }, select: { slug: true, name: true, subtitle: true } }) : null;
  return <SetsPage seasonal={product ? { slug: product.slug, name: product.name, flavor: product.subtitle || product.name, regular: 80 } : undefined} />;
}
