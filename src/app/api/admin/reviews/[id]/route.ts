import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminApi } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { canAdminModerateReview } from "@/lib/reviews/logic";
import { reviewIdSchema, reviewModerationSchema } from "@/lib/validation/review";
import { readJson } from "@/lib/http/read-json";

const destination = { APPROVE: "APPROVED", REJECT: "REJECTED", HIDE: "HIDDEN" } as const;

export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/admin/reviews/[id]">) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const { id } = await params;
  const validId = reviewIdSchema.safeParse(id);
  if (!validId.success) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  const parsed = reviewModerationSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid moderation action." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.customerReview.findUnique({ where: { id: validId.data }, select: { status: true } });
      if (!review) return { kind: "missing" as const };
      if (!canAdminModerateReview(auth.admin.role, review.status, parsed.data.action)) return { kind: "invalid" as const };
      const updated = await tx.customerReview.updateMany({
        where: { id: validId.data, status: review.status },
        data: { status: destination[parsed.data.action] },
      });
      return updated.count === 1 ? { kind: "updated" as const } : { kind: "conflict" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "missing") return NextResponse.json({ error: "Review not found." }, { status: 404 });
    if (result.kind === "invalid") return NextResponse.json({ error: "That moderation action is not allowed for this review status." }, { status: 409 });
    if (result.kind === "conflict") return NextResponse.json({ error: "The review changed. Refresh and try again." }, { status: 409 });
    return NextResponse.json({ status: destination[parsed.data.action] });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "The review changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Admin review moderation failed.");
    return NextResponse.json({ error: "Could not update the review." }, { status: 500 });
  }
}
