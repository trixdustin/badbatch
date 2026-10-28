"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InstagramLink } from "@/components/storefront/instagram-link";
import { useCart } from "@/components/storefront/cart-provider";
import { QuantitySelector } from "@/components/storefront/quantity-selector";
import { describeSetContents } from "@/lib/storefront/sets";

type CheckoutResponse = {
  id?: unknown;
  code?: unknown;
  issues?: unknown;
};

const fieldLabels: Record<string, string> = {
  customerName: "Full name",
  email: "Email address",
  phone: "Phone number",
  address: "Fulfillment details",
  notes: "Order notes",
};

function isCheckoutResponse(value: unknown): value is CheckoutResponse {
  return typeof value === "object" && value !== null;
}

export function CheckoutForm({ orderingEnabled }: { orderingEnabled: boolean }) {
  const router = useRouter();
  const { items, hydrated, setQuantity, removeItem, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0 || submitting) return;

    const formData = new FormData(event.currentTarget);
    const customer = {
      customerName: String(formData.get("customerName") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      address: String(formData.get("address") || ""),
      notes: String(formData.get("notes") || ""),
      items: items.map((item) => "setId" in item
        ? { setId: item.setId, flavorSlug: item.contents.length === 1 && item.setId === "doubleTrouble" ? item.contents[0].slug : undefined, quantity: item.quantity }
        : { productId: item.id, quantity: item.quantity }),
    };

    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      const rawResult: unknown = await response.json();
      const result = isCheckoutResponse(rawResult) ? rawResult : {};
      if (!response.ok) {
        if (result.code === "ORDERING_CLOSED") {
          setError("Ordering is currently closed. You can still DM us.");
        } else if (result.code === "PRODUCT_UNAVAILABLE") {
          setError("A cookie in your batch is no longer available. Please update your batch.");
        } else if (result.code === "PRICE_UNAVAILABLE") {
          setError("Some cookie prices are still being confirmed. Please DM us for now.");
        } else if (result.code === "STOCK_UNAVAILABLE") {
          setError("A cookie in your batch just sold out. Please update your batch.");
        } else if (response.status === 400) {
          const issues = Array.isArray(result.issues) ? result.issues : [];
          const nextFieldErrors: Record<string, string> = {};
          for (const issue of issues) {
            if (!issue || typeof issue !== "object") continue;
            const candidate = issue as { path?: unknown; message?: unknown };
            const field = Array.isArray(candidate.path) ? candidate.path[0] : undefined;
            if (typeof field === "string" && field in fieldLabels && typeof candidate.message === "string") {
              nextFieldErrors[field] ??= `${fieldLabels[field]}: ${candidate.message}`;
            }
          }
          setFieldErrors(nextFieldErrors);
          if (Object.keys(nextFieldErrors).length === 0) setError("Check your order details and try again.");
        } else {
          setError("We couldn't place that batch. Please try again or DM us.");
        }
        return;
      }
      if (typeof result.id !== "string") {
        setError("The order response was incomplete. Please contact the shop before trying again.");
        return;
      }

      clearCart();
      router.push(`/order/${encodeURIComponent(result.id)}`);
    } catch {
      setError("We couldn't reach the shop. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return <p className="text-sm text-[var(--cream-muted)]">Loading your batch…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="border-t border-[var(--rule)] py-8">
        <p className="text-sm text-[var(--cream-muted)]">Your batch is empty.</p>
        <Link className="editorial-link mt-6" href="/menu">browse the cookies</Link>
        <p className="mt-5 text-xs text-[var(--cream-muted)]">
          or <InstagramLink className="underline underline-offset-4">dm to order</InstagramLink>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
      <form className="order-2 space-y-5 lg:order-1" onSubmit={submitOrder}>
        {!orderingEnabled ? (
          <p className="text-xs leading-5 text-[var(--silver)]">
            Checkout will open when ordering is enabled.
          </p>
        ) : null}
        <fieldset className="space-y-5 border-0 p-0" disabled={!orderingEnabled || submitting}>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field-label">
              full name
              <input
                aria-describedby={fieldErrors.customerName ? "checkout-customerName-error" : undefined}
                aria-invalid={Boolean(fieldErrors.customerName)}
                autoComplete="name"
                className="field-control"
                maxLength={120}
                name="customerName"
                required
              />
              {fieldErrors.customerName ? <span className="mt-2 block text-xs text-[var(--storefront-danger)]" id="checkout-customerName-error">{fieldErrors.customerName}</span> : null}
            </label>
            <label className="field-label">
              email
              <input
                aria-describedby={fieldErrors.email ? "checkout-email-error" : undefined}
                aria-invalid={Boolean(fieldErrors.email)}
                autoComplete="email"
                className="field-control"
                maxLength={254}
                name="email"
                required
                type="email"
              />
              {fieldErrors.email ? <span className="mt-2 block text-xs text-[var(--storefront-danger)]" id="checkout-email-error">{fieldErrors.email}</span> : null}
            </label>
          </div>
          <label className="field-label">
            phone
            <input
              aria-describedby={fieldErrors.phone ? "checkout-phone-error" : undefined}
              aria-invalid={Boolean(fieldErrors.phone)}
              autoComplete="tel"
              className="field-control"
              maxLength={40}
              name="phone"
              required
              type="tel"
            />
            {fieldErrors.phone ? <span className="mt-2 block text-xs text-[var(--storefront-danger)]" id="checkout-phone-error">{fieldErrors.phone}</span> : null}
          </label>
          <label className="field-label">
            fulfillment details <span className="text-[var(--silver)]">(optional)</span>
            <textarea
              aria-describedby={fieldErrors.address ? "checkout-address-error" : undefined}
              aria-invalid={Boolean(fieldErrors.address)}
              className="field-control min-h-24 resize-y"
              maxLength={500}
              name="address"
              rows={3}
              placeholder="Add an address or useful context, if you know it."
            />
            {fieldErrors.address ? <span className="mt-2 block text-xs text-[var(--storefront-danger)]" id="checkout-address-error">{fieldErrors.address}</span> : null}
          </label>
          <p className="-mt-3 text-[10px] leading-5 text-[var(--silver)]">
            Fulfillment arrangements are not set here. We’ll confirm the details directly.
          </p>
          <label className="field-label">
            note <span className="text-[var(--silver)]">(optional)</span>
            <textarea
              aria-describedby={fieldErrors.notes ? "checkout-notes-error" : undefined}
              aria-invalid={Boolean(fieldErrors.notes)}
              className="field-control min-h-20 resize-y"
              maxLength={1000}
              name="notes"
              rows={2}
            />
            {fieldErrors.notes ? <span className="mt-2 block text-xs text-[var(--storefront-danger)]" id="checkout-notes-error">{fieldErrors.notes}</span> : null}
          </label>
          <p className="text-[10px] leading-5 text-[var(--silver)]">
            After placing your order, you’ll receive GCash instructions and can upload payment proof securely.
          </p>
          {error ? (
            <p aria-live="assertive" className="text-sm text-[var(--storefront-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="editorial-button w-full sm:w-auto"
            disabled={!orderingEnabled || submitting}
            type="submit"
          >
            {!orderingEnabled
              ? "ordering closed"
              : submitting
                ? "placing your order..."
                : "place order"}
          </button>
        </fieldset>
      </form>

      <aside aria-label="Your batch" className="order-1 lg:order-2">
        <p className="micro-label mb-4">
          your batch / {items.reduce((total, item) => total + item.quantity, 0)} items
        </p>
        <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
          {items.map((item) => (
            <li className="flex flex-wrap items-center justify-between gap-4 py-4" key={item.id}>
              <div>
                <p className="text-sm">{item.name}</p>
                {!('setId' in item) && item.subtitle ? <p className="mt-1 text-xs text-[var(--cream-muted)]">{item.subtitle}</p> : null}
                {!('setId' in item) && item.category ? <p className="micro-label mt-1">{item.category}</p> : null}
                {"setId" in item ? <p className="mt-2 text-xs leading-5 text-[var(--cream-muted)]">{describeSetContents(item.contents, item.quantity)}</p> : item.isSeasonal ? <p className="micro-label mt-1">seasonal</p> : null}
              </div>
              <QuantitySelector label={item.name} onChange={(quantity) => setQuantity(item.id, quantity)} value={item.quantity} />
              <button className="w-full text-left text-[10px] text-[var(--silver)] underline underline-offset-4 hover:text-[var(--cream)]" onClick={() => removeItem(item.id)} type="button">remove</button>
            </li>
          ))}
        </ul>
      </aside>
      <p className="order-3 text-xs text-[var(--cream-muted)] lg:col-span-2">
        Rather order directly?{" "}
        <InstagramLink className="underline underline-offset-4">dm to order</InstagramLink>
      </p>
    </div>
  );
}
