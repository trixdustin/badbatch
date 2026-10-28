import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Prisma } from "@prisma/client";
import { InstagramLink } from "@/components/storefront/instagram-link";
import { SectionLabel } from "@/components/storefront/section-label";
import { verifyOrderConfirmationToken } from "@/lib/auth/order-confirmation";
import { prisma } from "@/lib/db/prisma";
import { getProductLabel } from "@/lib/storefront/product-copy";
import { formatPhp } from "@/lib/format/currency";
import { instagramUrl } from "@/lib/storefront/instagram";
import { PaymentProofForm } from "@/components/storefront/payment-proof-form";
import { ReviewSubmissionForm } from "@/components/storefront/review-submission-form";
import { COOKIE_SET_NAMES, describeSetContents } from "@/lib/storefront/sets";
import { GcashDetails } from "@/components/storefront/gcash-details";

export const instant = false;

function formatPrice(value: Prisma.Decimal) {
  return formatPhp(Number(value.toFixed(2)));
}

export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  await connection();
  const { id } = await params;
  const confirmationCookie = (await cookies()).get("badbatch_order_confirmation")?.value;

  if (
    !confirmationCookie ||
    !(await verifyOrderConfirmationToken(confirmationCookie, id))
  ) {
    notFound();
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      publicNumber: true,
      customerName: true,
      total: true,
      status: true,
      paymentStatus: true,
      paymentRejectionReason: true,
      items: {
        select: {
          quantity: true,
          price: true,
          setId: true,
          setContents: true,
          product: { select: { id: true, name: true, slug: true, subtitle: true } },
        },
      },
      reviews: { select: { productId: true, status: true } },
    },
  });

  if (!order) notFound();

  return (
    <section className="max-w-3xl py-12 sm:py-20">
      <SectionLabel index="received">batch received</SectionLabel>
      <h1 className="mt-6 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">
        Thanks, {order.customerName}.
      </h1>
      <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--cream-muted)]">
        Your order is saved. Use the instructions below to complete payment.
      </p>

      <div className="mt-10 border-y border-[var(--rule)]">
        <div className="flex flex-wrap justify-between gap-3 py-4">
          <span className="micro-label">order reference</span>
          <span className="font-mono text-xs">{order.publicNumber}</span>
        </div>
        <ul className="divide-y divide-[var(--rule)] border-t border-[var(--rule)]">
          {order.items.map((item, index) => (
            <li className="flex items-baseline justify-between gap-5 py-4" key={`${item.product.slug}-${index}`}>
              <span className="text-sm">
                {item.setId ? COOKIE_SET_NAMES[item.setId] ?? item.setId : getProductLabel(item.product.slug, undefined, item.product.name)}
                {item.setContents ? <span className="mt-1 block text-xs text-[var(--cream-muted)]">{describeSetContents(item.setContents as { slug: string; quantity: number }[], item.quantity)}</span> : item.product.subtitle ? (
                  <span className="mt-1 block text-xs text-[var(--cream-muted)]">{item.product.subtitle}</span>
                ) : null}
                <span className="ml-2 text-xs text-[var(--cream-muted)]">× {item.quantity}{item.setId ? " set(s)" : ""}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums">{formatPrice(item.price.mul(item.quantity))}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between gap-5 border-t border-[var(--rule)] py-4">
          <span className="micro-label">total</span>
          <span className="text-sm tabular-nums">{formatPrice(order.total)}</span>
        </div>
      </div>

      {order.paymentStatus === "AWAITING_PAYMENT" || order.paymentStatus === "REJECTED" || order.paymentStatus === null ? (
        <section aria-labelledby="gcash-instructions-heading" className="mt-8">
          <h2 className="text-lg" id="gcash-instructions-heading">GCash payment instructions</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--cream-muted)]">
            Amount due: <strong className="text-[var(--cream)]">{formatPrice(order.total)}</strong>. Payment remains pending until a BAD BATCH admin verifies it.
          </p>
          <GcashDetails />
        </section>
      ) : null}

      <PaymentProofForm
        orderId={order.id}
        rejectionReason={order.paymentRejectionReason}
        status={order.paymentStatus}
      />

      <aside aria-labelledby="instagram-payment-heading" className="mt-7 border border-[var(--rule)] p-5 sm:p-6">
        <p className="micro-label">alternative</p>
        <h2 className="mt-2 text-lg" id="instagram-payment-heading">Send proof through Instagram DM</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--cream-muted)]">
          Message <strong className="text-[var(--cream)]">order {order.publicNumber}</strong>, your GCash payment reference, and a screenshot to BAD BATCH. Instagram messages are not imported into this site; an admin will record receipt and verify payment manually.
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--cream-muted)]">Please wait for manual payment verification before considering payment confirmed.</p>
        <a className="editorial-link mt-5" href={instagramUrl} rel="noreferrer" target="_blank">open BAD BATCH Instagram</a>
      </aside>

      {order.status === "COMPLETED" && order.paymentStatus === "CONFIRMED" ? (
        <section aria-labelledby="order-review-heading" className="review-panel mt-12">
          <h2 className="text-2xl font-medium tracking-[-0.04em]" id="order-review-heading">How was your batch?</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--cream-muted)]">
            These review links are tied to the cookies in this completed, payment-verified order. Your order details stay private.
          </p>
          <div className="mt-7 grid gap-8">
            {[...new Map(order.items.map((item) => [item.product.id, item.product])).values()].map((product) => {
              const existing = order.reviews.find((review) => review.productId === product.id);
              return (
                <div className="border-t border-[var(--rule)] pt-6" key={product.id}>
                  {existing ? (
                    <p className="text-sm text-[var(--cream-muted)]">
                      Your note for {product.name} is {existing.status.toLowerCase()}.
                    </p>
                  ) : (
                    <ReviewSubmissionForm
                      action={`/order/${encodeURIComponent(order.id)}/reviews`}
                      fixedProductId={product.id}
                      heading={`Review ${product.name}`}
                      products={[product]}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs">
        <Link className="text-[var(--cream-muted)] underline underline-offset-4 hover:text-[var(--cream)]" href="/menu">
          back to the menu
        </Link>
        <InstagramLink className="text-[var(--cream-muted)] underline underline-offset-4 hover:text-[var(--cream)]">
          dm to order
        </InstagramLink>
      </div>
    </section>
  );
}
