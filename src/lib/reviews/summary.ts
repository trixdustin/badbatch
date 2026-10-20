import { prisma } from "@/lib/db/prisma";
import { summarizeRatings } from "@/lib/reviews/logic";

export async function getApprovedReviewSummary(productId?: string) {
  const ratings = await prisma.customerReview.groupBy({
    by: ["rating"],
    where: { status: "APPROVED", ...(productId ? { productId } : {}) },
    _count: { _all: true },
  });
  return summarizeRatings(ratings.map((entry) => ({ rating: entry.rating, count: entry._count._all })));
}
