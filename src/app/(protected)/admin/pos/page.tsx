import { connection } from "next/server";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageIntro } from "@/components/shared/page-intro";
import { PosTerminal, type PosProduct } from "@/components/admin/pos-terminal";
import { formatStoreDateTime, getStoreDayRange, getStoreDayRangeForDate } from "@/lib/admin/reporting";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { isPurchasable } from "@/lib/inventory/stock";
import { paymentMethodLabels } from "@/lib/inventory/stock";
import { formatPhp } from "@/lib/format/currency";
import { COOKIE_SET_NAMES } from "@/lib/storefront/sets";

export const instant = false;
const salesPageSize = 20;

export default async function AdminPosPage({
  searchParams,
}: PageProps<"/admin/pos">) {
  await connection();
  await requireAdminPage();
  const query = await searchParams;
  const requestedDate = typeof query.date === "string" ? query.date : "";
  const dateRange = requestedDate ? getStoreDayRangeForDate(requestedDate) : null;
  const selectedDate = dateRange ? requestedDate : "";
  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "store" }, select: { seasonalProductId: true } });
  const requestedPage = Number(query.page);
  const requestedPageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const salesWhere = dateRange ? { createdAt: { gte: dateRange.start, lt: dateRange.end } } : {};
  const { start, end } = getStoreDayRange();
  const [records, totalSales, posToday, onlineToday] = await Promise.all([
    prisma.product.findMany({
      where: { isAvailable: true },
      orderBy: [{ isSeasonal: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        isSeasonal: true,
        isAvailable: true,
        stock: true,
      },
    }),
    prisma.posSale.count({ where: salesWhere }),
    prisma.posSale.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const combinedRevenue =
    Number(posToday._sum.total ?? 0) + Number(onlineToday._sum.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(totalSales / salesPageSize));
  const page = Math.min(requestedPageNumber, pageCount);
  const recentSales = await prisma.posSale.findMany({
    where: salesWhere,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * salesPageSize,
    take: salesPageSize,
    select: {
      id: true,
      total: true,
      paymentMethod: true,
      createdAt: true,
      admin: { select: { email: true } },
      items: {
        select: {
          quantity: true,
          price: true,
          setId: true,
          setContents: true,
          product: { select: { slug: true } },
        },
      },
    },
  });

  const products: PosProduct[] = records.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price.toFixed(2),
    isSeasonal: product.isSeasonal,
    isCurrentSeasonal: product.id === storeSettings?.seasonalProductId,
    isAvailable: product.isAvailable,
    stock: product.stock,
    purchasable: isPurchasable(product),
  }));

  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="operations" title="POS">
        Record in-person sales. Stock is deducted only when a sale is committed. This does not
        process electronic payments — record the method for your own tracking.
      </PageIntro>

      <section aria-labelledby="sales-summary-heading" className="mb-8">
        <h2 className="border-b border-neutral-300 pb-3 text-lg" id="sales-summary-heading">
          Today’s sales
        </h2>
        <dl className="grid gap-x-8 sm:grid-cols-3">
          <div className="border-t border-neutral-300 py-5">
            <dt className="text-sm text-neutral-600">POS revenue</dt>
            <dd className="mt-2 text-2xl font-medium tabular-nums">
              {formatPhp(Number(posToday._sum.total ?? 0))}
            </dd>
            <p className="mt-1 text-xs text-neutral-500">{posToday._count._all} transaction(s)</p>
          </div>
          <div className="border-t border-neutral-300 py-5">
            <dt className="text-sm text-neutral-600">Online order revenue</dt>
            <dd className="mt-2 text-2xl font-medium tabular-nums">
              {formatPhp(Number(onlineToday._sum.total ?? 0))}
            </dd>
            <p className="mt-1 text-xs text-neutral-500">{onlineToday._count._all} order(s)</p>
          </div>
          <div className="border-t border-neutral-300 py-5">
            <dt className="text-sm text-neutral-600">Combined revenue</dt>
            <dd className="mt-2 text-2xl font-medium tabular-nums">
              {formatPhp(combinedRevenue)}
            </dd>
            <p className="mt-1 text-xs text-neutral-500">POS and non-cancelled online orders</p>
          </div>
        </dl>
      </section>

      <PosTerminal products={products} />

      <section aria-labelledby="pos-history-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-3">
          <h2 className="text-lg" id="pos-history-heading">POS transactions</h2>
          <form className="flex flex-wrap items-end gap-2" method="get">
            <label className="text-xs text-neutral-600" htmlFor="pos-history-date">
              date (store timezone)
              <input
                className="mt-1 block min-h-10 border border-neutral-300 bg-white px-2 text-sm"
                defaultValue={selectedDate}
                id="pos-history-date"
                name="date"
                type="date"
              />
            </label>
            <button className="min-h-10 border border-neutral-900 px-3 text-sm" type="submit">filter</button>
            {selectedDate ? <Link className="min-h-10 px-2 py-2 text-sm underline underline-offset-4" href="/admin/pos">clear</Link> : null}
          </form>
        </div>
        {recentSales.length === 0 ? (
          <p className="py-8 text-sm text-neutral-600">No POS transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-400 text-neutral-600">
                  <th className="py-3 pr-4 font-normal">reference</th>
                  <th className="py-3 pr-4 font-normal">items</th>
                  <th className="py-3 pr-4 font-normal">payment</th>
                  <th className="py-3 pr-4 font-normal">total</th>
                  <th className="py-3 pr-4 font-normal">by</th>
                  <th className="py-3 font-normal">placed</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr className="border-b border-neutral-200 align-top" key={sale.id}>
                    <td className="py-4 pr-4 font-mono text-xs">
                      <Link className="underline underline-offset-4" href={`/admin/pos/${encodeURIComponent(sale.id)}`}>
                        {sale.id}
                      </Link>
                    </td>
                    <td className="py-4 pr-4">
                      {sale.items
                        .map(
                          (item) =>
                            `${item.quantity} × ${item.setId ? COOKIE_SET_NAMES[item.setId] ?? item.setId : item.product.slug.replaceAll("-", " ")}`,
                        )
                        .join(", ")}
                    </td>
                    <td className="py-4 pr-4">{paymentMethodLabels[sale.paymentMethod]}</td>
                    <td className="whitespace-nowrap py-4 pr-4 tabular-nums">
                      {formatPhp(Number(sale.total.toFixed(2)))}
                    </td>
                    <td className="py-4 pr-4 text-neutral-500">{sale.admin?.email ?? "—"}</td>
                    <td className="whitespace-nowrap py-4">{formatStoreDateTime(sale.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalSales > salesPageSize ? (
          <nav aria-label="POS transaction pages" className="mt-4 flex items-center justify-between border-t border-neutral-300 py-4 text-sm">
            <p className="text-neutral-600">Page {page} of {pageCount} · {totalSales} transaction(s)</p>
            <div className="flex gap-4">
              {page > 1 ? (
                <Link href={`/admin/pos?${selectedDate ? `date=${encodeURIComponent(selectedDate)}&` : ""}page=${page - 1}`}>previous</Link>
              ) : null}
              {page < pageCount ? (
                <Link href={`/admin/pos?${selectedDate ? `date=${encodeURIComponent(selectedDate)}&` : ""}page=${page + 1}`}>next</Link>
              ) : null}
            </div>
          </nav>
        ) : totalSales > 0 ? (
          <p className="mt-3 text-xs text-neutral-500">{totalSales} transaction(s)</p>
        ) : null}
      </section>
    </>
  );
}
