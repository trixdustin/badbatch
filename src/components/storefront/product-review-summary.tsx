import Link from "next/link";
import { ReviewStars } from "@/components/storefront/review-stars";
import { getApprovedReviewSummary } from "@/lib/reviews/summary";

export async function ProductReviewSummary({ productId, slug }: { productId: string; slug: string }) {
  const summary = await getApprovedReviewSummary(productId);
  return (
    <aside className="mt-8 border-y border-[var(--rule)] py-5" aria-label="Customer reviews for this cookie">
      {summary.count > 0 && summary.average !== null ? (
        <div className="flex flex-wrap items-center gap-3">
          <ReviewStars rating={summary.average} />
          <span className="text-sm tabular-nums">{summary.average.toFixed(1)} / 5</span>
          <span className="text-xs text-[var(--cream-muted)]">{summary.count} approved {summary.count === 1 ? "review" : "reviews"}</span>
        </div>
      ) : (
        <p className="text-sm text-[var(--cream-muted)]">No approved reviews yet.</p>
      )}
      <Link className="mt-3 inline-block text-xs underline underline-offset-4" href={`/reviews?product=${encodeURIComponent(slug)}`}>
        read cookie reviews
      </Link>
    </aside>
  );
}
