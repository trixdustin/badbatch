import Link from "next/link";
import { Suspense } from "react";
import { OrderStatus } from "@prisma/client";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageIntro } from "@/components/shared/page-intro";
import { formatStoreDateTime } from "@/lib/admin/reporting";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { formatOrderStatus } from "@/lib/orders/workflow";
import { fulfillmentLabel } from "@/lib/orders/fulfillment";
import { getProductLabel } from "@/lib/storefront/product-copy";
import { formatPhp } from "@/lib/format/currency";
import { StatusBadge } from "@/components/admin/status-badge";

const pageSize = 25;
const statuses = Object.values(OrderStatus);

export default function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="operations" title="Orders">
        Search and update the current batch. Orders are shown newest first.
      </PageIntro>
      <Suspense fallback={<OrdersLoading />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrdersContent({
  searchParams,
}: {
  searchParams: PageProps<"/admin/orders">["searchParams"];
}) {
  await requireAdminPage();
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const status = statuses.find((candidate) => candidate === query.status);
  const requestedPage = Number(query.page);
  const requestedPageNumber =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const searchClause = search
    ? {
        OR: [
          { publicNumber: { contains: search } },
          { customerName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const where = {
    ...(status ? { status } : {}),
    ...searchClause,
  };

  const total = await prisma.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPageNumber, pageCount);
  const [orders, statusCounts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        publicNumber: true,
        status: true,
        customerName: true,
        email: true,
        address: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            setId: true,
            setContents: true,
            product: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    // Counts respect the current search but ignore the status filter, so the
    // quick-filter chips show how many results each status would return.
    prisma.order.groupBy({
      by: ["status"],
      where: searchClause,
      _count: { _all: true },
    }),
  ]);
  const countByStatus = new Map(statusCounts.map((entry) => [entry.status, entry._count._all]));
  const searchMatchTotal = statusCounts.reduce((sum, entry) => sum + entry._count._all, 0);
  const filters = new URLSearchParams();
  if (search) filters.set("q", search);
  if (status) filters.set("status", status);
  const filterQuery = filters.toString();
  const pageHref = (target: number) =>
    `/admin/orders?${filterQuery ? `${filterQuery}&` : ""}page=${target}`;
  const chipHref = (nextStatus: string) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (nextStatus) params.set("status", nextStatus);
    const query = params.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
  };

  return (
    <>
      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        <StatusChip
          active={!status}
          count={searchMatchTotal}
          href={chipHref("")}
          label="All"
        />
        {statuses.map((value) => (
          <StatusChip
            active={status === value}
            count={countByStatus.get(value) ?? 0}
            href={chipHref(value)}
            key={value}
            label={formatOrderStatus(value)}
          />
        ))}
      </nav>

      <form className="mb-8 grid gap-3 border-y border-neutral-300 py-5 sm:grid-cols-[minmax(0,1fr)_220px_auto_auto] sm:items-end" method="get">
        <label className="text-sm text-neutral-700">
          Reference or customer
          <input
            className="mt-2 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm"
            defaultValue={search}
            maxLength={100}
            name="q"
            placeholder="Reference, name, email, or phone"
            type="search"
          />
        </label>
        <label className="text-sm text-neutral-700">
          Status
          <select className="mt-2 block min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm" defaultValue={status ?? ""} name="status">
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>{formatOrderStatus(value)}</option>
            ))}
          </select>
        </label>
        <button className="min-h-11 bg-neutral-900 px-5 text-sm text-white" type="submit">apply filters</button>
        <Link className="py-3 text-sm underline underline-offset-4" href="/admin/orders">clear</Link>
      </form>

      {orders.length === 0 ? (
        <p className="border-y border-neutral-300 py-8 text-sm text-neutral-600">
          {search || status ? "No orders match these filters." : "No orders yet."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-400 text-neutral-600">
                  <th className="py-3 pr-4 font-normal">order / source</th>
                  <th className="py-3 pr-4 font-normal">customer</th>
                  <th className="py-3 pr-4 font-normal">items</th>
                  <th className="py-3 pr-4 font-normal">total</th>
                  <th className="py-3 pr-4 font-normal">fulfillment</th>
                  <th className="py-3 pr-4 font-normal">status</th>
                  <th className="py-3 font-normal">placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr className="border-b border-neutral-200 align-top" key={order.id}>
                    <td className="py-4 pr-4">
                      <Link className="font-mono text-xs underline underline-offset-4" href={`/admin/orders/${order.id}`}>{order.publicNumber}</Link>
                      <p className="mt-2 text-xs text-neutral-500">website checkout</p>
                    </td>
                    <td className="py-4 pr-4">
                      {order.customerName}
                      <br /><span className="text-neutral-500">{order.email}</span>
                    </td>
                    <td className="py-4 pr-4">
                      <span>{order.items.reduce((count, item) => count + item.quantity * (item.setContents ? (item.setContents as { quantity: number }[]).reduce((sum, part) => sum + part.quantity, 0) : 1), 0)} cookies</span>
                      <p className="mt-1 max-w-64 text-xs text-neutral-500">
                        {order.items.map((item) => item.setId ? `${item.quantity} × ${item.setId} (${(item.setContents as { slug: string; quantity: number }[]).map((part) => `${part.quantity} ${part.slug}`).join(" + ")})` : `${item.quantity} × ${getProductLabel(item.product.slug, undefined, item.product.name)}`).join(", ")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4">{formatPhp(Number(order.total.toFixed(2)))}</td>
                    <td className="py-4 pr-4 text-neutral-600">{fulfillmentLabel(order.address)}</td>
                    <td className="py-4 pr-4"><StatusBadge status={order.status} /></td>
                    <td className="whitespace-nowrap py-4">{formatStoreDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Order pages" className="mt-6 flex items-center justify-between border-t border-neutral-300 py-4 text-sm">
            <p className="text-neutral-600">
              {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex gap-5">
              {page > 1 ? <Link className="underline underline-offset-4" href={pageHref(page - 1)}>previous</Link> : <span className="text-neutral-400">previous</span>}
              <span>page {page} of {pageCount}</span>
              {page < pageCount ? <Link className="underline underline-offset-4" href={pageHref(page + 1)}>next</Link> : <span className="text-neutral-400">next</span>}
            </div>
          </nav>
        </>
      )}
    </>
  );
}

function OrdersLoading() {
  return (
    <section aria-live="polite" className="py-8">
      <p className="text-sm text-neutral-600">Loading orders and filters…</p>
    </section>
  );
}

function StatusChip({
  active,
  count,
  href,
  label,
}: {
  active: boolean;
  count: number;
  href: string;
  label: string;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm capitalize";
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={
        active
          ? `${base} border-neutral-900 bg-neutral-900 text-white`
          : `${base} border-neutral-300 text-neutral-700 hover:border-neutral-500`
      }
      href={href}
    >
      {label}
      <span className={active ? "text-neutral-300" : "text-neutral-500"}>{count}</span>
    </Link>
  );
}
