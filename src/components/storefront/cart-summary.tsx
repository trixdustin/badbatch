"use client";

import Link from "next/link";
import { InstagramLink } from "@/components/storefront/instagram-link";
import { ProductImage } from "@/components/storefront/product-image";
import { QuantitySelector } from "@/components/storefront/quantity-selector";
import { useCart } from "@/components/storefront/cart-provider";
import { formatPhp } from "@/lib/format/currency";

function centsFromPrice(price: string) {
  const amount = Number(price);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

function formatPrice(cents: number) {
  return formatPhp(cents / 100);
}

export function CartSummary() {
  const { items, hydrated, setQuantity, removeItem } = useCart();

  if (!hydrated) {
    return <p className="text-sm text-[var(--cream-muted)]">Loading your batch…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="border-t border-[var(--rule)] py-8">
        <p className="text-sm text-[var(--cream-muted)]">Nothing in your batch yet.</p>
        <Link className="editorial-link mt-6" href="/menu">browse the cookies</Link>
        <p className="mt-5 text-xs text-[var(--cream-muted)]">
          Prefer a person? <InstagramLink className="underline underline-offset-4">dm to order</InstagramLink>
        </p>
      </div>
    );
  }

  const hasPlaceholderPrice = items.some((item) => centsFromPrice(item.price) === 0);
  const subtotal = items.reduce(
    (total, item) => total + centsFromPrice(item.price) * item.quantity,
    0,
  );

  return (
    <div>
      <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
        {items.map((item, index) => {
          const productName = item.name;
          return (
            <li
              className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[112px_minmax(0,1fr)_auto]"
              key={item.id}
            >
              <Link aria-label={`View ${productName}`} href={`/cookies/${item.slug}`}>
                <ProductImage
                  alt={productName}
                  className="aspect-[4/5] w-full"
                  index={String(index + 1).padStart(2, "0")}
                  sizes="112px"
                  src={item.image || null}
                />
              </Link>
              <div className="flex min-w-0 flex-col justify-center">
                <p className="text-[15px]">{productName}</p>
                {item.subtitle ? <p className="mt-1 text-xs text-[var(--cream-muted)]">{item.subtitle}</p> : null}
                {item.category ? <p className="micro-label mt-2">{item.category}</p> : null}
                {item.isSeasonal ? (
                  <p className="micro-label mt-2">limited / seasonal</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <QuantitySelector
                    label={productName}
                    onChange={(quantity) => setQuantity(item.id, quantity)}
                    value={item.quantity}
                  />
                  <button
                    className="text-[10px] text-[var(--silver)] underline underline-offset-4 hover:text-[var(--cream)]"
                    onClick={() => removeItem(item.id)}
                    type="button"
                  >
                    remove
                  </button>
                </div>
              </div>
              <p className="col-start-2 text-right text-xs tabular-nums text-[var(--cream-muted)] sm:col-start-3 sm:row-start-1">
                {centsFromPrice(item.price) === 0
                  ? "price being confirmed"
                  : formatPrice(centsFromPrice(item.price) * item.quantity)}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="ml-auto mt-6 max-w-sm">
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--rule)] pb-4">
          <span className="text-sm text-[var(--cream-muted)]">estimated subtotal</span>
          <span className="text-sm tabular-nums">
            {hasPlaceholderPrice ? "price being confirmed" : formatPrice(subtotal)}
          </span>
        </div>
        <p className="mt-3 text-[10px] leading-5 text-[var(--silver)]">
          Displayed prices are estimates. The server recalculates your total when you place the order.
        </p>
        <Link className="editorial-button mt-6 w-full" href="/checkout">
          continue to checkout
        </Link>
        <p className="mt-5 text-center text-xs text-[var(--cream-muted)]">
          or <InstagramLink className="underline underline-offset-4">dm to order</InstagramLink>
        </p>
      </div>
    </div>
  );
}
