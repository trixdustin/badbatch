import { NextRequest, NextResponse } from "next/server";
import { verifyOrderConfirmationToken } from "@/lib/auth/order-confirmation";
import { createReviewFingerprint } from "@/lib/reviews/logic";
import { isConcurrentTransactionError, isUniqueConstraintError, readReviewRequestBody, ReviewSubmissionError, submitVerifiedReview } from "@/lib/reviews/submission";
import { verifiedReviewSchema } from "@/lib/validation/review";

export async function POST(request: NextRequest, { params }: RouteContext<"/order/[id]/reviews">) {
  const { id } = await params;
  const token = request.cookies.get("badbatch_order_confirmation")?.value;
  if (!token || !(await verifyOrderConfirmationToken(token, id))) {
    return NextResponse.json({ error: "This order link has expired or is invalid." }, { status: 404 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Submit the review form to continue." }, { status: 415 });
  }
  const parsed = verifiedReviewSchema.safeParse(await readReviewRequestBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a display name, a rating from 1 to 5, and a review between 10 and 1,200 characters." }, { status: 400 });
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Reviews are temporarily unavailable." }, { status: 503 });
  const contentHash = createReviewFingerprint({ ...parsed.data, secret });
  try {
    await submitVerifiedReview(id, parsed.data, contentHash);
  } catch (error) {
    if (error instanceof ReviewSubmissionError && error.code === "order-not-eligible") {
      return NextResponse.json({ error: "This completed, payment-confirmed order does not include that cookie." }, { status: 409 });
    }
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "A review for this cookie and order has already been submitted, or this text is a duplicate." }, { status: 409 });
    if (isConcurrentTransactionError(error)) return NextResponse.json({ error: "The order changed while submitting. Refresh and try again." }, { status: 409 });
    console.error("Verified review submission failed.");
    return NextResponse.json({ error: "Could not submit your review. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ message: "Thanks. Your verified-purchase review is pending moderation." }, { status: 201 });
}
