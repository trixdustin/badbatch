"use client";

import { useState, type FormEvent } from "react";

export type ReviewProductOption = { id: string; name: string; subtitle: string };
type SubmissionResult = { error?: string; message?: string };

export function ReviewSubmissionForm({
  products,
  action = "/api/reviews",
  fixedProductId,
  heading = "Write a review",
}: {
  products: ReviewProductOption[];
  action?: string;
  fixedProductId?: string;
  heading?: string;
}) {
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const rating = Number(data.get("rating"));
    const productId = fixedProductId ?? (String(data.get("productId") ?? "") || null);
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          displayName: data.get("displayName"),
          body: data.get("body"),
          productId,
        }),
      });
      const result: SubmissionResult = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({ kind: "error", message: result.error ?? "Could not submit your review. Check the fields and try again." });
        return;
      }
      form.reset();
      setFeedback({ kind: "success", message: result.message ?? "Thanks. Your review is pending moderation." });
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <div className="mb-6">
        <p className="micro-label">customer notes</p>
        <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">{heading}</h2>
      </div>

      <fieldset className="review-fieldset" disabled={isSubmitting}>
        <legend className="review-label">your rating</legend>
        <div aria-describedby="review-rating-hint" className="review-rating-input">
          {[1, 2, 3, 4, 5].map((rating) => (
            <label className="review-rating-choice" key={rating}>
              <input name="rating" required type="radio" value={rating} />
              <span aria-hidden="true">{rating} ★</span>
              <span className="sr-only">{rating} {rating === 1 ? "star" : "stars"}</span>
            </label>
          ))}
        </div>
        <p className="review-hint" id="review-rating-hint">Choose one to five stars.</p>

        <label className="review-label mt-5 block" htmlFor="review-display-name">display name</label>
        <input
          autoComplete="name"
          className="review-input"
          id="review-display-name"
          maxLength={80}
          minLength={2}
          name="displayName"
          required
        />

        {!fixedProductId ? (
          <>
            <label className="review-label mt-5 block" htmlFor="review-product">cookie <span className="review-hint">(optional)</span></label>
            <select className="review-input" defaultValue="" id="review-product" name="productId">
              <option value="">all cookies</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}{product.subtitle ? ` — ${product.subtitle}` : ""}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="mt-5 text-sm text-[var(--cream-muted)]">
            for {products[0]?.name}{products[0]?.subtitle ? ` — ${products[0].subtitle}` : ""}
          </p>
        )}

        <label className="review-label mt-5 block" htmlFor="review-body">your review</label>
        <textarea
          className="review-input min-h-32 resize-y py-3"
          id="review-body"
          maxLength={1200}
          minLength={10}
          name="body"
          required
          rows={5}
        />
        <p className="review-hint mt-2">10–1,200 characters. Reviews are checked by the BAD BATCH team before they appear.</p>

        <button className="review-submit mt-6" disabled={isSubmitting} type="submit">
          {isSubmitting ? "sending…" : "submit review"}
        </button>
      </fieldset>

      {feedback ? (
        <p aria-live="polite" className={`mt-4 text-sm ${feedback.kind === "error" ? "text-red-400" : "text-emerald-700 dark:text-emerald-300"}`} role={feedback.kind === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}
