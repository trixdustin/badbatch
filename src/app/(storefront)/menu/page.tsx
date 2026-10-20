import { connection } from "next/server";
import { ProductGrid } from "@/components/storefront/product-grid";
import type { StorefrontProduct } from "@/components/storefront/product-item";
import { SectionLabel } from "@/components/storefront/section-label";
import { InstagramLink } from "@/components/storefront/instagram-link";
import { sortByProductIndex } from "@/lib/storefront/product-copy";
import { prisma } from "@/lib/db/prisma";

export const instant = false;

export default async function MenuPage() {
  await connection();
  const records = await prisma.product.findMany({
    where: { isAvailable: true },
    orderBy: [{ isSeasonal: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      subtitle: true,
      category: true,
      description: true,
      image: true,
      price: true,
      isSeasonal: true,
      isAvailable: true,
      stock: true,
    },
  });
  const products: StorefrontProduct[] = sortByProductIndex(records).map((product) => ({
    ...product,
    price: product.price.toFixed(2),
  }));

  return (
    <div className="py-12 sm:py-16">
      <header className="mb-10 grid gap-5 border-b border-[var(--rule)] pb-8 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <SectionLabel index="01">the menu / currently</SectionLabel>
          <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">
            The current batch.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--cream-muted)]">
            Explore the current lineup and build your batch.
          </p>
        </div>
        <InstagramLink className="editorial-link">
          dm to order <span aria-hidden="true" className="ml-6">↗</span>
        </InstagramLink>
      </header>
      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <p className="border-y border-[var(--rule)] py-8 text-sm text-[var(--cream-muted)]">
          The next batch is being prepared.
        </p>
      )}
    </div>
  );
}
