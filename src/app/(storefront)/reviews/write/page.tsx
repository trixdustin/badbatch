import Link from "next/link";
import { connection } from "next/server";
import { ReviewSubmissionForm } from "@/components/storefront/review-submission-form";
import { SectionLabel } from "@/components/storefront/section-label";
import { prisma } from "@/lib/db/prisma";

export const instant = false;

export default async function WriteReviewPage() {
  await connection();
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, subtitle: true },
  });

  return (
    <div className="review-page">
      <Link className="text-xs text-[var(--cream-muted)] underline underline-offset-4" href="/reviews">back to reviews</Link>
      <header className="mb-10 mt-8">
        <SectionLabel index="customer notes">the batch, in your words</SectionLabel>
        <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">A note about the cookies.</h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--cream-muted)]">
          Share what you thought. Reviews are checked by our team before they appear publicly.
        </p>
      </header>
      <section className="review-panel max-w-2xl">
        <ReviewSubmissionForm products={products} />
      </section>
    </div>
  );
}
