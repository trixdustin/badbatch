"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewStars } from "@/components/storefront/review-stars";

export type ModerationReview = {
  id: string;
  displayName: string;
  rating: number;
  body: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  createdAt: string;
  product: { name: string; subtitle: string } | null;
  verifiedPurchase: boolean;
};

const actions = {
  PENDING: ["APPROVE", "REJECT"],
  APPROVED: ["HIDE"],
  REJECTED: [],
  HIDDEN: [],
} as const;

export function ReviewModerationList({ reviews }: { reviews: ModerationReview[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; message: string } | null>(null);

  async function moderate(id: string, action: string) {
    if (pendingId) return;
    setPendingId(id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback({ id, message: result.error ?? "Could not update this review." });
        return;
      }
      router.refresh();
    } catch {
      setFeedback({ id, message: "Could not reach the server. Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  if (reviews.length === 0) {
    return <p className="border-y border-neutral-300 py-10 text-sm text-neutral-600">No reviews match these filters.</p>;
  }

  return (
    <div className="divide-y divide-neutral-200">
      {reviews.map((review) => (
        <article className="py-6" key={review.id}>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <ReviewStars label={`${review.rating} out of 5 stars`} rating={review.rating} />
                <span className="font-medium">{review.displayName}</span>
                {review.verifiedPurchase ? <span className="rounded-full border border-neutral-300 px-2 py-1 text-[10px] text-neutral-600">verified purchase</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6">{review.body}</p>
              <p className="mt-3 text-xs text-neutral-500">
                {review.product ? `${review.product.name}${review.product.subtitle ? ` — ${review.product.subtitle}` : ""}` : "All cookies"}
                {" · "}{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(review.createdAt))}
                {" · "}{review.status.toLowerCase()}
              </p>
              {feedback?.id === review.id ? <p aria-live="polite" className="mt-3 text-sm text-red-700" role="alert">{feedback.message}</p> : null}
            </div>
            {actions[review.status].length ? (
              <div className="flex flex-wrap gap-2">
                {actions[review.status].map((action) => (
                  <button
                    className="min-h-10 border border-neutral-300 px-3 text-xs hover:border-neutral-600 disabled:opacity-60"
                    disabled={pendingId !== null}
                    key={action}
                    onClick={() => moderate(review.id, action)}
                    type="button"
                  >
                    {pendingId === review.id ? "saving…" : action === "HIDE" ? "hide review" : action === "APPROVE" ? "approve" : "reject"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
