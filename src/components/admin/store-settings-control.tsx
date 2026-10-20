"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type EditableSettings = {
  orderingEnabled: boolean;
  announcement: string;
  seasonalProductId: string | null;
};

export type SeasonalOption = { id: string; name: string };

type SettingsResponse = { error?: string };

export function StoreSettingsControl({
  settings,
  seasonalProducts,
}: {
  settings: EditableSettings;
  seasonalProducts: SeasonalOption[];
}) {
  const router = useRouter();
  const [orderingEnabled, setOrderingEnabled] = useState(settings.orderingEnabled);
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [seasonalProductId, setSeasonalProductId] = useState(settings.seasonalProductId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderingEnabled,
          announcement,
          seasonalProductId: seasonalProductId === "" ? null : seasonalProductId,
        }),
      });
      const result: SettingsResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({ kind: "error", message: result.error ?? "Could not update store settings." });
        // Never imply ordering changed when the save failed.
        setOrderingEnabled(settings.orderingEnabled);
        return;
      }
      setFeedback({ kind: "success", message: "Store settings updated." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Could not reach the server. Please try again." });
      setOrderingEnabled(settings.orderingEnabled);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="grid max-w-xl gap-6" onSubmit={save}>
      <p className="border-y border-neutral-300 py-3 text-sm">
        Online ordering is currently{" "}
        <span className="font-medium">{settings.orderingEnabled ? "open" : "closed"}</span>.
      </p>

      <fieldset className="grid gap-6 border-0 p-0" disabled={isSaving}>
        <label className="flex items-center gap-3 text-sm">
          <input
            checked={orderingEnabled}
            className="h-5 w-5"
            name="orderingEnabled"
            onChange={(event) => setOrderingEnabled(event.target.checked)}
            type="checkbox"
          />
          accept online orders
        </label>

        <label className="block text-sm text-neutral-700">
          announcement
          <textarea
            className="mt-1 block min-h-20 w-full resize-y border border-neutral-300 bg-white px-3 py-2 text-sm"
            maxLength={500}
            name="announcement"
            onChange={(event) => setAnnouncement(event.target.value)}
            placeholder="Optional note shown on the dashboard."
            rows={2}
            value={announcement}
          />
        </label>

        <label className="block text-sm text-neutral-700">
          seasonal product
          <select
            className="mt-1 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm"
            name="seasonalProductId"
            onChange={(event) => setSeasonalProductId(event.target.value)}
            value={seasonalProductId}
          >
            <option value="">none</option>
            {seasonalProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <p className="text-xs text-neutral-500">
        Opening ordering does not make unavailable or zero-priced products orderable. Checkout still
        verifies that each product is available and priced above $0.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <button
          className="min-h-11 bg-neutral-900 px-5 text-sm text-white disabled:cursor-wait disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "saving…" : "save settings"}
        </button>
      </div>

      {feedback ? (
        <p
          aria-live="polite"
          className={`text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-800"}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}
