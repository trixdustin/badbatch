"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function InventoryThresholdControl({
  productId,
  threshold,
}: {
  productId: string;
  threshold: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(threshold));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(value);
    if (value.trim() === "" || !Number.isInteger(parsed) || parsed < 0 || parsed > 1000000 || parsed === threshold || isSaving) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: parsed }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback(result.error ?? "Could not update the threshold.");
        return;
      }
      setFeedback("Threshold saved.");
      router.refresh();
    } catch {
      setFeedback("Could not reach the server.");
    } finally {
      setIsSaving(false);
    }
  }

  const parsed = Number(value);
  const canSave = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 1000000 && parsed !== threshold;

  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={save}>
      <label className="sr-only" htmlFor={`threshold-${productId}`}>
        Low stock threshold
      </label>
      <input
        className="min-h-10 w-20 border border-neutral-300 bg-white px-2 text-sm tabular-nums"
        id={`threshold-${productId}`}
        max={1000000}
        min={0}
        onChange={(event) => setValue(event.target.value)}
        required
        type="number"
        value={value}
      />
      <button
        className="min-h-10 border border-neutral-900 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canSave || isSaving}
        type="submit"
      >
        {isSaving ? "saving…" : "save"}
      </button>
      {feedback ? <span className="text-xs text-neutral-500" role="status">{feedback}</span> : null}
    </form>
  );
}
