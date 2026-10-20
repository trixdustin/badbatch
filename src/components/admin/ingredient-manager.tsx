"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ingredientUnits, ingredientUnitDetails, type IngredientUnit } from "@/lib/costing/units";
import { formatPhp } from "@/lib/format/currency";

export type CostingIngredient = {
  id: string;
  name: string;
  purchaseQuantity: string;
  purchaseUnit: IngredientUnit;
  purchaseCost: string;
  costPerBaseUnit: string;
  supplier: string | null;
  notes: string | null;
  updatedAt: string;
};

type IngredientValues = {
  name: string;
  purchaseQuantity: number;
  purchaseUnit: IngredientUnit;
  purchaseCost: number;
  supplier: string;
  notes: string;
};

function normalizedCost(value: string, unit: IngredientUnit) {
  const { base } = ingredientUnitDetails(unit);
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(Number(value));
  return `${formatted} / ${base}`;
}

function IngredientForm({ ingredient }: { ingredient?: CostingIngredient }) {
  const router = useRouter();
  const [name, setName] = useState(ingredient?.name ?? "");
  const [quantity, setQuantity] = useState(ingredient?.purchaseQuantity ?? "");
  const [unit, setUnit] = useState<IngredientUnit>(ingredient?.purchaseUnit ?? "GRAM");
  const [cost, setCost] = useState(ingredient?.purchaseCost ?? "");
  const [supplier, setSupplier] = useState(ingredient?.supplier ?? "");
  const [notes, setNotes] = useState(ingredient?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const values: IngredientValues = {
        name,
        purchaseQuantity: Number(quantity),
        purchaseUnit: unit,
        purchaseCost: Number(cost),
        supplier,
        notes,
      };
      const response = await fetch(
        ingredient ? `/api/admin/ingredients/${encodeURIComponent(ingredient.id)}` : "/api/admin/ingredients",
        {
          method: ingredient ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback({ kind: "error", text: result.error ?? "Could not save the ingredient." });
        return;
      }
      setFeedback({ kind: "success", text: ingredient ? "Ingredient updated." : "Ingredient added." });
      if (!ingredient) {
        setName("");
        setQuantity("");
        setUnit("GRAM");
        setCost("");
        setSupplier("");
        setNotes("");
      }
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-4 border-t border-neutral-200 py-5" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm text-neutral-700">
          ingredient name
          <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2" maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label className="text-sm text-neutral-700">
          package quantity
          <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2 tabular-nums" inputMode="decimal" min="0.001" onChange={(event) => setQuantity(event.target.value)} required step="0.001" type="number" value={quantity} />
        </label>
        <label className="text-sm text-neutral-700">
          unit
          <select className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2" onChange={(event) => setUnit(event.target.value as IngredientUnit)} value={unit}>
            {ingredientUnits.map((value) => <option key={value} value={value}>{ingredientUnitDetails(value).label}</option>)}
          </select>
        </label>
        <label className="text-sm text-neutral-700">
          package cost (PHP)
          <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2 tabular-nums" inputMode="decimal" min="0.01" onChange={(event) => setCost(event.target.value)} required step="0.01" type="number" value={cost} />
        </label>
        <label className="text-sm text-neutral-700">
          supplier <span className="text-neutral-400">(optional)</span>
          <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2" maxLength={200} onChange={(event) => setSupplier(event.target.value)} value={supplier} />
        </label>
      </div>
      <label className="text-sm text-neutral-700">
        notes <span className="text-neutral-400">(optional)</span>
        <textarea className="mt-1 block min-h-16 w-full border border-neutral-300 bg-white px-2 py-2" maxLength={1000} onChange={(event) => setNotes(event.target.value)} rows={2} value={notes} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {ingredient ? (
          <p className="text-xs text-neutral-500">
            Current normalized cost: {normalizedCost(ingredient.costPerBaseUnit, ingredient.purchaseUnit)} · package {formatPhp(Number(ingredient.purchaseCost))}
          </p>
        ) : <p className="text-xs text-neutral-500">Cost is normalized to PHP per gram, milliliter, or unit.</p>}
        <button className="min-h-10 bg-neutral-900 px-4 text-sm text-white disabled:opacity-60" disabled={saving} type="submit">
          {saving ? "saving…" : ingredient ? "save ingredient" : "add ingredient"}
        </button>
      </div>
      {feedback ? <p aria-live="polite" className={`text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-800"}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}</p> : null}
    </form>
  );
}

export function IngredientManager({ ingredients }: { ingredients: CostingIngredient[] }) {
  return (
    <section aria-labelledby="ingredients-heading" className="mb-12">
      <h2 className="border-b border-neutral-300 pb-3 text-lg" id="ingredients-heading">Ingredients and current purchase prices</h2>
      <p className="py-3 text-sm text-neutral-600">Use grams or kilograms for mass, milliliters or liters for volume, and units for countable ingredients. Cross-family conversions need a separately maintained ingredient.</p>
      {ingredients.map((ingredient) => (
        <IngredientForm ingredient={ingredient} key={`${ingredient.id}-${ingredient.updatedAt}`} />
      ))}
      <IngredientForm key="new-ingredient" />
    </section>
  );
}
