import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createRateLimitFingerprint } from "@/lib/reviews/logic";

export class ReviewSubmissionError extends Error {
  constructor(readonly code: "missing-product" | "order-not-eligible" | "rate-limited" | "duplicate") {
    super(code);
  }
}

export type NewReview = { displayName: string; rating: number; body: string; productId: string | null };

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Review signing key is unavailable.");
  return secret;
}

export async function submitPublicReview(input: NewReview, contentHash: string, ipAddress: string) {
  const secret = getSessionSecret();
  const fingerprint = createRateLimitFingerprint(ipAddress, secret);
  const now = new Date();
  const hourBucket = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
  const recentCutoff = new Date(now.getTime() - 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    if (input.productId) {
      const product = await tx.product.findUnique({ where: { id: input.productId }, select: { id: true } });
      if (!product) throw new ReviewSubmissionError("missing-product");
    }

    const recentCount = await tx.reviewSubmissionLimit.count({
      where: { fingerprint, createdAt: { gte: recentCutoff } },
    });
    if (recentCount >= 5) throw new ReviewSubmissionError("rate-limited");
    const bucketCount = await tx.reviewSubmissionLimit.count({ where: { fingerprint, bucket: hourBucket } });

    const review = await tx.customerReview.create({
      data: { ...input, contentHash },
      select: { id: true },
    });
    await tx.reviewSubmissionLimit.create({
      data: { fingerprint, bucket: hourBucket, slot: bucketCount },
    });
    await tx.reviewSubmissionLimit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) } } });
    return review;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitVerifiedReview(
  orderId: string,
  input: Omit<NewReview, "productId"> & { productId: string },
  contentHash: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        paymentStatus: true,
        items: { where: { productId: input.productId }, select: { productId: true }, take: 1 },
      },
    });
    if (!order) throw new ReviewSubmissionError("order-not-eligible");
    if (order.status !== "COMPLETED" || order.paymentStatus !== "CONFIRMED" || order.items.length !== 1) {
      throw new ReviewSubmissionError("order-not-eligible");
    }
    return tx.customerReview.create({
      data: { ...input, orderId, contentHash },
      select: { id: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function getReviewRequestIp(headers: Headers) {
  const direct = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip");
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return direct?.trim() || forwarded || "unknown";
}

export function readReviewRequestBody(request: Request, maxBytes = 16 * 1024): Promise<unknown | null> {
  return (async () => {
    const reader = request.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      return null;
    }
  })();
}

export function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isConcurrentTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
