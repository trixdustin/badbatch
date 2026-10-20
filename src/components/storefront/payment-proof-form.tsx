"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PaymentStatus } from "@prisma/client";

const labels: Record<PaymentStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PROOF_SUBMITTED: "Proof submitted",
  VERIFICATION_REQUIRED: "Verification required",
  CONFIRMED: "Payment confirmed",
  REJECTED: "Payment rejected",
};

export function PaymentProofForm({
  orderId,
  status,
  rejectionReason,
}: {
  orderId: string;
  status: PaymentStatus | null;
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("proof");
    if (!(file instanceof File) || file.size > 4 * 1024 * 1024) {
      setFeedback({ kind: "error", message: "Choose an image no larger than 4 MB." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(`/order/${encodeURIComponent(orderId)}/proof`, {
        method: "POST",
        body: form,
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setFeedback({ kind: "error", message: result.error ?? "Could not submit proof." });
        return;
      }
      setFeedback({ kind: "success", message: "Proof received. Payment is not confirmed yet; please wait for manual verification." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach BAD BATCH. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="payment-proof-heading" className="mt-10 border-y border-[var(--rule)] py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg" id="payment-proof-heading">Payment</h2>
        <p aria-live="polite" className="micro-label">{status ? labels[status] : "Awaiting payment"}</p>
      </div>

      {status === "PROOF_SUBMITTED" || status === "VERIFICATION_REQUIRED" ? (
        <p className="mt-4 text-sm leading-6 text-[var(--cream-muted)]">
          Your proof is awaiting manual review. Do not send another proof while this one is under review.
        </p>
      ) : status === "CONFIRMED" ? (
        <p className="mt-4 text-sm leading-6 text-[var(--cream-muted)]">
          Payment was verified by BAD BATCH. Fulfillment details will be confirmed separately.
        </p>
      ) : (
        <>
          {status === "REJECTED" ? (
            <div className="mt-4 border-l-2 border-[var(--accent)] pl-4 text-sm leading-6">
              <p>Your last proof was rejected. You may submit a new screenshot.</p>
              {rejectionReason ? <p className="mt-2 text-[var(--cream-muted)]">Reason: {rejectionReason}</p> : null}
            </div>
          ) : null}
          <form className="mt-5 grid gap-4" onSubmit={submit}>
            <label className="field-label">
              Upload payment screenshot (JPG, PNG, or WebP; up to 4 MB)
              <input
                accept="image/jpeg,image/png,image/webp"
                className="field-control file:mr-3 file:border-0 file:bg-transparent file:text-[var(--cream)]"
                name="proof"
                required
                type="file"
              />
            </label>
            <label className="field-label">
              GCash reference number <span className="text-[var(--silver)]">(optional)</span>
              <input className="field-control" maxLength={120} name="reference" />
            </label>
            <p className="text-xs leading-5 text-[var(--cream-muted)]">
              Your screenshot is stored privately with this order. Uploading proof does not mark payment as confirmed.
            </p>
            {feedback ? (
              <p aria-live="polite" className={`text-sm ${feedback.kind === "error" ? "text-[var(--storefront-danger)]" : "text-[var(--cream-muted)]"}`} role={feedback.kind === "error" ? "alert" : "status"}>
                {feedback.message}
              </p>
            ) : null}
            <button className="editorial-button w-full sm:w-auto" disabled={submitting} type="submit">
              {submitting ? "uploading…" : "submit payment proof"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
