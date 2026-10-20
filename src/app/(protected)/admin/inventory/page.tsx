import { connection } from "next/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageIntro } from "@/components/shared/page-intro";
import { formatStoreDateTime } from "@/lib/admin/reporting";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { inventoryReasonLabels, isStockTracked, stockStateLabel } from "@/lib/inventory/stock";
import { InventoryStockControl } from "@/components/admin/inventory-stock-control";
import { InventoryThresholdControl } from "@/components/admin/inventory-threshold-control";

export const instant = false;

export default async function AdminInventoryPage() {
  await connection();
  await requireAdminPage();
  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ isSeasonal: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        isAvailable: true,
        isSeasonal: true,
        stock: true,
        lowStockThreshold: true,
        price: true,
      },
    }),
    prisma.inventoryAdjustment.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        change: true,
        reason: true,
        note: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
        admin: { select: { email: true } },
      },
    }),
  ]);

  const lowStockProducts = products.filter(
    (product) => isStockTracked(product.stock) && product.stock > 0 && product.stock <= product.lowStockThreshold,
  );
  const outOfStockProducts = products.filter(
    (product) => isStockTracked(product.stock) && product.stock <= 0,
  );
  const alertProducts = [...lowStockProducts, ...outOfStockProducts].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="operations" title="Inventory">
        Current stock and recent inventory movements.
      </PageIntro>

      <section aria-labelledby="stock-alerts-heading" className="mb-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-neutral-300 pb-3">
          <h2 className="text-lg" id="stock-alerts-heading">Stock alerts</h2>
          <p className="text-sm text-neutral-600">
            {lowStockProducts.length} low stock · {outOfStockProducts.length} out of stock
          </p>
        </div>
        {alertProducts.length === 0 ? (
          <p className="py-5 text-sm text-neutral-600">No tracked products are low or out of stock.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-400 text-neutral-600">
                  <th className="py-3 pr-4 font-normal">product</th>
                  <th className="py-3 pr-4 font-normal">current quantity</th>
                  <th className="py-3 pr-4 font-normal">threshold</th>
                  <th className="py-3 font-normal">status</th>
                </tr>
              </thead>
              <tbody>
                {alertProducts.map((product) => {
                  const state = stockStateLabel({
                    isAvailable: product.isAvailable,
                    stock: product.stock,
                    lowStockThreshold: product.lowStockThreshold,
                  });
                  return (
                    <tr className="border-b border-neutral-200" key={product.id}>
                      <td className="py-3 pr-4">
                        <a className="underline underline-offset-4" href={`#stock-${product.id}`}>
                          {product.name}
                        </a>
                      </td>
                      <td className="py-3 pr-4 tabular-nums">{product.stock}</td>
                      <td className="py-3 pr-4 tabular-nums">{product.lowStockThreshold}</td>
                      <td className={state.tone === "danger" ? "py-3 font-medium text-red-700" : "py-3 font-medium text-amber-700"}>
                        {state.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="stock-heading" className="mb-12">
        <h2 className="border-b border-neutral-300 pb-3 text-lg" id="stock-heading">
          Current stock
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-400 text-neutral-600">
                <th className="py-3 pr-4 font-normal">product</th>
                <th className="py-3 pr-4 font-normal">slug</th>
                <th className="py-3 pr-4 font-normal">availability</th>
                <th className="py-3 pr-4 font-normal">stock</th>
                <th className="py-3 pr-4 font-normal">low stock at</th>
                <th className="py-3 font-normal">adjust</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const state = stockStateLabel({
                  isAvailable: product.isAvailable,
                  stock: product.stock,
                  lowStockThreshold: product.lowStockThreshold,
                });
                return (
                  <tr className="border-b border-neutral-200" id={`stock-${product.id}`} key={product.id}>
                    <td className="py-3 pr-4">
                      {product.name}
                      {product.isSeasonal ? (
                        <span className="ml-2 text-xs text-neutral-500">seasonal</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-500">{product.slug}</td>
                    <td className="py-3 pr-4 text-neutral-600">
                      {product.isAvailable ? "available" : "unavailable"}
                    </td>
                    <td
                      className={
                        state.tone === "danger"
                          ? "py-3 font-medium text-red-700"
                          : state.tone === "warn"
                            ? "py-3 font-medium text-amber-700"
                            : state.tone === "ok"
                              ? "py-3 font-medium text-emerald-800"
                              : "py-3 text-neutral-500"
                      }
                    >
                      {isStockTracked(product.stock) ? product.stock : state.text}
                    </td>
                    <td className="py-3 pr-4">
                      <InventoryThresholdControl productId={product.id} threshold={product.lowStockThreshold} />
                    </td>
                    <td className="py-3 pl-4">
                      <InventoryStockControl
                        isAvailable={product.isAvailable}
                        lowStockThreshold={product.lowStockThreshold}
                        productId={product.id}
                        stock={product.stock}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="movements-heading">
        <h2 className="border-b border-neutral-300 pb-3 text-lg" id="movements-heading">
          Recent inventory movements
        </h2>
        {movements.length === 0 ? (
          <p className="py-8 text-sm text-neutral-600">No inventory movements recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-400 text-neutral-600">
                  <th className="py-3 pr-4 font-normal">when</th>
                  <th className="py-3 pr-4 font-normal">product</th>
                  <th className="py-3 pr-4 font-normal">change</th>
                  <th className="py-3 pr-4 font-normal">reason</th>
                  <th className="py-3 pr-4 font-normal">note</th>
                  <th className="py-3 font-normal">by</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr className="border-b border-neutral-200 align-top" key={movement.id}>
                    <td className="whitespace-nowrap py-3 pr-4 text-neutral-500">
                      {formatStoreDateTime(movement.createdAt)}
                    </td>
                    <td className="py-3 pr-4">{movement.product.name}</td>
                    <td
                      className={`py-3 pr-4 tabular-nums ${movement.change < 0 ? "text-red-700" : "text-emerald-800"}`}
                    >
                      {movement.change > 0 ? `+${movement.change}` : movement.change}
                    </td>
                    <td className="py-3 pr-4">{inventoryReasonLabels[movement.reason]}</td>
                    <td className="py-3 pr-4 text-neutral-500">{movement.note || "—"}</td>
                    <td className="py-3 text-neutral-500">{movement.admin?.email ?? "system"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}


