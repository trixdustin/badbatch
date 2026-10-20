"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type CreateResponse = { id?: string; error?: string; code?: string };

const maxPrice = 100000;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0 || amount > maxPrice) return null;
  return Math.round(amount * 100) / 100;
}

export function ProductCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState("cookie");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isSeasonal, setIsSeasonal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const effectiveSlug = slugEdited ? slug.trim() : slugify(name);
  const trimmedName = name.trim();
  const nameIsValid = trimmedName.length >= 1 && trimmedName.length <= 120;
  const slugIsValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(effectiveSlug) && effectiveSlug.length <= 140;
  const parsedPrice = parsePrice(price);
  const priceIsValid = parsedPrice !== null;
  const canSubmit = nameIsValid && slugIsValid && priceIsValid && !isSaving;

  function reset() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setSubtitle("");
    setCategory("cookie");
    setDescription("");
    setPrice("");
    setImage("");
    setIsAvailable(true);
    setIsSeasonal(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    if (!nameIsValid || !slugIsValid || parsedPrice === null) {
      setFeedback({ kind: "error", message: "Check the required fields (name, slug, price) and try again." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: effectiveSlug,
          subtitle: subtitle.trim(),
          category: category.trim(),
          description,
          image: image.trim(),
          price: parsedPrice,
          isAvailable,
          isSeasonal,
        }),
      });
      const result: CreateResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.code === "DUPLICATE_SLUG") {
          setFeedback({ kind: "error", message: "A product with this slug already exists. Choose a different slug." });
        } else {
          setFeedback({ kind: "error", message: result.error ?? "Could not create the product." });
        }
        return;
      }
      setFeedback({ kind: "success", message: "Cookie added." });
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mb-8 border border-neutral-300">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-neutral-600">Add a new cookie to the menu.</p>
        <button
          aria-expanded={open}
          className="min-h-11 bg-neutral-900 px-5 text-sm text-white"
          onClick={() => {
            setOpen((value) => !value);
            setFeedback(null);
          }}
          type="button"
        >
          {open ? "cancel" : "add cookie"}
        </button>
      </div>

      {open ? (
        <form className="grid gap-4 border-t border-neutral-300 p-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-neutral-700">
              name
              <input
                className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm"
                maxLength={120}
                name="name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label className="block text-sm text-neutral-700">
              slug <span className="text-neutral-400">(auto-generated, editable)</span>
              <input
                className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 font-mono text-sm"
                maxLength={140}
                name="slug"
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value);
                }}
                placeholder={slugify(name) || "my-new-cookie"}
                value={effectiveSlug}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-neutral-700">
              price (PHP)
              <input
                className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm tabular-nums"
                inputMode="decimal"
                max={maxPrice}
                min={0}
                name="price"
                onChange={(event) => setPrice(event.target.value)}
                placeholder="150.00"
                required
                step="0.01"
                type="number"
                value={price}
              />
            </label>
            <label className="block text-sm text-neutral-700">
              image path <span className="text-neutral-400">(optional)</span>
              <input
                className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm"
                maxLength={1000}
                name="image"
                onChange={(event) => setImage(event.target.value)}
                placeholder="/images/products/my-new-cookie.jpg"
                value={image}
              />
            </label>
          </div>

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

          <div className="flex flex-wrap gap-6">
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
            <label className="flex items-center gap-3 text-sm">
              <input
                checked={isSeasonal}
                className="h-5 w-5"
                name="isSeasonal"
                onChange={(event) => setIsSeasonal(event.target.checked)}
                type="checkbox"
              />
              seasonal
            </label>
          </div>

          <p className="text-xs text-neutral-500">
            A new cookie can only be purchased once its price is above ₱0.00 and it is marked available.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              className="min-h-11 bg-neutral-900 px-5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit}
              type="submit"
            >
              {isSaving ? "creating…" : "create cookie"}
            </button>
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
        </form>
      ) : null}
    </div>
  );
}

