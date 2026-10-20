import Link from "next/link";
import { connection } from "next/server";
import { ReviewStatus } from "@prisma/client";
import { AdminNav } from "@/components/admin/admin-nav";
import { ModerationReview, ReviewModerationList } from "@/components/admin/review-moderation-list";
import { PageIntro } from "@/components/shared/page-intro";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { isVerifiedPurchase } from "@/lib/reviews/logic";

export const instant = false;

const pageSize = 25;
const statuses = Object.values(ReviewStatus);

export default function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  return (
    <>
      <AdminNav />
      <PageIntro eyebrow="customer notes" title="Reviews">
        Moderate submissions before they appear on the storefront.
      </PageIntro>
      <ReviewQueue searchParams={searchParams} />
    </>
  );
}

async function ReviewQueue({ searchParams }: { searchParams: PageProps<"/admin/reviews">["searchParams"] }) {
  await connection();
  await requireAdminPage();
  const query = await searchParams;
  const status = statuses.find((candidate) => candidate === query.status);
  const searchText = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const requestedSlug = typeof query.product === "string" ? query.product.slice(0, 140) : "";
  const requestedPage = Number(query.page);
  const requestedPageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const products = await prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } });
  const selectedProduct = products.find((product) => product.slug === requestedSlug);
  const where = {
    ...(status ? { status } : {}),
    ...(selectedProduct ? { productId: selectedProduct.id } : {}),
    ...(searchText ? { OR: [
      { displayName: { contains: searchText, mode: "insensitive" as const } },
      { body: { contains: searchText, mode: "insensitive" as const } },
    ] } : {}),
  };
  const total = await prisma.customerReview.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPageNumber, pageCount);
  const reviews = await prisma.customerReview.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      displayName: true,
      rating: true,
      body: true,
      status: true,
      createdAt: true,
      product: { select: { id: true, name: true, subtitle: true } },
      order: { select: { status: true, paymentStatus: true, items: { select: { productId: true } } } },
      productId: true,
      orderId: true,
    },
  });
  const rows: ModerationReview[] = reviews.map((review) => ({
    id: review.id,
    displayName: review.displayName,
    rating: review.rating,
    body: review.body,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    product: review.product,
    verifiedPurchase: isVerifiedPurchase({ productId: review.productId, orderId: review.orderId, order: review.order }),
  }));
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (selectedProduct) params.set("product", selectedProduct.slug);
  if (searchText) params.set("q", searchText);
  const pageHref = (target: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(target));
    return `/admin/reviews?${next.toString()}`;
  };

  return (
    <>
      <form action="/admin/reviews" className="mb-7 grid gap-3 border-y border-neutral-300 py-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <label className="grid gap-1 text-xs text-neutral-600">
          status
          <select className="min-h-10 border border-neutral-300 bg-white px-2 text-sm" defaultValue={status ?? ""} name="status">
            <option value="">all statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-neutral-600">
          cookie
          <select className="min-h-10 border border-neutral-300 bg-white px-2 text-sm" defaultValue={selectedProduct?.slug ?? ""} name="product">
            <option value="">all cookies</option>
            {products.map((product) => <option key={product.id} value={product.slug}>{product.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-neutral-600">
          search
          <input className="min-h-10 border border-neutral-300 bg-white px-3 text-sm" defaultValue={searchText} maxLength={120} name="q" placeholder="name or review text" />
        </label>
        <button className="min-h-10 border border-neutral-400 px-4 text-xs" type="submit">filter</button>
      </form>

      <ReviewModerationList reviews={rows} />
      {total > 0 ? (
        <nav aria-label="Review pages" className="flex items-center justify-between border-t border-neutral-300 py-4 text-sm">
          <span className="text-neutral-600">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex gap-5">
            {page > 1 ? <Link className="underline underline-offset-4" href={pageHref(page - 1)}>previous</Link> : <span className="text-neutral-400">previous</span>}
            <span>page {page} of {pageCount}</span>
            {page < pageCount ? <Link className="underline underline-offset-4" href={pageHref(page + 1)}>next</Link> : <span className="text-neutral-400">next</span>}
          </div>
        </nav>
      ) : null}
    </>
  );
}
