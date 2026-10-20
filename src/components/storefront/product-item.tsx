import Link from "next/link";
import { ProductImage } from "@/components/storefront/product-image";
import { getProductCopy, getProductLabel } from "@/lib/storefront/product-copy";
import { formatPhp } from "@/lib/format/currency";
import { isPurchasable, isStockTracked } from "@/lib/inventory/stock";

export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  category: string;
  description: string;
  image: string;
  price: string;
  isSeasonal: boolean;
  isAvailable: boolean;
  stock: number | null;
};

export function ProductItem({
  product,
  index,
}: {
  product: StorefrontProduct;
  index: string;
}) {
  const copy = getProductCopy(product.slug, index);
  const label = getProductLabel(product.slug, index, product.name);
  const purchasable = isPurchasable(product);
  const soldOut = product.isAvailable && isStockTracked(product.stock) && product.stock <= 0;

  return (
    <article className="section-rule grid grid-cols-[minmax(104px,0.7fr)_minmax(0,1.3fr)] gap-4 py-5 sm:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.28fr)] sm:gap-8 sm:py-7">
      <Link
        aria-label={`View ${label}${product.isSeasonal ? ", limited batch" : ""}`}
        className="block"
        href={`/cookies/${product.slug}`}
      >
        <ProductImage
          alt={`${label} cookie`}
          className="aspect-[4/5] w-full"
          index={copy.index}
          sizes="(max-width: 640px) 38vw, 240px"
          src={product.image || null}
        />
      </Link>
      <div className="flex min-w-0 flex-col justify-center">
        <p className="micro-label">{product.category}</p>
        {product.isSeasonal ? <p className="micro-label mt-1">limited batch</p> : null}
        <h3 className="mt-3 text-2xl font-medium tracking-[-0.05em] sm:text-4xl">
          <Link className="hover:text-[var(--cream-muted)]" href={`/cookies/${product.slug}`}>
            {label}
          </Link>
        </h3>
        {product.subtitle ? <p className="mt-2 text-xs text-[var(--cream-muted)] sm:text-sm">{product.subtitle}</p> : null}
        {product.description ? (
          <p className="mt-3 max-w-sm text-xs leading-5 text-[var(--cream-muted)] sm:mt-4 sm:text-sm">
            {product.description}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:mt-6">
          <span className="text-[10px] text-[var(--cream-muted)]">
            {product.price === "0.00" ? "price being confirmed" : formatPhp(Number(product.price))}
          </span>
          {purchasable ? (
            <Link
              className="text-[10px] underline underline-offset-4 hover:text-[var(--cream-muted)]"
              href={`/cookies/${product.slug}`}
            >
              view cookie <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <span className="micro-label">{soldOut ? "sold out" : "not available"}</span>
          )}
        </div>
      </div>
    </article>
  );
}
