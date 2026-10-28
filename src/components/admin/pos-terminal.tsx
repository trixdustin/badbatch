"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentMethod } from "@prisma/client";
import { QuantitySelector } from "@/components/storefront/quantity-selector";
import { formatPhp } from "@/lib/format/currency";
import { paymentMethodLabels } from "@/lib/inventory/stock";
import { COOKIE_SET_RULES, doubleTroublePrice } from "@/lib/storefront/sets";

export type PosProduct = {
  id: string; name: string; slug: string; price: string; isSeasonal: boolean;
  isCurrentSeasonal: boolean;
  isAvailable: boolean; stock: number | null; purchasable: boolean;
};

type PosResponse = { id?: string; error?: string; code?: string };
type Line = { key: string; product?: PosProduct; setId?: "usual4" | "doubleTrouble" | "fullBatch"; flavorSlug?: string; name: string; contents: { slug: string; quantity: number }[]; unitPrice: number; quantity: number };

function cents(price: string) {
  const amount = Number(price);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

export function PosTerminal({ products }: { products: PosProduct[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedFlavor, setSelectedFlavor] = useState(products.find((item) => item.slug === "the-classic")?.slug ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const available = products.filter((product) => product.purchasable);
  const setFlavors = products.filter((product) => ["the-classic", "the-dark", "the-third"].includes(product.slug) || product.isCurrentSeasonal);
  const cookieCount = lines.reduce((total, line) => total + line.quantity * (line.contents.reduce((sum, part) => sum + part.quantity, 0)), 0);
  const subtotal = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);

  function addProduct(product: PosProduct) {
    setFeedback(null);
    setLines((current) => {
      const existing = current.find((line) => line.product?.id === product.id);
      if (existing) return current.map((line) => line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { key: `product:${product.id}`, product, name: product.name, contents: [{ slug: product.slug, quantity: 1 }], unitPrice: cents(product.price), quantity: 1 }];
    });
  }

  function addSet(setId: "usual4" | "doubleTrouble" | "fullBatch", flavorSlug?: string) {
    const currentSeason = products.find((item) => item.isCurrentSeasonal);
    const contents = setId === "usual4" ? [...COOKIE_SET_RULES.usual4.contents] : setId === "fullBatch" ? [...COOKIE_SET_RULES.fullBatch.contents.slice(0, 3), ...(currentSeason ? [{ slug: currentSeason.slug, quantity: 1 }] : [])] : flavorSlug ? [{ slug: flavorSlug, quantity: 2 }] : [];
    const price = setId === "usual4" ? COOKIE_SET_RULES.usual4.price : setId === "fullBatch" ? COOKIE_SET_RULES.fullBatch.price : doubleTroublePrice(flavorSlug ?? "") ?? (flavorSlug === currentSeason?.slug ? 15000 : 0);
    if (price <= 0) return;
    const flavor = products.find((item) => item.slug === flavorSlug);
    const name = setId === "usual4" ? "The Usual, x4" : setId === "fullBatch" ? "Full Batch" : `Double Trouble / ${flavor?.name ?? "selected flavor"}`;
    const key = `set:${setId}:${flavorSlug ?? ""}`;
    setFeedback(null);
    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) return current.map((line) => line.key === key ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { key, setId, flavorSlug, name, contents, unitPrice: price, quantity: 1 }];
    });
  }

  function setQuantity(key: string, quantity: number) {
    setLines((current) => quantity <= 0 ? current.filter((line) => line.key !== key) : current.map((line) => line.key === key ? { ...line, quantity } : line));
  }

  async function submit() {
    if (isSubmitting || lines.length === 0) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/pos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((line) => line.product ? { productId: line.product.id, quantity: line.quantity } : { setId: line.setId, ...(line.flavorSlug ? { flavorSlug: line.flavorSlug } : {}), quantity: line.quantity }), paymentMethod }),
      });
      const result: PosResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.code === "INSUFFICIENT_STOCK") setFeedback({ kind: "error", message: "Not enough stock for an item. Refresh and try again." });
        else if (result.code === "PRODUCT_UNAVAILABLE") setFeedback({ kind: "error", message: "An item is no longer available. Refresh the list." });
        else setFeedback({ kind: "error", message: result.error ?? "Could not record the sale." });
        return;
      }
      setLines([]);
      setFeedback({ kind: "success", message: "Sale recorded." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
    } finally { setIsSubmitting(false); }
  }

  return <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
    <section aria-labelledby="pos-products-heading">
      <h2 className="border-b border-neutral-300 pb-3 text-lg" id="pos-products-heading">Add to sale</h2>
      {available.length === 0 ? <p className="py-8 text-sm text-neutral-600">No cookies are currently available to sell. Set a price above ₱0 and mark a product available to sell it here.</p> : <ul className="divide-y divide-neutral-200">
        {available.map((product) => <li className="flex flex-wrap items-center justify-between gap-4 py-4" key={product.id}>
          <div className="min-w-0"><p className="text-sm">{product.name}{product.isSeasonal ? <span className="ml-2 text-xs text-neutral-500">seasonal</span> : null}</p><p className="mt-1 text-xs text-neutral-500">{formatPhp(cents(product.price) / 100)}{product.stock !== null ? ` · ${product.stock} in stock` : " · stock not tracked"}</p></div>
          <button className="min-h-11 border border-neutral-900 px-4 text-sm" onClick={() => addProduct(product)} type="button">add</button>
        </li>)}
      </ul>}
      <div className="mt-8 border-t border-neutral-300 pt-5">
        <h3 className="text-lg">Cookie sets</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button className="min-h-11 border border-neutral-900 px-3 text-left text-sm" onClick={() => addSet("usual4")} type="button">The Usual, x4 · ₱260</button>
          <button className="min-h-11 border border-neutral-900 px-3 text-left text-sm" onClick={() => addSet("fullBatch")} type="button">Full Batch · ₱300</button>
        </div>
        <label className="mt-4 block text-sm">Double Trouble flavor
          <select className="mt-2 min-h-11 w-full border border-neutral-300 bg-white px-3" onChange={(event) => setSelectedFlavor(event.target.value)} value={selectedFlavor}>
            {setFlavors.map((product) => <option key={product.id} value={product.slug}>{product.name}{product.isCurrentSeasonal ? " (seasonal)" : ""}</option>)}
          </select>
        </label>
        <button className="mt-3 min-h-11 border border-neutral-900 px-4 text-sm" disabled={!selectedFlavor} onClick={() => addSet("doubleTrouble", selectedFlavor)} type="button">add Double Trouble · {formatPhp((doubleTroublePrice(selectedFlavor) ?? (products.find((item) => item.slug === selectedFlavor && item.isCurrentSeasonal) ? 15000 : 0)) / 100)}</button>
      </div>
    </section>

    <aside aria-label="Current sale" className="border border-neutral-300 p-5">
      <p className="mb-4 text-xs uppercase tracking-widest text-neutral-500">current sale / {cookieCount} {cookieCount === 1 ? "cookie" : "cookies"}</p>
      {lines.length === 0 ? <p className="text-sm text-neutral-600">No items yet. Add cookies or sets from the left.</p> : <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
        {lines.map((line) => <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={line.key}>
          <div className="min-w-0"><p className="text-sm">{line.name}</p><p className="mt-1 text-xs text-neutral-500">{line.contents.map((part) => `${part.quantity * line.quantity} × ${products.find((product) => product.slug === part.slug)?.name ?? part.slug}`).join(" · ")}</p><p className="mt-1 text-xs text-neutral-500">{formatPhp(line.unitPrice / 100)}{line.setId ? " per set" : " each"}</p></div>
          <div className="flex items-center gap-3"><QuantitySelector label={line.name} onChange={(quantity) => setQuantity(line.key, quantity)} value={line.quantity} /><button className="text-xs text-neutral-500 underline underline-offset-4 hover:text-red-700" onClick={() => setQuantity(line.key, 0)} type="button">remove</button></div>
        </li>)}
      </ul>}
      <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-neutral-300 pt-4"><span className="text-sm text-neutral-600">total</span><span className="text-lg tabular-nums">{formatPhp(subtotal / 100)}</span></div>
      <fieldset className="mt-5 grid gap-4" disabled={isSubmitting}><legend className="text-sm text-neutral-700">payment method</legend><div className="flex flex-wrap gap-4">{([PaymentMethod.CASH, PaymentMethod.OTHER] as const).map((method) => <label className="flex items-center gap-2 text-sm" key={method}><input checked={paymentMethod === method} name="paymentMethod" onChange={() => setPaymentMethod(method)} type="radio" value={method} />{paymentMethodLabels[method]}</label>)}</div><p className="text-xs text-neutral-500">Payment is recorded for tracking only.</p></fieldset>
      <button className="mt-5 min-h-11 w-full bg-neutral-900 px-5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={lines.length === 0 || isSubmitting} onClick={submit} type="button">{isSubmitting ? "recording…" : "complete sale"}</button>
      {feedback ? <p aria-live="polite" className={`mt-4 text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-800"}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
    </aside>
  </div>;
}
