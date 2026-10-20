import Link from "next/link";
import { connection } from "next/server";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ProductImage } from "@/components/storefront/product-image";
import { FeaturedCookieSlideshow } from "@/components/storefront/featured-cookie-slideshow";
import { SectionLabel } from "@/components/storefront/section-label";
import { InstagramLink } from "@/components/storefront/instagram-link";
import type { StorefrontProduct } from "@/components/storefront/product-item";
import { getProductLabel, sortByProductIndex } from "@/lib/storefront/product-copy";
import { prisma } from "@/lib/db/prisma";

export const instant = false;

export default async function HomePage() {
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
  const featured =
    products.find((product) => product.isAvailable && !product.isSeasonal) ??
    products.find((product) => product.isAvailable);

  return (
    <div className="pb-16">
      <section className="grid min-h-[min(760px,calc(100svh-78px))] items-center gap-10 py-12 md:grid-cols-[0.78fr_1.22fr] md:gap-12 md:py-16">
        <div className="order-2 max-w-lg md:order-1">
          <p className="micro-label mb-7">a BAD BATCH original</p>
          <h1 className="display-heading max-w-xl">
            BAD BATCH
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-[var(--cream-muted)]">
            Cookies worth coming back for.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="editorial-link" href="/menu">
              view the batch <span aria-hidden="true" className="ml-6">↗</span>
            </Link>
            <InstagramLink className="editorial-link" />
          </div>
          <p className="micro-label mt-16 hidden md:block">01 — cookies, currently</p>
        </div>

        <div className="order-1 md:order-2">
          <ProductImage
            alt={featured ? getProductLabel(featured.slug, undefined, featured.name) : "BAD BATCH cookie collection"}
            className="aspect-[4/3] w-full md:aspect-[0.96/1]"
            index={featured ? "01" : "00"}
            priority
            sizes="(max-width: 768px) 100vw, 58vw"
            src={featured?.image || null}
          />
          <div className="mt-3 flex justify-between gap-4">
            <p className="micro-label">
              {featured
                ? getProductLabel(featured.slug, undefined, featured.name)
                : "BAD BATCH / cookies"}
            </p>
            <p className="micro-label text-right">BAD BATCH / cookies</p>
          </div>
        </div>
      </section>

      <section className="section-rule py-16 sm:py-20" id="batch">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <SectionLabel index="01" >the batch</SectionLabel>
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
              The current batch.
            </h2>
          </div>
          <Link className="text-[11px] text-[var(--cream-muted)] underline underline-offset-4 hover:text-[var(--cream)]" href="/menu">
            full menu <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <p className="border-y border-[var(--rule)] py-8 text-sm text-[var(--cream-muted)]">
            The next batch is being prepared.
          </p>
        )}
      </section>

      {products.length ? <FeaturedCookieSlideshow products={products} /> : null}

      <section className="section-rule grid gap-6 py-14 sm:grid-cols-[1fr_auto] sm:items-end sm:py-16" id="story">
        <div>
          <SectionLabel index="03">about BAD BATCH</SectionLabel>
          <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
              Really good cookies. No grand origin story.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--cream-muted)]">
            A focused menu. No grand origin story. Just the cookies.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="editorial-link" href="/menu">view the batch</Link>
          <InstagramLink className="editorial-link" />
        </div>
      </section>
    </div>
  );
}
