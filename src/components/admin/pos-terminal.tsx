"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentMethod } from "@prisma/client";
import { QuantitySelector } from "@/components/storefront/quantity-selector";
import { formatPhp } from "@/lib/format/currency";
import { paymentMethodLabels } from "@/lib/inventory/stock";

export type PosProduct = {
  id: string;
  name: string;
  slug: string;
  price: string;
  isSeasonal: boolean;
  isAvailable: boolean;
  stock: number | null;
  purchasable: boolean;
};

type PosResponse = { id?: string; error?: string; code?: string };

type Line = { product: PosProduct; quantity: number };

function cents(price: string) {
  const amount = Number(price);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

export function PosTerminal({ products }: { products: PosProduct[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const available = products.filter((product) => product.purchasable);
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = lines.reduce((total, line) => total + cents(line.product.price) * line.quantity, 0);

  function addProduct(product: PosProduct) {
    setFeedback(null);
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.product.id !== productId)
        : current.map((line) => (line.product.id === productId ? { ...line, quantity } : line)),
    );
  }

  async function submit() {
    if (isSubmitting || lines.length === 0) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          paymentMethod,
        }),
      });
      const result: PosResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.code === "INSUFFICIENT_STOCK") {
          setFeedback({ kind: "error", message: "Not enough stock for an item. Refresh and try again." });
        } else if (result.code === "PRODUCT_UNAVAILABLE") {
          setFeedback({ kind: "error", message: "An item is no longer available. Refresh the list." });
        } else {
          setFeedback({ kind: "error", message: result.error ?? "Could not record the sale." });
        }
        return;
      }
      setLines([]);
      setFeedback({ kind: "success", message: "Sale recorded." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section aria-labelledby="pos-products-heading">
        <h2 className="border-b border-neutral-300 pb-3 text-lg" id="pos-products-heading">
          Add to sale
        </h2>
        {available.length === 0 ? (
          <p className="py-8 text-sm text-neutral-600">
            No cookies are currently available to sell. Set a price above ₱0 and mark a product
            available to sell it here.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {available.map((product) => (
              <li className="flex flex-wrap items-center justify-between gap-4 py-4" key={product.id}>
                <div className="min-w-0">
                  <p className="text-sm">
                    {product.name}
                    {product.isSeasonal ? (
                      <span className="ml-2 text-xs text-neutral-500">seasonal</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatPhp(cents(product.price) / 100)}
                    {product.stock !== null ? ` · ${product.stock} in stock` : " · stock not tracked"}
                  </p>
                </div>
                <button
                  className="min-h-11 border border-neutral-900 px-4 text-sm"
                  onClick={() => addProduct(product)}
                  type="button"
                >
                  add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-label="Current sale" className="border border-neutral-300 p-5">
        <p className="mb-4 text-xs uppercase tracking-widest text-neutral-500">
          current sale / {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>
        {lines.length === 0 ? (
          <p className="text-sm text-neutral-600">No items yet. Add cookies from the left.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {lines.map((line) => (
              <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={line.product.id}>
                <div className="min-w-0">
                  <p className="text-sm">{line.product.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatPhp((cents(line.product.price) * line.quantity) / 100)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <QuantitySelector
                    label={line.product.name}
                    onChange={(quantity) => setQuantity(line.product.id, quantity)}
                    value={line.quantity}
                  />
                  <button
                    className="text-xs text-neutral-500 underline underline-offset-4 hover:text-red-700"
                    onClick={() => setQuantity(line.product.id, 0)}
                    type="button"
                  >
                    remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-neutral-300 pt-4">
          <span className="text-sm text-neutral-600">total</span>
          <span className="text-lg tabular-nums">{formatPhp(subtotal / 100)}</span>
        </div>

        <fieldset className="mt-5 grid gap-4" disabled={isSubmitting}>
          <legend className="text-sm text-neutral-700">payment method</legend>
          <div className="flex flex-wrap gap-4">
            {([PaymentMethod.CASH, PaymentMethod.OTHER] as const).map((method) => (
              <label className="flex items-center gap-2 text-sm" key={method}>
                <input
                  checked={paymentMethod === method}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod(method)}
                  type="radio"
                  value={method}
                />
                {paymentMethodLabels[method]}
              </label>
            ))}
          </div>
          <p className="text-xs text-neutral-500">
            Payment is recorded for tracking only. This terminal does not process electronic
            payments.
          </p>
        </fieldset>

        <button
          className="mt-5 min-h-11 w-full bg-neutral-900 px-5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={lines.length === 0 || isSubmitting}
          onClick={submit}
          type="button"
        >
          {isSubmitting ? "recording…" : "complete sale"}
        </button>

        {feedback ? (
          <p
            aria-live="polite"
            className={`mt-4 text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-800"}`}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

