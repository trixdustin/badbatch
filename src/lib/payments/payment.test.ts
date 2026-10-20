import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrderConfirmationToken, verifyOrderConfirmationToken } from "@/lib/auth/order-confirmation";
import { sendPaymentConfirmedEmail } from "@/lib/email/notifications";
import { maxPaymentProofBytes, validatePaymentImage } from "@/lib/payments/proof";
import { canReviewPayment, canSubmitWebsiteProof } from "@/lib/payments/state";

test("website proof accepts a permitted image with matching bytes and MIME", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(validatePaymentImage(png, png.byteLength, "image/png"), "image/png");
});

test("website proof rejects wrong MIME, unrecognized files, and oversized images", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(validatePaymentImage(png, png.byteLength, "image/jpeg"), null);
  assert.equal(validatePaymentImage(Uint8Array.from([1, 2, 3]), 3, "image/png"), null);
  const oversized = new Uint8Array(maxPaymentProofBytes + 1);
  oversized.set(png);
  assert.equal(validatePaymentImage(oversized, oversized.byteLength, "image/png"), null);
});

test("signed order access rejects missing, invalid, and wrong-order tokens", async (context) => {
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-session-secret-32-characters-minimum";
  context.after(() => {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  });

  assert.equal(await verifyOrderConfirmationToken("invalid", "order-a"), false);
  const token = await createOrderConfirmationToken("order-a");
  assert.equal(await verifyOrderConfirmationToken(token, "order-a"), true);
  assert.equal(await verifyOrderConfirmationToken(token, "order-b"), false);
});

test("payment transitions allow first submission and rejected-proof resubmission only", () => {
  assert.equal(canSubmitWebsiteProof({ paymentStatus: "AWAITING_PAYMENT", orderStatus: "PENDING", hasPendingProof: false }), true);
  assert.equal(canSubmitWebsiteProof({ paymentStatus: "REJECTED", orderStatus: "PENDING", hasPendingProof: false }), true);
  assert.equal(canSubmitWebsiteProof({ paymentStatus: "PROOF_SUBMITTED", orderStatus: "PENDING", hasPendingProof: true }), false);
  assert.equal(canSubmitWebsiteProof({ paymentStatus: "CONFIRMED", orderStatus: "PENDING", hasPendingProof: false }), false);
  assert.equal(canSubmitWebsiteProof({ paymentStatus: "AWAITING_PAYMENT", orderStatus: "CANCELLED", hasPendingProof: false }), false);
  assert.equal(canReviewPayment({ paymentStatus: "PROOF_SUBMITTED", proofStatus: "PENDING" }), true);
  assert.equal(canReviewPayment({ paymentStatus: "REJECTED", proofStatus: "PENDING" }), false);
});

test("email-provider failure returns safely without throwing", async (context) => {
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  const previousFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "test-only-key";
  process.env.EMAIL_FROM = "test@example.invalid";
  globalThis.fetch = (async () => { throw new Error("simulated provider failure"); }) as typeof fetch;
  context.after(() => {
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;
    globalThis.fetch = previousFetch;
  });

  assert.equal(await sendPaymentConfirmedEmail({ to: "test@example.invalid", customerName: "Test", orderNumber: "000001", total: 10 }), false);
});
