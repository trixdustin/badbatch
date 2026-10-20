"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getProductLabel } from "@/lib/storefront/product-copy";

export type EditableProduct = {
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
};

type ProductResponse = { error?: string };
type DeleteResponse = { outcome?: "deleted" | "archived"; message?: string; error?: string };

const maxPrice = 100000;

function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0 || amount > maxPrice) return null;
  return Math.round(amount * 100) / 100;
}

export function ProductEditor({ product }: { product: EditableProduct }) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [subtitle, setSubtitle] = useState(product.subtitle);
  const [category, setCategory] = useState(product.category);
  const [description, setDescription] = useState(product.description);
  const [image, setImage] = useState(product.image);
  const [price, setPrice] = useState(product.price);
  const [isAvailable, setIsAvailable] = useState(product.isAvailable);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const label = getProductLabel(product.slug, undefined, name.trim());
  const parsedPrice = parsePrice(price);
  const trimmedName = name.trim();
  const nameIsValid = trimmedName.length >= 1 && trimmedName.length <= 120;
  const priceIsValid = parsedPrice !== null;
  const isDirty =
    name !== product.name ||
    subtitle !== product.subtitle ||
    category !== product.category ||
    description !== product.description ||
    image !== product.image ||
    price !== product.price ||
    isAvailable !== product.isAvailable;
  const canSave = isDirty && nameIsValid && priceIsValid && !isSaving;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    if (!nameIsValid) {
      setFeedback({ kind: "error", message: "Name is required (120 characters max)." });
      return;
    }
    if (parsedPrice === null) {
      setFeedback({ kind: "error", message: "Enter a valid price between 0 and 100000." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          subtitle: subtitle.trim(),
          category: category.trim(),
          description,
          image: image.trim(),
          price: parsedPrice,
          isAvailable,
        }),
      });
      const result: ProductResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({ kind: "error", message: result.error ?? "Could not update the product." });
        return;
      }
      setFeedback({ kind: "success", message: "Product updated." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeProduct() {
    if (isDeleting) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "DELETE",
      });
      const result: DeleteResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({ kind: "error", message: result.error ?? "Could not remove the product." });
        setConfirmingDelete(false);
        return;
      }
      setConfirmingDelete(false);
      setFeedback({
        kind: "success",
        message: result.message ?? "Product updated.",
      });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
      setConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <form className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10" onSubmit={save}>
      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {product.isSeasonal ? "limited batch" : "permanent batch"}
        </p>
        <h2 className="mt-2 text-xl font-medium">{label}</h2>
        <p className="mt-1 text-sm text-neutral-600">{subtitle || "Add a cookie subtitle"}</p>
        <p className="mt-1 font-mono text-xs text-neutral-500">{product.slug}</p>
      </div>

      <div className="grid gap-4">
        <fieldset className="grid gap-4 border-0 p-0" disabled={isSaving}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-neutral-700">
              cookie name
              <input
                className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm"
                maxLength={120}
                name="name"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>
            <label className="block text-sm text-neutral-700">
              subtitle
              <input
                className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm"
                maxLength={120}
                name="subtitle"
                onChange={(event) => setSubtitle(event.target.value)}
                value={subtitle}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-neutral-700">
              category
              <input
                className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm"
                maxLength={80}
                name="category"
                onChange={(event) => setCategory(event.target.value)}
                required
                value={category}
              />
            </label>
            <label className="block text-sm text-neutral-700">
              price (PHP)
              <input
                className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm tabular-nums"
                inputMode="decimal"
                max={maxPrice}
                min={0}
                name="price"
                onChange={(event) => setPrice(event.target.value)}
                step="0.01"
                type="number"
                value={price}
              />
            </label>
          </div>

          <label className="block text-sm text-neutral-700">
            image path
            <input
              className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm"
              maxLength={1000}
              name="image"
              onChange={(event) => setImage(event.target.value)}
              placeholder="/images/products/the-classic.jpg"
              value={image}
            />
          </label>

          <label className="block text-sm text-neutral-700">
            description
            <textarea
              className="mt-1 block min-h-20 w-full resize-y border border-neutral-300 bg-white px-3 py-2 text-sm"
              maxLength={2000}
              name="description"
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              value={description}
            />
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input
              checked={isAvailable}
              className="h-5 w-5"
              name="isAvailable"
              onChange={(event) => setIsAvailable(event.target.checked)}
              type="checkbox"
            />
            available to order
          </label>
        </fieldset>

        {parsedPrice === 0 ? (
          <p className="text-xs text-amber-700">
            Price is ₱0.00 — this product cannot be ordered until its price is set above ₱0, even when
            it is available and ordering is open.
          </p>
        ) : null}
        {!priceIsValid ? (
          <p className="text-xs text-red-700">Enter a valid price between 0 and 100000.</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button
            className="min-h-11 bg-neutral-900 px-5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSave}
            type="submit"
          >
            {isSaving ? "saving…" : "save changes"}
          </button>
          {isDirty && !isSaving ? <span className="text-xs text-neutral-500">unsaved changes</span> : null}
        </div>

        {feedback ? (
          <p
            aria-live="polite"
            className={`text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-800"}`}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}

        <div className="mt-2 border-t border-neutral-200 pt-4">
          {confirmingDelete ? (
            <div className="grid gap-3" role="group">
              <p className="text-sm">
                Remove <span className="font-medium">{label}</span> ({product.slug})?
              </p>
              <p className="text-xs text-neutral-500">
                This archives the cookie (hidden from new sales) while preserving its product ID,
                recipe-cost history, and any existing order and POS history. You can make it available
                again by editing the product.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="min-h-11 border border-red-700 px-5 text-sm text-red-700 disabled:cursor-wait disabled:opacity-60"
                  disabled={isDeleting}
                  onClick={removeProduct}
                  type="button"
                >
                  {isDeleting ? "removing…" : "confirm remove"}
                </button>
                <button
                  className="min-h-11 px-3 text-sm text-neutral-600 underline underline-offset-4"
                  disabled={isDeleting}
                  onClick={() => setConfirmingDelete(false)}
                  type="button"
                >
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="text-xs text-neutral-500 underline underline-offset-4 hover:text-red-700"
              onClick={() => {
                setFeedback(null);
                setConfirmingDelete(true);
              }}
              type="button"
            >
              remove cookie
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

