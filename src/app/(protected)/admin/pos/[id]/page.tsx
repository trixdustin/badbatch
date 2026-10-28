import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Prisma } from "@prisma/client";
import { AdminNav } from "@/components/admin/admin-nav";
import { PrintReceiptButton } from "@/components/admin/print-receipt-button";
import { PageIntro } from "@/components/shared/page-intro";
import { formatStoreDateTime } from "@/lib/admin/reporting";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { formatPhp } from "@/lib/format/currency";
import { paymentMethodLabels } from "@/lib/inventory/stock";
import { COOKIE_SET_NAMES, describeSetContents } from "@/lib/storefront/sets";

export const instant = false;

export default async function PosSaleDetailPage({
  params,
}: PageProps<"/admin/pos/[id]">) {
  await connection();
  await requireAdminPage();
  const { id } = await params;
  const sale = await prisma.posSale.findUnique({
    where: { id },
    select: {
      id: true,
      total: true,
      paymentMethod: true,
      createdAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          quantity: true,
          price: true,
          setId: true,
          setContents: true,
          product: { select: { name: true, slug: true } },
        },
      },
    },
  });
  if (!sale) notFound();

  const subtotal = sale.items.reduce(
    (sum, item) => sum.add(item.price.mul(item.quantity).toDecimalPlaces(2)),
    new Prisma.Decimal(0),
  );

  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="point of sale" title="Receipt">
        Transaction details use the saved prices from this sale.
      </PageIntro>

      <div className="pos-receipt-controls mb-5 flex flex-wrap items-center gap-4">
        <PrintReceiptButton />
        <Link className="text-sm underline underline-offset-4" href="/admin/pos">back to POS</Link>
      </div>

      <article aria-label="POS sale receipt" className="pos-receipt max-w-xl border border-neutral-300 p-6 sm:p-8">
        <header className="border-b border-neutral-300 pb-5 text-center">
          <p className="text-xl font-semibold tracking-[0.24em]">BAD BATCH</p>
          <p className="mt-2 text-xs uppercase tracking-widest text-neutral-500">POS sale receipt</p>
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-b border-neutral-300 py-5 text-sm">
          <dt className="text-neutral-600">Sale reference</dt>
          <dd className="break-all text-right font-mono text-xs">{sale.id}</dd>
          <dt className="text-neutral-600">Date and time</dt>
          <dd className="text-right">{formatStoreDateTime(sale.createdAt)}</dd>
          <dt className="text-neutral-600">Payment method</dt>
          <dd className="text-right">{paymentMethodLabels[sale.paymentMethod]}</dd>
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-neutral-600">
                <th className="py-3 pr-3 font-normal">item</th>
                <th className="py-3 px-2 text-right font-normal">qty</th>
                <th className="py-3 px-2 text-right font-normal">unit price</th>
                <th className="py-3 pl-2 text-right font-normal">line total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => {
                const lineTotal = item.price.mul(item.quantity).toDecimalPlaces(2);
                return (
                  <tr className="border-b border-neutral-200" key={item.id}>
                    <td className="py-3 pr-3">
                      <span>{item.setId ? COOKIE_SET_NAMES[item.setId] ?? item.setId : item.product.name}</span>
                      {item.setContents ? <span className="mt-1 block text-xs text-neutral-500">{describeSetContents(item.setContents as { slug: string; quantity: number }[], item.quantity)}</span> : <span className="mt-1 block text-xs text-neutral-500">{item.product.slug}</span>}
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="whitespace-nowrap py-3 px-2 text-right tabular-nums">
                      {formatPhp(Number(item.price.toFixed(2)))}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-2 text-right tabular-nums">
                      {formatPhp(Number(lineTotal.toFixed(2)))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-3 border-t border-neutral-300 pt-4 text-sm">
          <dt className="text-neutral-600">Subtotal</dt>
          <dd className="text-right tabular-nums">{formatPhp(Number(subtotal.toFixed(2)))}</dd>
          <dt className="font-medium">Total</dt>
          <dd className="text-right font-medium tabular-nums">{formatPhp(Number(sale.total.toFixed(2)))}</dd>
        </dl>

        <footer className="mt-8 border-t border-neutral-300 pt-5 text-center text-sm">
          <p>Thank you for supporting our small batch bakery.</p>
          <p className="mt-1 text-xs text-neutral-500">Baked with care. Enjoy every bite.</p>
        </footer>
      </article>
    </>
  );
}
