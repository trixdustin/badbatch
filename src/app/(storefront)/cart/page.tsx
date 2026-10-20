import { CartSummary } from "@/components/storefront/cart-summary";
import { SectionLabel } from "@/components/storefront/section-label";

export default function CartPage() {
  return (
    <div className="py-12 sm:py-16">
      <header className="mb-9 border-b border-[var(--rule)] pb-8">
        <SectionLabel index="01">your order</SectionLabel>
        <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">
          Your batch.
        </h1>
      </header>
      <CartSummary />
    </div>
  );
}
