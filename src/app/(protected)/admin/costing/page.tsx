import { connection } from "next/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { IngredientManager, type CostingIngredient } from "@/components/admin/ingredient-manager";
import { RecipeVersionEditor, type RecipeDraft } from "@/components/admin/recipe-version-editor";
import { PageIntro } from "@/components/shared/page-intro";
import { formatStoreDateTime } from "@/lib/admin/reporting";
import { calculateRecipeCost } from "@/lib/costing/estimate";
import { ingredientUnitDetails, ingredientUnitFactor, ingredientUnitFamily } from "@/lib/costing/units";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { formatPhp } from "@/lib/format/currency";

export const instant = false;

function precisePhp(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(value);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default async function AdminCostingPage() {
  await connection();
  await requireAdminPage();

  const [ingredientRecords, productRecords] = await Promise.all([
    prisma.ingredient.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        purchaseQuantity: true,
        purchaseUnit: true,
        purchaseCost: true,
        costPerBaseUnit: true,
        supplier: true,
        notes: true,
        updatedAt: true,
      },
    }),
    prisma.product.findMany({
      orderBy: [{ isSeasonal: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        recipe: {
          select: {
            versions: {
              orderBy: { version: "desc" },
              take: 6,
              select: {
                id: true,
                version: true,
                batchYield: true,
                sellingPriceSnapshot: true,
                cookieWeight: true,
                packagingCostPerCookie: true,
                additionalDirectCostPerCookie: true,
                createdAt: true,
                ingredients: {
                  orderBy: { ingredientName: "asc" },
                  select: {
                    id: true,
                    ingredientId: true,
                    ingredientName: true,
                    quantity: true,
                    unit: true,
                    costPerBaseUnitSnapshot: true,
                    ingredientCostSnapshot: true,
                    ingredient: {
                      select: {
                        id: true,
                        name: true,
                        purchaseUnit: true,
                        costPerBaseUnit: true,
                        updatedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const ingredients: CostingIngredient[] = ingredientRecords.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
    purchaseQuantity: ingredient.purchaseQuantity.toFixed(3),
    purchaseUnit: ingredient.purchaseUnit,
    purchaseCost: ingredient.purchaseCost.toFixed(2),
    costPerBaseUnit: ingredient.costPerBaseUnit.toFixed(8),
    supplier: ingredient.supplier,
    notes: ingredient.notes,
    updatedAt: ingredient.updatedAt.toISOString(),
  }));

  const products = productRecords.map((product) => {
    const versions = product.recipe?.versions ?? [];
    const latest = versions[0] ?? null;
    const recipeDraft: RecipeDraft | null = latest ? {
      version: latest.version,
      batchYield: latest.batchYield,
      cookieWeight: latest.cookieWeight?.toFixed(3) ?? null,
      packagingCostPerCookie: latest.packagingCostPerCookie.toFixed(2),
      additionalDirectCostPerCookie: latest.additionalDirectCostPerCookie.toFixed(2),
      ingredients: latest.ingredients.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: line.quantity.toFixed(3),
        unit: line.unit,
      })),
    } : null;
    const estimate = latest ? calculateRecipeCost({
      batchYield: latest.batchYield,
      packagingCostPerCookie: Number(latest.packagingCostPerCookie),
      additionalDirectCostPerCookie: Number(latest.additionalDirectCostPerCookie),
      sellingPrice: Number(product.price),
      ingredients: latest.ingredients.map((line) => ({
        quantity: Number(line.quantity),
        unit: line.unit,
        ingredientUnit: line.ingredient?.purchaseUnit ?? null,
        costPerBaseUnit: line.ingredient ? Number(line.ingredient.costPerBaseUnit) : null,
      })),
    }) : null;
    const incompleteLines = latest?.ingredients.filter((line) =>
      !line.ingredient || ingredientUnitFamily(line.unit) !== ingredientUnitFamily(line.ingredient.purchaseUnit),
    ) ?? [];

    return {
      ...product,
      currentPrice: product.price.toFixed(2),
      latest,
      recipeDraft,
      estimate,
      incompleteLines,
      versions,
    };
  });

  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="operations" title="Cookie costing">
        Maintain ingredient prices and recipe versions. Estimates show direct costs and gross profit only; they are not net profit.
      </PageIntro>

      <p className="mb-10 border-y border-neutral-300 py-4 text-sm text-neutral-600">
        Labor, rent, utilities, taxes, delivery fees, and other overhead are excluded unless you enter a direct cost per cookie below. Costing does not change product selling prices or historical sales.
      </p>

      <IngredientManager ingredients={ingredients} />

      <section aria-labelledby="recipe-costing-heading">
        <h2 className="mb-3 border-b border-neutral-300 pb-3 text-lg" id="recipe-costing-heading">Recipes and estimated margins</h2>
        <p className="mb-5 text-sm text-neutral-600">Each save creates a new immutable recipe and price snapshot. Current estimates use the latest recipe quantities and current ingredient prices.</p>
        <div className="divide-y divide-neutral-300">
          {products.map((product) => {
            const latest = product.latest;
            return (
              <article className="py-7" key={product.id}>
                <header className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-medium">{product.name}</h3>
                    <p className="mt-1 font-mono text-xs text-neutral-500">{product.slug}</p>
                  </div>
                  <p className="text-sm text-neutral-600">Current selling price: <span className="font-medium tabular-nums">{formatPhp(Number(product.currentPrice))}</span></p>
                </header>

                {!latest ? (
                  <p className="my-5 border-y border-neutral-200 py-4 text-sm text-neutral-600">No recipe saved. No cost or profit estimate is shown.</p>
                ) : product.estimate ? (
                  <>
                    <p className="mt-4 text-xs text-neutral-500">
                      Current estimate from recipe v{latest.version}, saved {formatStoreDateTime(latest.createdAt)}; yield {latest.batchYield} cookies{latest.cookieWeight ? ` at ${latest.cookieWeight.toFixed(3)} g each` : ""}; uses current ingredient prices.
                    </p>
                    <dl className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-5">
                      <CostMetric label="Ingredient cost / batch" value={formatPhp(product.estimate.ingredientCostPerBatch)} />
                      <CostMetric label="Ingredient cost / cookie" value={formatPhp(product.estimate.ingredientCostPerCookie)} />
                      <CostMetric label="Total direct cost / batch" value={formatPhp(product.estimate.totalDirectCostPerBatch)} />
                      <CostMetric label="Packaging / cookie" value={formatPhp(Number(latest.packagingCostPerCookie))} />
                      <CostMetric label="Other direct cost / cookie" value={formatPhp(Number(latest.additionalDirectCostPerCookie))} />
                      <CostMetric label="Estimated direct cost / cookie" value={formatPhp(product.estimate.totalDirectCostPerCookie)} />
                      <CostMetric label="Estimated gross profit / cookie" value={formatPhp(product.estimate.estimatedGrossProfitPerCookie)} />
                      <CostMetric label="Estimated gross margin" value={product.estimate.estimatedGrossMarginPercentage === null ? "Unavailable at ₱0 price" : `${product.estimate.estimatedGrossMarginPercentage.toFixed(1)}%`} />
                    </dl>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                        <thead><tr className="border-b border-neutral-300 text-neutral-600"><th className="py-2 pr-4 font-normal">ingredient</th><th className="py-2 pr-4 font-normal">recipe quantity</th><th className="py-2 pr-4 font-normal">current normalized price</th><th className="py-2 pr-4 font-normal">price updated</th><th className="py-2 text-right font-normal">estimated batch cost</th></tr></thead>
                        <tbody>
                          {latest.ingredients.map((line) => {
                            const liveCost = line.ingredient ? Number(line.ingredient.costPerBaseUnit) : null;
                            const quantityCost = liveCost === null ? null : roundCurrency(Number(line.quantity) * ingredientUnitFactor(line.unit) * liveCost);
                            return (
                              <tr className="border-b border-neutral-200" key={line.id}>
                                <td className="py-2 pr-4">{line.ingredient?.name ?? `${line.ingredientName} (missing)`}</td>
                                <td className="py-2 pr-4 tabular-nums">{line.quantity.toFixed(3)} {ingredientUnitDetails(line.unit).label}</td>
                                <td className="py-2 pr-4 tabular-nums">{line.ingredient ? precisePhp(liveCost as number) + ` / ${ingredientUnitDetails(line.ingredient.purchaseUnit).base}` : "Missing current ingredient"}</td>
                                <td className="py-2 pr-4 text-xs text-neutral-500">{line.ingredient ? formatStoreDateTime(line.ingredient.updatedAt) : "—"}</td>
                                <td className="py-2 text-right tabular-nums">{quantityCost === null ? "Incomplete" : formatPhp(quantityCost)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="my-5 border-y border-amber-700/40 py-4 text-sm">
                    <p className="font-medium text-amber-800">Costing incomplete. Profit and margin estimates are hidden.</p>
                    <ul className="mt-2 list-disc pl-5 text-neutral-600">
                      {product.incompleteLines.map((line) => (
                        <li key={line.id}>{line.ingredientName}: {line.ingredient ? "unit family does not match the recipe" : "current ingredient price is unavailable"}</li>
                      ))}
                      {product.incompleteLines.length === 0 ? <li>Add at least one complete recipe ingredient.</li> : null}
                    </ul>
                  </div>
                )}

                {product.versions.length > 0 ? (
                  <details className="my-5 border-y border-neutral-200 py-3">
                    <summary className="cursor-pointer text-sm">Saved recipe and ingredient-price snapshots ({product.versions.length} shown)</summary>
                    <div className="mt-4 grid gap-4">
                      {product.versions.map((version) => {
                        const batchIngredients = version.ingredients.reduce((sum, line) => sum + Number(line.ingredientCostSnapshot), 0);
                        const directBatch = roundCurrency(batchIngredients + version.batchYield * Number(version.packagingCostPerCookie) + version.batchYield * Number(version.additionalDirectCostPerCookie));
                        const directPerCookie = roundCurrency(directBatch / version.batchYield);
                        const snapshotProfit = roundCurrency(Number(version.sellingPriceSnapshot) - directPerCookie);
                        const snapshotMargin = Number(version.sellingPriceSnapshot) > 0
                          ? `${(snapshotProfit / Number(version.sellingPriceSnapshot) * 100).toFixed(1)}%`
                          : "Unavailable at ₱0 price";
                        return (
                          <div className="border-t border-neutral-200 pt-3" key={version.id}>
                            <p className="text-sm font-medium">Version {version.version} · saved {formatStoreDateTime(version.createdAt)}</p>
                            <p className="mt-1 text-xs text-neutral-600">Yield {version.batchYield}{version.cookieWeight ? ` · cookie weight ${version.cookieWeight.toFixed(3)} g` : ""} · saved selling price {formatPhp(Number(version.sellingPriceSnapshot))} · ingredient batch snapshot {formatPhp(batchIngredients)} · total direct cost / batch {formatPhp(directBatch)} · estimated direct cost / cookie {formatPhp(directPerCookie)} · gross profit / cookie {formatPhp(snapshotProfit)} · margin {snapshotMargin}</p>
                            <ul className="mt-2 text-xs text-neutral-500">
                              {version.ingredients.map((line) => <li key={line.id}>{line.ingredientName}: {line.quantity.toFixed(3)} {ingredientUnitDetails(line.unit).label} · saved ingredient cost {formatPhp(Number(line.ingredientCostSnapshot))} · saved unit price {precisePhp(Number(line.costPerBaseUnitSnapshot))} / {ingredientUnitDetails(line.unit).base}</li>)}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ) : null}

                <RecipeVersionEditor
                  ingredients={ingredients.map((ingredient) => ({
                    id: ingredient.id,
                    name: ingredient.name,
                    purchaseUnit: ingredient.purchaseUnit,
                    costPerBaseUnit: ingredient.costPerBaseUnit,
                  }))}
                  key={`${product.id}-${latest?.id ?? "new"}`}
                  productId={product.id}
                  recipe={product.recipeDraft}
                />
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function CostMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-neutral-300 py-4">
      <dt className="text-xs text-neutral-600">{label}</dt>
      <dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}
