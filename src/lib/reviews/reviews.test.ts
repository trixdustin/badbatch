import assert from "node:assert/strict";
import { test } from "node:test";
import { publicReviewSchema, verifiedReviewSchema } from "@/lib/validation/review";
import {
  canAdminModerateReview,
  createReviewFingerprint,
  isPublicReview,
  isVerifiedPurchase,
  summarizeRatings,
} from "@/lib/reviews/logic";

test("review input validates rating, display name, body limits, and optional product", () => {
  assert.equal(publicReviewSchema.safeParse({ rating: 5, displayName: "  Kai  ", body: "  Great cookie!  ", productId: null }).success, true);
  assert.equal(publicReviewSchema.safeParse({ rating: 6, displayName: "K", body: "short", productId: "p" }).success, false);
  assert.equal(publicReviewSchema.safeParse({ rating: 4, displayName: "Kai", body: "A thoughtful review.", isVerified: true }).success, false);
  assert.equal(verifiedReviewSchema.safeParse({ rating: 4, displayName: "Kai", body: "A thoughtful review.", productId: "p" }).success, true);
  assert.equal(verifiedReviewSchema.safeParse({ rating: 4, displayName: "Kai", body: "A thoughtful review." }).success, false);
});

test("review summaries include only the supplied approved rating counts", () => {
  const summary = summarizeRatings([{ rating: 5, count: 2 }, { rating: 3, count: 1 }]);
  assert.equal(summary.count, 3);
  assert.equal(summary.average, 13 / 3);
  assert.deepEqual(summary.breakdown.map((item) => [item.rating, item.count]), [[5, 2], [4, 0], [3, 1], [2, 0], [1, 0]]);
  assert.equal(summarizeRatings([]).average, null);
});

test("only completed, payment-confirmed orders containing the cookie qualify as verified", () => {
  const valid = { productId: "cookie-a", orderId: "order-a", order: { status: "COMPLETED", paymentStatus: "CONFIRMED", items: [{ productId: "cookie-a" }] } };
  assert.equal(isVerifiedPurchase(valid), true);
  assert.equal(isVerifiedPurchase({ ...valid, order: { ...valid.order, paymentStatus: "AWAITING_PAYMENT" } }), false);
  assert.equal(isVerifiedPurchase({ ...valid, order: { ...valid.order, status: "CANCELLED" } }), false);
  assert.equal(isVerifiedPurchase({ ...valid, order: { ...valid.order, items: [{ productId: "cookie-b" }] } }), false);
  assert.equal(isVerifiedPurchase({ ...valid, orderId: null }), false);
});

test("public review visibility and admin-only moderation actions are enforced by shared rules", () => {
  assert.equal(isPublicReview("APPROVED"), true);
  assert.equal(isPublicReview("PENDING"), false);
  assert.equal(isPublicReview("HIDDEN"), false);
  assert.equal(canAdminModerateReview("CUSTOMER", "PENDING", "APPROVE"), false);
  assert.equal(canAdminModerateReview("ADMIN", "PENDING", "APPROVE"), true);
  assert.equal(canAdminModerateReview("ADMIN", "APPROVED", "HIDE"), true);
  assert.equal(canAdminModerateReview("ADMIN", "REJECTED", "APPROVE"), false);
});

test("review fingerprints are deterministic and reject exact repeats without storing emails", () => {
  const input = { displayName: "Kai", rating: 5, body: "A great cookie.", productId: "cookie-a", secret: "test-session-secret" };
  assert.equal(createReviewFingerprint(input), createReviewFingerprint({ ...input, body: " A   GREAT COOKIE. " }));
  assert.notEqual(createReviewFingerprint(input), createReviewFingerprint({ ...input, productId: "cookie-b" }));
  assert.notEqual(createReviewFingerprint(input), createReviewFingerprint({ ...input, secret: "other-secret" }));
});
