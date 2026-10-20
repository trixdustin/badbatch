import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { OrderPaymentControls } from "@/components/admin/order-payment-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageIntro } from "@/components/shared/page-intro";
import { formatStoreDateTime } from "@/lib/admin/reporting";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { fulfillmentLabel, isFulfillmentProvided } from "@/lib/orders/fulfillment";
import { getProductLabel } from "@/lib/storefront/product-copy";
import { formatPhp } from "@/lib/format/currency";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await requireAdminPage();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      publicNumber: true,
      status: true,
      paymentStatus: true,
      paymentVerifiedAt: true,
      paymentVerifiedBy: { select: { email: true } },
      paymentRejectionReason: true,
      customerName: true,
      email: true,
      phone: true,
      address: true,
      notes: true,
      total: true,
      createdAt: true,
      updatedAt: true,
      paymentProofs: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          method: true,
          status: true,
          reference: true,
          internalNote: true,
          rejectionReason: true,
          submittedAt: true,
          reviewedAt: true,
          contentType: true,
          reviewedByAdmin: { select: { email: true } },
        },
      },
      items: {
        select: {
          quantity: true,
          price: true,
          product: { select: { name: true, slug: true, subtitle: true } },
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <>
      <AdminNav />
      <Link className="mb-5 inline-block text-sm underline underline-offset-4" href="/admin/orders">← all orders</Link>
      <PageIntro eyebrow="order detail" title={order.publicNumber}>
        Placed {formatStoreDateTime(order.createdAt)} · website checkout
      </PageIntro>

      <section aria-labelledby="order-status-heading" className="mb-10 border-y border-neutral-300 py-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h2 className="text-sm text-neutral-600" id="order-status-heading">Order status</h2>
            <div className="mt-2">
              <StatusBadge status={order.status} />
            </div>
          </div>
          <OrderStatusControl currentStatus={order.status} orderId={order.id} />
        </div>
      </section>

      <section aria-labelledby="payment-heading" className="mb-10 border-y border-neutral-300 py-5">
        <h2 className="text-lg" id="payment-heading">Payment</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-neutral-600">Payment status</dt><dd className="mt-1 font-medium">{formatPaymentStatus(order.paymentStatus)}</dd></div>
          <div><dt className="text-neutral-600">Verified at</dt><dd className="mt-1">{order.paymentVerifiedAt ? formatStoreDateTime(order.paymentVerifiedAt) : "—"}</dd></div>
          <div><dt className="text-neutral-600">Verified by</dt><dd className="mt-1">{order.paymentVerifiedBy?.email ?? "—"}</dd></div>
          {order.paymentRejectionReason ? <div><dt className="text-neutral-600">Latest rejection reason</dt><dd className="mt-1">{order.paymentRejectionReason}</dd></div> : null}
        </dl>
        <OrderPaymentControls
          orderId={order.id}
          pendingProof={order.paymentProofs.find((proof) => proof.status === "PENDING") ?? null}
          status={order.paymentStatus}
        />
        <div className="mt-6 grid gap-5 border-t border-neutral-200 pt-4">
          {order.paymentProofs.length === 0 ? <p className="text-sm text-neutral-600">No payment proof recorded.</p> : null}
          {order.paymentProofs.map((proof) => (
            <article className="grid gap-2 border-b border-neutral-200 pb-5" key={proof.id}>
              <p className="text-sm font-medium">{proof.method === "WEBSITE" ? "Website upload" : "Instagram DM"} · {formatPaymentProofStatus(proof.status)}</p>
              <p className="text-xs text-neutral-600">Submitted {formatStoreDateTime(proof.submittedAt)}{proof.reference ? ` · reference ${proof.reference}` : ""}</p>
              {proof.contentType ? (
                <a className="w-fit text-sm underline underline-offset-4" href={`/api/admin/orders/${encodeURIComponent(order.id)}/proof/${encodeURIComponent(proof.id)}`} rel="noreferrer" target="_blank">Open private payment screenshot</a>
              ) : null}
              {proof.internalNote ? <p className="text-sm">Internal note: {proof.internalNote}</p> : null}
              {proof.rejectionReason ? <p className="text-sm">Rejection reason: {proof.rejectionReason}</p> : null}
              {proof.reviewedAt ? <p className="text-xs text-neutral-600">Reviewed {formatStoreDateTime(proof.reviewedAt)}{proof.reviewedByAdmin?.email ? ` by ${proof.reviewedByAdmin.email}` : ""}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="customer-heading">
          <h2 className="border-b border-neutral-300 pb-3 text-lg" id="customer-heading">Customer & fulfillment</h2>
          <dl className="divide-y divide-neutral-200">
            <DetailRow label="name">{order.customerName}</DetailRow>
            <DetailRow label="email"><a className="underline underline-offset-4" href={`mailto:${order.email}`}>{order.email}</a></DetailRow>
            <DetailRow label="phone"><a className="underline underline-offset-4" href={`tel:${order.phone}`}>{order.phone}</a></DetailRow>
            <DetailRow label="fulfillment">
              <span className="font-medium">{fulfillmentLabel(order.address)}</span>
              {isFulfillmentProvided(order.address) ? (
                <span className="mt-1 block whitespace-pre-line break-words text-neutral-700">{order.address}</span>
              ) : (
                <span className="mt-1 block text-neutral-600">
                  No pickup or delivery choice was recorded at checkout. Confirm arrangements directly with
                  the customer before fulfilling.
                </span>
              )}
            </DetailRow>
            <DetailRow label="customer notes">{order.notes || "No notes."}</DetailRow>
            <DetailRow label="source">Website checkout (source is not stored separately).</DetailRow>
            <DetailRow label="payment">Not tracked by this application.</DetailRow>
          </dl>
        </section>

        <section aria-labelledby="items-heading">
          <h2 className="border-b border-neutral-300 pb-3 text-lg" id="items-heading">Order items</h2>
          <ul className="divide-y divide-neutral-200">
            {order.items.map((item, index) => (
              <li className="flex items-start justify-between gap-5 py-4" key={`${order.id}-${index}`}>
                <div>
                  <p>{getProductLabel(item.product.slug, undefined, item.product.name)}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {item.quantity} × {formatPhp(Number(item.price.toFixed(2)))} each
                  </p>
                  {item.product.subtitle ? (
                    <p className="mt-1 text-xs text-neutral-500">{item.product.subtitle}</p>
                  ) : null}
                </div>
                <p className="shrink-0 tabular-nums">{formatPhp(Number(item.price.mul(item.quantity).toFixed(2)))}</p>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-neutral-300 py-4 font-medium">
            <span>recorded order total</span>
            <span className="tabular-nums">{formatPhp(Number(order.total.toFixed(2)))}</span>
          </div>
          <p className="text-xs text-neutral-500">Recorded item prices are preserved from the time the order was placed.</p>
        </section>
      </div>
      <p className="mt-8 text-xs text-neutral-500">Last updated {formatStoreDateTime(order.updatedAt)}.</p>
    </>
  );
}

function DetailRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[170px_1fr] sm:gap-4">
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

function formatPaymentStatus(status: string | null) {
  if (!status) return "Not recorded (legacy order)";
  return ({
    AWAITING_PAYMENT: "Awaiting payment",
    PROOF_SUBMITTED: "Proof submitted",
    VERIFICATION_REQUIRED: "Verification required",
    CONFIRMED: "Payment confirmed",
    REJECTED: "Payment rejected",
  } as Record<string, string>)[status] ?? status;
}

function formatPaymentProofStatus(status: string) {
  return ({ PENDING: "pending review", VERIFIED: "verified", REJECTED: "rejected" } as Record<string, string>)[status] ?? status;
}
