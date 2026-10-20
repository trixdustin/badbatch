"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  areIngredientUnitsCompatible,
  ingredientUnits,
  ingredientUnitDetails,
  ingredientUnitFamily,
  type IngredientUnit,
} from "@/lib/costing/units";

export type CostingIngredientOption = {
  id: string;
  name: string;
  purchaseUnit: IngredientUnit;
  costPerBaseUnit: string;
};

export type RecipeDraft = {
  version: number;
  batchYield: number;
  cookieWeight: string | null;
  packagingCostPerCookie: string;
  additionalDirectCostPerCookie: string;
  ingredients: Array<{
    ingredientId: string | null;
    quantity: string;
    unit: IngredientUnit;
  }>;
};

type DraftLine = { ingredientId: string; quantity: string; unit: IngredientUnit };

export function RecipeVersionEditor({
  productId,
  ingredients,
  recipe,
}: {
  productId: string;
  ingredients: CostingIngredientOption[];
  recipe: RecipeDraft | null;
}) {
  const router = useRouter();
  const firstIngredient = ingredients[0];
  const [batchYield, setBatchYield] = useState(String(recipe?.batchYield ?? 12));
  const [cookieWeight, setCookieWeight] = useState(recipe?.cookieWeight ?? "");
  const [packagingCost, setPackagingCost] = useState(recipe?.packagingCostPerCookie ?? "0.00");
  const [additionalCost, setAdditionalCost] = useState(recipe?.additionalDirectCostPerCookie ?? "0.00");
  const [lines, setLines] = useState<DraftLine[]>(() => recipe
    ? recipe.ingredients.map((line) => ({
        ingredientId: line.ingredientId ?? "",
        quantity: line.quantity,
        unit: line.unit,
      }))
    : firstIngredient
      ? [{ ingredientId: firstIngredient.id, quantity: "1", unit: firstIngredient.purchaseUnit }]
      : [],
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function addLine() {
    const ingredient = ingredients[0];
    if (ingredient) {
      setLines((current) => [...current, { ingredientId: ingredient.id, quantity: "1", unit: ingredient.purchaseUnit }]);
    }
  }

  const validLines = lines.length > 0 && lines.every((line) => {
    const ingredient = ingredients.find((item) => item.id === line.ingredientId);
    return ingredient && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0 &&
      areIngredientUnitsCompatible(ingredient.purchaseUnit, line.unit);
  });
  const canSave = validLines && Number.isInteger(Number(batchYield)) && Number(batchYield) > 0 &&
    Number.isFinite(Number(packagingCost)) && Number(packagingCost) >= 0 &&
    Number.isFinite(Number(additionalCost)) && Number(additionalCost) >= 0 &&
    (cookieWeight === "" || (Number.isFinite(Number(cookieWeight)) && Number(cookieWeight) > 0));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !canSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/recipes/${encodeURIComponent(productId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchYield: Number(batchYield),
          cookieWeight: cookieWeight === "" ? null : Number(cookieWeight),
          packagingCostPerCookie: Number(packagingCost),
          additionalDirectCostPerCookie: Number(additionalCost),
          ingredients: lines.map((line) => ({
            ingredientId: line.ingredientId,
            quantity: Number(line.quantity),
            unit: line.unit,
          })),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { version?: number; error?: string };
      if (!response.ok) {
        setFeedback({ kind: "error", text: result.error ?? "Could not save this recipe." });
        return;
      }
      setFeedback({ kind: "success", text: `Recipe version ${result.version} saved. Previous versions remain available below.` });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-5 border-t border-neutral-200 py-5" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-neutral-700">
          expected cookies per batch
          <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2 tabular-nums" max="100000" min="1" onChange={(event) => setBatchYield(event.target.value)} required step="1" type="number" value={batchYield} />
        </label>
        <label className="text-sm text-neutral-700">
          cookie weight in grams <span className="text-neutral-400">(optional)</span>
          <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2 tabular-nums" min="0.001" onChange={(event) => setCookieWeight(event.target.value)} step="0.001" type="number" value={cookieWeight} />
        </label>
        <label className="text-sm text-neutral-700">
          packaging per cookie (PHP)
          <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2 tabular-nums" min="0" onChange={(event) => setPackagingCost(event.target.value)} required step="0.01" type="number" value={packagingCost} />
        </label>
        <label className="text-sm text-neutral-700">
          other direct cost per cookie (PHP)
          <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2 tabular-nums" min="0" onChange={(event) => setAdditionalCost(event.target.value)} required step="0.01" type="number" value={additionalCost} />
        </label>
      </div>

      <fieldset className="grid gap-3 border-0 p-0" disabled={ingredients.length === 0 || saving}>
        <legend className="text-sm font-medium">Batch ingredients</legend>
        {lines.map((line, index) => {
          const selected = ingredients.find((item) => item.id === line.ingredientId);
          const units = selected
            ? ingredientUnits.filter((unit) => ingredientUnitFamily(unit) === ingredientUnitFamily(selected.purchaseUnit))
            : ingredientUnits;
          return (
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_140px_160px_auto]" key={`line-${index}`}>
              <label className="text-sm text-neutral-700">
                ingredient
                <select
                  className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2"
                  onChange={(event) => {
                    const next = ingredients.find((item) => item.id === event.target.value);
                    if (next) updateLine(index, { ingredientId: next.id, unit: next.purchaseUnit });
                  }}
                  required
                  value={line.ingredientId}
                >
                  {line.ingredientId === "" ? <option value="">Choose ingredient</option> : null}
                  {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
                </select>
              </label>
              <label className="text-sm text-neutral-700">
                batch quantity
                <input className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2 tabular-nums" min="0.001" onChange={(event) => updateLine(index, { quantity: event.target.value })} required step="0.001" type="number" value={line.quantity} />
              </label>
              <label className="text-sm text-neutral-700">
                unit
                <select className="mt-1 block min-h-10 w-full border border-neutral-300 bg-white px-2" onChange={(event) => updateLine(index, { unit: event.target.value as IngredientUnit })} value={line.unit}>
                  {units.map((unit) => <option key={unit} value={unit}>{ingredientUnitDetails(unit).label}</option>)}
                </select>
              </label>
              <button className="min-h-10 px-3 text-sm text-neutral-600 underline underline-offset-4" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} type="button">
                remove
              </button>
            </div>
          );
        })}
        <button className="min-h-10 w-fit border border-neutral-300 px-3 text-sm disabled:opacity-50" disabled={ingredients.length === 0} onClick={addLine} type="button">add ingredient</button>
        {ingredients.length === 0 ? <p className="text-sm text-neutral-600">Add an ingredient above before building this recipe.</p> : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button className="min-h-11 bg-neutral-900 px-5 text-sm text-white disabled:opacity-50" disabled={!canSave || saving} type="submit">
          {saving ? "saving version…" : recipe ? `save as version ${(recipe.version ?? 0) + 1}` : "save first recipe version"}
        </button>
        <p className="text-xs text-neutral-500">Saving creates a new immutable recipe and price snapshot.</p>
      </div>
      {feedback ? <p aria-live="polite" className={`text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-800"}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}</p> : null}
    </form>
  );
}
