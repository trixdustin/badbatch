export type PaymentWorkflowStatus = "AWAITING_PAYMENT" | "PROOF_SUBMITTED" | "VERIFICATION_REQUIRED" | "CONFIRMED" | "REJECTED" | null;

export function canSubmitWebsiteProof(input: {
  paymentStatus: PaymentWorkflowStatus;
  orderStatus: string;
  hasPendingProof: boolean;
}) {
  return input.orderStatus !== "CANCELLED" &&
    !input.hasPendingProof &&
    (input.paymentStatus === null || input.paymentStatus === "AWAITING_PAYMENT" || input.paymentStatus === "REJECTED");
}

export function canRecordInstagramProof(input: {
  paymentStatus: PaymentWorkflowStatus;
  orderStatus: string;
  hasPendingProof: boolean;
}) {
  return canSubmitWebsiteProof(input);
}

export function canReviewPayment(input: {
  paymentStatus: PaymentWorkflowStatus;
  proofStatus: string;
}) {
  return input.proofStatus === "PENDING" &&
    (input.paymentStatus === "PROOF_SUBMITTED" || input.paymentStatus === "VERIFICATION_REQUIRED");
}
