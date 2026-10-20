"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { availableOrderTransitions, nextActionLabel } from "@/lib/orders/workflow";

type StatusResponse = { status?: OrderStatus; error?: string };

export function OrderStatusControl({
  currentStatus,
  orderId,
}: {
  currentStatus: OrderStatus;
  orderId: string;
}) {
  const router = useRouter();
  const nextStatuses = availableOrderTransitions(currentStatus);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const isSaving = pendingStatus !== null;

  async function updateStatus(status: OrderStatus) {
    if (isSaving) return;

    setPendingStatus(status);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result: StatusResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({ kind: "error", message: result.error ?? "Could not update the order status." });
        return;
      }
      setFeedback({ kind: "success", message: `Order moved to ${status.toLowerCase()}.` });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <div className="w-full max-w-md">
      {nextStatuses.length > 0 ? (
        <div className="flex flex-wrap gap-3 sm:justify-end">
          {nextStatuses.map((status) => {
            const isCancel = status === "CANCELLED";
            const isPending = pendingStatus === status;
            return (
              <button
                aria-label={`${nextActionLabel(status)} — move to ${status.toLowerCase()}`}
                className={
                  isCancel
                    ? "min-h-11 border border-red-700 px-4 text-sm text-red-700 disabled:cursor-wait disabled:opacity-60"
                    : "min-h-11 bg-neutral-900 px-4 text-sm text-white disabled:cursor-wait disabled:opacity-60"
                }
                disabled={isSaving}
                key={status}
                onClick={() => updateStatus(status)}
                type="button"
              >
                {isPending ? "saving…" : nextActionLabel(status)}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-neutral-600 sm:text-right">This order is closed to further status changes.</p>
      )}
      {feedback ? (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-800"}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}

