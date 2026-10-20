"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PaymentProofMethod, PaymentStatus } from "@prisma/client";

type PendingProof = { id: string; method: PaymentProofMethod; reference: string | null };

export function OrderPaymentControls({
  orderId,
  status,
  pendingProof,
}: {
  orderId: string;
  status: PaymentStatus | null;
  pendingProof: PendingProof | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reference, setReference] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const canRecordInstagram = !pendingProof && (status === null || status === "AWAITING_PAYMENT" || status === "REJECTED");

  async function send(url: string, method: "POST" | "PATCH", body: object) {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setFeedback({ error: true, text: result.error ?? "Could not update payment." });
        return;
      }
      setFeedback({ error: false, text: "Payment record updated." });
      router.refresh();
    } catch {
      setFeedback({ error: true, text: "Could not reach the server. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function recordInstagram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return send(`/api/admin/orders/${encodeURIComponent(orderId)}/payment`, "POST", { reference, internalNote });
  }

  return (
    <div className="mt-5 grid gap-5">
      {canRecordInstagram ? (
        <form className="grid gap-3 border-t border-neutral-200 pt-4" onSubmit={recordInstagram}>
          <h3 className="text-sm font-medium">Record Instagram proof received</h3>
          <label className="text-xs text-neutral-600">
            payment reference (optional)
            <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-3 text-sm" maxLength={120} onChange={(event) => setReference(event.target.value)} value={reference} />
          </label>
          <label className="text-xs text-neutral-600">
            internal note (optional; not shown to customer)
            <textarea className="mt-1 block min-h-20 w-full border border-neutral-300 bg-white px-3 py-2 text-sm" maxLength={1000} onChange={(event) => setInternalNote(event.target.value)} value={internalNote} />
          </label>
          <button className="min-h-10 w-fit bg-neutral-900 px-4 text-sm text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "saving…" : "record proof received"}</button>
        </form>
      ) : null}

      {pendingProof ? (
        <div className="grid gap-3 border-t border-neutral-200 pt-4">
          <h3 className="text-sm font-medium">Review submitted proof</h3>
          {pendingProof.reference ? <p className="text-sm">Reference: <span className="font-mono">{pendingProof.reference}</span></p> : <p className="text-sm text-neutral-600">No payment reference provided.</p>}
          <label className="text-xs text-neutral-600">
            rejection reason (optional; shown to customer)
            <textarea className="mt-1 block min-h-16 w-full border border-neutral-300 bg-white px-3 py-2 text-sm" maxLength={1000} onChange={(event) => setRejectionReason(event.target.value)} value={rejectionReason} />
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="min-h-10 bg-neutral-900 px-4 text-sm text-white disabled:opacity-60" disabled={busy} onClick={() => send(`/api/admin/orders/${encodeURIComponent(orderId)}/payment`, "PATCH", { proofId: pendingProof.id, action: "VERIFY" })} type="button">{busy ? "saving…" : "verify payment"}</button>
            <button className="min-h-10 border border-red-700 px-4 text-sm text-red-700 disabled:opacity-60" disabled={busy} onClick={() => send(`/api/admin/orders/${encodeURIComponent(orderId)}/payment`, "PATCH", { proofId: pendingProof.id, action: "REJECT", rejectionReason })} type="button">reject proof</button>
          </div>
        </div>
      ) : null}

      {feedback ? <p aria-live="polite" className={`text-sm ${feedback.error ? "text-red-700" : "text-green-800"}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</p> : null}
    </div>
  );
}
