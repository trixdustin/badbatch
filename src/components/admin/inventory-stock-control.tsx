"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InventoryReason } from "@prisma/client";
import { inventoryReasonLabels, isStockTracked, stockStateLabel } from "@/lib/inventory/stock";

type AdjustmentResponse = { stock?: number; error?: string; code?: string };

const reasons = [
  InventoryReason.RESTOCK,
  InventoryReason.WASTE,
  InventoryReason.CORRECTION,
] as const;

export function InventoryStockControl({
  productId,
  stock,
  isAvailable,
  lowStockThreshold,
}: {
  productId: string;
  stock: number | null;
  isAvailable: boolean;
  lowStockThreshold: number;
}) {
  const router = useRouter();
  const [change, setChange] = useState("");
  const [reason, setReason] = useState<InventoryReason>(InventoryReason.RESTOCK);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const state = stockStateLabel({ isAvailable, stock, lowStockThreshold });
  const parsedChange = change.trim() === "" ? null : Number(change);
  const changeIsValid =
    parsedChange !== null && Number.isInteger(parsedChange) && parsedChange !== 0;
  const projected =
    changeIsValid && isStockTracked(stock) ? stock + (parsedChange as number) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || !changeIsValid) return;

    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(productId)}/inventory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, change: parsedChange, reason, note }),
        },
      );
      const result: AdjustmentResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({ kind: "error", message: result.error ?? "Could not record the adjustment." });
        return;
      }
      setFeedback({ kind: "success", message: "Stock updated." });
      setChange("");
      setNote("");
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-3 border-t border-neutral-200 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-600">inventory</span>
        <span
          className={
            state.tone === "danger"
              ? "text-sm font-medium text-red-700"
              : state.tone === "warn"
                ? "text-sm font-medium text-amber-700"
                : state.tone === "ok"
                  ? "text-sm font-medium text-emerald-800"
                  : "text-sm text-neutral-500"
          }
        >
          {state.text}
        </span>
        {!isStockTracked(stock) ? (
          <span className="text-xs text-neutral-500">
            (not tracked — sold without a stock limit)
          </span>
        ) : null}
      </div>

      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        <label className="text-sm text-neutral-700">
          change <span className="text-neutral-400">(+/-)</span>
          <input
            className="mt-1 block min-h-11 w-28 border border-neutral-300 bg-white px-3 text-sm tabular-nums"
            inputMode="numeric"
            name="change"
            onChange={(event) => setChange(event.target.value)}
            placeholder={isStockTracked(stock) ? String(stock) : "0"}
            type="number"
            value={change}
          />
        </label>
        <label className="text-sm text-neutral-700">
          reason
          <select
            className="mt-1 block min-h-11 border border-neutral-300 bg-white px-3 text-sm"
            name="reason"
            onChange={(event) => setReason(event.target.value as InventoryReason)}
            value={reason}
          >
            {reasons.map((value) => (
              <option key={value} value={value}>
                {inventoryReasonLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-neutral-700">
          note <span className="text-neutral-400">(optional)</span>
          <input
            className="mt-1 block min-h-11 w-full min-w-48 border border-neutral-300 bg-white px-3 text-sm"
            maxLength={500}
            name="note"
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </label>
        <button
          className="min-h-11 border border-neutral-900 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!changeIsValid || isSaving}
          type="submit"
        >
          {isSaving ? "saving…" : "apply adjustment"}
        </button>
      </form>

      {changeIsValid && projected !== null ? (
        <p className={`text-xs ${projected < 0 ? "text-red-700" : "text-neutral-500"}`}>
          New stock would be {projected}
          {projected < 0 ? " — not allowed" : ""}.
        </p>
      ) : null}

      {feedback ? (
        <p
          aria-live="polite"
          className={`text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-800"}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
