import Link from "next/link";
import { connection } from "next/server";
import { ReviewStars } from "@/components/storefront/review-stars";
import { SectionLabel } from "@/components/storefront/section-label";
import { prisma } from "@/lib/db/prisma";
import { isVerifiedPurchase, summarizeRatings } from "@/lib/reviews/logic";

export const instant = false;

const pageSize = 10;

function formatReviewDate(date: Date) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(date);
}

export default async function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  await connection();
  const query = await searchParams;
  const requestedSlug = typeof query.product === "string" ? query.product.slice(0, 140) : "";
  const sort = query.sort === "rating" ? "rating" : "newest";
  const requestedPage = Number(query.page);
  const requestedPageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, subtitle: true },
  });
  const selectedProduct = products.find((product) => product.slug === requestedSlug);
  const where = { status: "APPROVED" as const, ...(selectedProduct ? { productId: selectedProduct.id } : {}) };
  const total = await prisma.customerReview.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPageNumber, pageCount);
  const [ratingRows, reviews] = await Promise.all([
    prisma.customerReview.groupBy({ by: ["rating"], where, _count: { _all: true } }),
    prisma.customerReview.findMany({
      where,
      orderBy: sort === "rating" ? [{ rating: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        displayName: true,
        rating: true,
        body: true,
        createdAt: true,
        product: { select: { id: true, slug: true, name: true, subtitle: true } },
        order: {
          select: {
            status: true,
            paymentStatus: true,
            items: { select: { productId: true } },
          },
        },
      },
    }),
  ]);
  const summary = summarizeRatings(ratingRows.map((entry) => ({ rating: entry.rating, count: entry._count._all })));
  const search = new URLSearchParams();
  if (selectedProduct) search.set("product", selectedProduct.slug);
  if (sort === "rating") search.set("sort", sort);
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams(search);
    params.set("page", String(targetPage));
    return `/reviews?${params.toString()}`;
  };

  return (
    <div className="review-page">
      <header className="mb-9 flex flex-wrap items-end justify-between gap-6 border-b border-[var(--rule)] pb-8">
        <div>
          <SectionLabel index="customer notes">the batch, in your words</SectionLabel>
          <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">Reviews</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--cream-muted)]">Notes from people who tried the cookies. Only approved reviews appear here.</p>
        </div>
        <Link className="editorial-link" href="/reviews/write">write a review <span aria-hidden="true" className="ml-5">↗</span></Link>
      </header>

      <section aria-label="Approved review ratings" className="grid gap-8 border-b border-[var(--rule)] py-8 sm:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="micro-label">overall rating</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {summary.average === null ? <span className="text-3xl font-medium">—</span> : <span className="text-3xl font-medium tabular-nums">{summary.average.toFixed(1)}</span>}
            {summary.average !== null ? <ReviewStars rating={summary.average} /> : null}
          </div>
          <p className="mt-2 text-xs text-[var(--cream-muted)]">{summary.count} approved {summary.count === 1 ? "review" : "reviews"}</p>
        </div>
        <div className="grid gap-2" aria-label="Rating breakdown">
          {summary.breakdown.map(({ rating, count, proportion }) => (
            <div className="review-breakdown" key={rating}>
              <span>{rating} star{rating === 1 ? "" : "s"}</span>
              <span aria-hidden="true" className="review-breakdown-track"><span className="review-breakdown-fill block" style={{ width: `${proportion * 100}%` }} /></span>
              <span className="text-right tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <form action="/reviews" className="review-filter py-6">
        <label>
          cookie
          <select defaultValue={selectedProduct?.slug ?? ""} name="product">
            <option value="">all cookies</option>
            {products.map((product) => <option key={product.id} value={product.slug}>{product.name}</option>)}
          </select>
        </label>
        <label>
          sort by
          <select defaultValue={sort} name="sort">
            <option value="newest">newest</option>
            <option value="rating">highest rating</option>
          </select>
        </label>
        <button type="submit">apply</button>
      </form>

      {reviews.length ? (
        <section aria-label="Customer reviews">
          {reviews.map((review) => (
            <article className="review-card" key={review.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <ReviewStars label={`${review.rating} out of 5 stars`} rating={review.rating} />
                  <span className="text-sm font-medium">{review.displayName}</span>
                  {isVerifiedPurchase({ productId: review.product?.id ?? null, orderId: review.order ? "linked" : null, order: review.order }) ? (
                    <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--muted)]">verified purchase</span>
                  ) : null}
                </div>
                <time className="text-xs text-[var(--cream-muted)]" dateTime={review.createdAt.toISOString()}>{formatReviewDate(review.createdAt)}</time>
              </div>
              {review.product ? <p className="micro-label mt-3">{review.product.name}{review.product.subtitle ? ` — ${review.product.subtitle}` : ""}</p> : null}
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6">{review.body}</p>
            </article>
          ))}
          <nav aria-label="Review pages" className="mt-6 flex items-center justify-between border-t border-[var(--rule)] py-5 text-xs">
            <span className="text-[var(--cream-muted)]">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
            <div className="flex gap-5">
              {page > 1 ? <Link className="underline underline-offset-4" href={pageHref(page - 1)}>previous</Link> : <span className="text-[var(--cream-muted)]">previous</span>}
              <span>page {page} of {pageCount}</span>
              {page < pageCount ? <Link className="underline underline-offset-4" href={pageHref(page + 1)}>next</Link> : <span className="text-[var(--cream-muted)]">next</span>}
            </div>
          </nav>
        </section>
      ) : (
        <section className="border-y border-[var(--rule)] py-12 text-center">
          <p className="micro-label">nothing published yet</p>
          <h2 className="mt-3 text-2xl font-medium">No approved reviews yet.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--cream-muted)]">Be the first to share a note. Submitted reviews are checked before they appear.</p>
          <Link className="editorial-link mt-6" href="/reviews/write">write a review <span aria-hidden="true" className="ml-5">↗</span></Link>
        </section>
      )}
    </div>
  );
}
