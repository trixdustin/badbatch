import Link from "next/link";
import { connection } from "next/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageIntro } from "@/components/shared/page-intro";
import { getStoreDayRange, storeTimeZone } from "@/lib/admin/reporting";
import { formatPhp } from "@/lib/format/currency";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function AdminDashboardPage() {
  await connection();
  await requireAdminPage();
  const { start, end } = getStoreDayRange();
  const [ordersToday, pendingOrders, preparingOrders, readyOrders, completedToday, salesToday, productCount, settings] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "PREPARING" } }),
      prisma.order.count({ where: { status: "READY" } }),
      prisma.order.count({
        where: { status: "COMPLETED", updatedAt: { gte: start, lt: end } },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          status: { not: "CANCELLED" },
        },
        _sum: { total: true },
      }),
      prisma.product.count(),
      prisma.storeSettings.findUnique({
        where: { id: "store" },
        select: { orderingEnabled: true, announcement: true },
      }),
    ]);

  const metrics = [
    { label: "orders received today", value: ordersToday },
    { label: "awaiting confirmation", value: pendingOrders, href: "/admin/orders?status=PENDING" },
    { label: "being prepared", value: preparingOrders, href: "/admin/orders?status=PREPARING" },
    { label: "ready for fulfillment", value: readyOrders, href: "/admin/orders?status=READY" },
    { label: "completed today*", value: completedToday },
    {
      label: "recorded order value today**",
      value: formatPhp(Number(salesToday._sum.total ?? 0)),
    },
  ];

  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="operations" title="Dashboard">
        Today’s reporting uses {storeTimeZone}.{" "}
        <span className="text-neutral-500">
          *Completion is estimated from the order’s last-updated time. **Order value is not a record of payments.
        </span>
      </PageIntro>
      <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div className="border-t border-neutral-300 py-5" key={metric.label}>
            <dt className="text-sm text-neutral-600">{metric.label}</dt>
            <dd className="mt-2 text-3xl font-medium tabular-nums">
              {"href" in metric && metric.href ? (
                <Link className="hover:underline" href={metric.href}>
                  {metric.value}
                </Link>
              ) : (
                metric.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-neutral-500">
        The confirmation, preparing, and ready counts link to the matching order list.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-300 pt-5 text-sm">
        <Link className="underline underline-offset-4" href="/admin/orders">review orders</Link>
        <Link className="underline underline-offset-4" href="/admin/products">{productCount} products</Link>
        <Link className="underline underline-offset-4" href="/admin/settings">
          ordering {settings?.orderingEnabled ? "open" : "closed"}
        </Link>
        {settings?.announcement ? <span className="text-neutral-600">{settings.announcement}</span> : null}
      </div>
    </>
  );
}
