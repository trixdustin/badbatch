import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { InstagramLink } from "@/components/storefront/instagram-link";
import { AddToBatchButton } from "@/components/storefront/add-to-batch-button";
import { ProductImage } from "@/components/storefront/product-image";
import { ProductReviewSummary } from "@/components/storefront/product-review-summary";
import { SectionLabel } from "@/components/storefront/section-label";
import { getProductCopy, getProductLabel, sortByProductIndex } from "@/lib/storefront/product-copy";
import { prisma } from "@/lib/db/prisma";
import { formatPhp } from "@/lib/format/currency";
import { isPurchasable, isStockTracked } from "@/lib/inventory/stock";

export const instant = false;

export default async function CookiePage({ params }: PageProps<"/cookies/[slug]">) {
  await connection();
  const { slug } = await params;
  const [product, products] = await Promise.all([
    prisma.product.findUnique({
      where: { slug, isAvailable: true },
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
    }),
    prisma.product.findMany({
      where: { isAvailable: true },
      select: { id: true, slug: true },
    }),
  ]);

  if (!product) notFound();
  const number = getProductCopy(product.slug).index;
  const orderedProducts = sortByProductIndex(products);
  const productPosition = orderedProducts.findIndex((item) => item.id === product.id);
  const fallbackNumber =
    productPosition >= 0 ? String(productPosition + 1).padStart(2, "0") : number;
  const price = product.price.toFixed(2);
  const productLabel = getProductLabel(product.slug, fallbackNumber, product.name);
  const purchasable = isPurchasable(product);
  const soldOut = product.isAvailable && isStockTracked(product.stock) && product.stock <= 0;

  return (
    <div className="py-8 sm:py-12">
      <Link
        className="mb-8 inline-flex items-center gap-3 text-[11px] text-[var(--cream-muted)] hover:text-[var(--cream)]"
        href="/menu"
      >
        <span aria-hidden="true">←</span> back to the menu
      </Link>

      <div className="grid gap-9 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
        <div className="flex flex-col justify-center py-2 lg:py-10">
          <SectionLabel index={number}>
            {product.isSeasonal ? "limited batch" : "permanent batch"}
          </SectionLabel>
          <p className="micro-label mt-10">{product.category}</p>
          <p className="mt-2 text-xs text-[var(--cream-muted)]">
            {product.isAvailable ? (soldOut ? "sold out" : "available") : "not available"}
          </p>
          <h1 className="mt-4 text-5xl font-medium tracking-[-0.06em] sm:text-6xl">
            {productLabel}
          </h1>
          {product.subtitle ? <p className="mt-3 text-sm text-[var(--cream-muted)]">{product.subtitle}</p> : null}
          {product.description ? (
            <p className="mt-5 max-w-md text-sm leading-6 text-[var(--cream-muted)]">{product.description}</p>
          ) : null}
          <div className="mt-9 border-y border-[var(--rule)] py-5">
            <p className="micro-label">price</p>
            <p className="mt-2 text-sm tabular-nums">
              {price === "0.00" ? "being confirmed" : formatPhp(Number(price))}
            </p>
          </div>
          <div className="mt-7">
            {purchasable ? (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
                <AddToBatchButton
                  product={{
                    id: product.id,
                    name: productLabel,
                    slug: product.slug,
                    image: product.image,
                    price,
                    isSeasonal: product.isSeasonal,
                    subtitle: product.subtitle,
                    category: product.category,
                  }}
                />
                <InstagramLink className="text-xs text-[var(--cream-muted)] underline underline-offset-4 hover:text-[var(--cream)]">
                  dm to order →
                </InstagramLink>
              </div>
            ) : (
              <p className="micro-label">{soldOut ? "sold out — dm to order" : "not available to order"}</p>
            )}
          </div>
          {price === "0.00" ? (
            <p className="mt-5 max-w-sm text-[10px] leading-5 text-[var(--silver)]">
              Please message us to confirm the price before ordering.
            </p>
          ) : null}
        </div>
        <ProductImage
          alt={`${product.name} cookie`}
          className="aspect-[4/5] w-full sm:aspect-[1/0.9] lg:aspect-[0.92/1]"
          index={number}
          priority
          sizes="(max-width: 1024px) 100vw, 58vw"
          src={product.image || null}
        />
      </div>
      <ProductReviewSummary productId={product.id} slug={product.slug} />
    </div>
  );
}
