import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { ProductGrid } from "@/components/storefront/product-grid";
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
      <section className="grid items-center gap-8 py-8 sm:py-10 md:grid-cols-[0.7fr_1.3fr] md:gap-12 md:py-16">
        <div className="order-2 max-w-lg md:order-1">
          <p className="micro-label mb-6">a BAD BATCH original</p>
          <h1 className="display-heading max-w-xl">BAD BATCH</h1>
          <p className="mt-6 max-w-sm text-lg leading-7 text-[var(--cream-muted)] sm:text-xl sm:leading-8">
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

        <figure className="order-1 m-0 mx-auto w-full max-w-[920px] md:order-2">
          <Image
            alt="The BAD BATCH cookie collection, arranged together"
            className="h-auto w-full object-contain"
            height={189}
            preload
            sizes="(max-width: 768px) 100vw, 62vw"
            src="/images/hero.png"
            width={835}
          />
          <figcaption className="mt-2 flex justify-between gap-4 border-t border-[var(--rule)] pt-3">
            <span className="micro-label">
              {featured
                ? getProductLabel(featured.slug, undefined, featured.name)
                : "BAD BATCH / cookies"}
            </span>
            <span className="micro-label text-right">BAD BATCH / cookies</span>
          </figcaption>
        </figure>
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
