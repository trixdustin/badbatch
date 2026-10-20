import Link from "next/link";
import { connection } from "next/server";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { SectionLabel } from "@/components/storefront/section-label";
import { prisma } from "@/lib/db/prisma";

export const instant = false;

export default async function CheckoutPage() {
  await connection();
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "store" },
    select: { orderingEnabled: true },
  });

  return (
    <div className="py-12 sm:py-16">
      <header className="mb-9 border-b border-[var(--rule)] pb-8">
        <SectionLabel index="02">guest checkout</SectionLabel>
        <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">
          Make it yours.
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--cream-muted)]">
          No account needed. Add your details; payment instructions follow your order.
        </p>
      </header>
      {!settings?.orderingEnabled ? (
        <div className="mb-8 border-l border-[var(--cream-muted)] pl-4">
          <p className="text-sm">Ordering is currently closed.</p>
          <p className="mt-2 text-xs text-[var(--cream-muted)]">
            Your batch stays saved here. Come back when the shop opens.
          </p>
        </div>
      ) : null}
      <CheckoutForm orderingEnabled={Boolean(settings?.orderingEnabled)} />
      <Link
        className="mt-10 inline-flex text-[11px] text-[var(--cream-muted)] underline underline-offset-4 hover:text-[var(--cream)]"
        href="/cart"
      >
        ← back to your batch
      </Link>
    </div>
  );
}
