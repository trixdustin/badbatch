import { NextRequest, NextResponse } from "next/server";
import { createReviewFingerprint } from "@/lib/reviews/logic";
import { isConcurrentTransactionError, isUniqueConstraintError, readReviewRequestBody, ReviewSubmissionError, getReviewRequestIp, submitPublicReview } from "@/lib/reviews/submission";
import { publicReviewSchema } from "@/lib/validation/review";

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Submit the review form to continue." }, { status: 415 });
  }
  const body = await readReviewRequestBody(request);
  const parsed = publicReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a display name, a rating from 1 to 5, and a review between 10 and 1,200 characters." }, { status: 400 });
  }

  const input = { ...parsed.data, productId: parsed.data.productId || null };
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Reviews are temporarily unavailable." }, { status: 503 });
  const contentHash = createReviewFingerprint({ ...input, secret });
  try {
    await submitPublicReview(input, contentHash, getReviewRequestIp(request.headers));
  } catch (error) {
    if (error instanceof ReviewSubmissionError) {
      if (error.code === "missing-product") return NextResponse.json({ error: "Choose a cookie from the list or submit a review for all cookies." }, { status: 400 });
      if (error.code === "rate-limited") return NextResponse.json({ error: "Too many reviews were sent from this connection. Please try again later." }, { status: 429 });
    }
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "This review has already been submitted." }, { status: 409 });
    if (isConcurrentTransactionError(error)) return NextResponse.json({ error: "Another review was just submitted from this connection. Please try again later." }, { status: 429 });
    console.error("Public review submission failed.");
    return NextResponse.json({ error: "Could not submit your review. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ message: "Thanks. Your review is pending moderation and will appear only if approved." }, { status: 201 });
}
