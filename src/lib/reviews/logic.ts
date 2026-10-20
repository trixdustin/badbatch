import { createHmac } from "node:crypto";
import type { ReviewStatus } from "@prisma/client";

export type ReviewRatingCount = { rating: number; count: number };

export function summarizeRatings(counts: ReviewRatingCount[]) {
  const byRating = new Map(counts.map(({ rating, count }) => [rating, count]));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  const weighted = counts.reduce((sum, entry) => sum + entry.rating * entry.count, 0);
  return {
    count: total,
    average: total === 0 ? null : weighted / total,
    breakdown: [5, 4, 3, 2, 1].map((rating) => {
      const count = byRating.get(rating) ?? 0;
      return { rating, count, proportion: total === 0 ? 0 : count / total };
    }),
  };
}

export type ReviewPurchaseEvidence = {
  productId: string | null;
  orderId: string | null;
  order: {
    status: string;
    paymentStatus: string | null;
    items: Array<{ productId: string }>;
  } | null;
};

export function isVerifiedPurchase(review: ReviewPurchaseEvidence) {
  return Boolean(
    review.productId &&
      review.orderId &&
      review.order?.status === "COMPLETED" &&
      review.order.paymentStatus === "CONFIRMED" &&
      review.order.items.some((item) => item.productId === review.productId),
  );
}

export type ReviewModerationAction = "APPROVE" | "REJECT" | "HIDE";

export function canModerateReview(status: ReviewStatus | string, action: ReviewModerationAction) {
  if (status === "PENDING") return action === "APPROVE" || action === "REJECT";
  return status === "APPROVED" && action === "HIDE";
}

export function canAdminModerateReview(role: string, status: ReviewStatus | string, action: ReviewModerationAction) {
  return role === "ADMIN" && canModerateReview(status, action);
}

export function isPublicReview(status: ReviewStatus | string) {
  return status === "APPROVED";
}

export function createReviewFingerprint(input: {
  displayName: string;
  rating: number;
  body: string;
  productId: string | null;
  secret: string;
}) {
  const canonical = [
    input.displayName.trim().toLocaleLowerCase("en"),
    String(input.rating),
    input.body.trim().replace(/\s+/g, " ").toLocaleLowerCase("en"),
    input.productId ?? "all-cookies",
  ].join("\u001f");
  return createHmac("sha256", input.secret).update(canonical).digest("hex");
}

export function createRateLimitFingerprint(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip.trim()).digest("hex");
}
