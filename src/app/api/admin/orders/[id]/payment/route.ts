import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";
import { readJson } from "@/lib/http/read-json";
import { sendPaymentConfirmedEmail } from "@/lib/email/notifications";
import { instagramProofSchema, paymentReviewSchema } from "@/lib/validation/payment";
import { canRecordInstagramProof, canReviewPayment } from "@/lib/payments/state";

export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/orders/[id]/payment">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await params;
  const parsed = instagramProofSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid Instagram proof details." }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: { id: true, status: true, paymentStatus: true },
      });
      if (!order) throw new PaymentAdminError("missing");
      if (order.status === "CANCELLED") throw new PaymentAdminError("closed");
      const pending = await tx.paymentProof.findFirst({
        where: { orderId: id, status: "PENDING" },
        select: { id: true },
      });
      if (!canRecordInstagramProof({ paymentStatus: order.paymentStatus, orderStatus: order.status, hasPendingProof: Boolean(pending) })) {
        throw new PaymentAdminError(pending ? "pending" : "transition");
      }

      await tx.paymentProof.create({
        data: {
          orderId: id,
          method: "INSTAGRAM",
          reference: parsed.data.reference,
          internalNote: parsed.data.internalNote,
        },
      });
      await tx.order.update({
        where: { id },
        data: {
          paymentStatus: "VERIFICATION_REQUIRED",
          paymentVerifiedAt: null,
          paymentVerifiedById: null,
          paymentRejectionReason: null,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const failure = getPaymentAdminFailure(error);
    if (failure) return failure;
    console.error("Instagram payment proof record failed.");
    return NextResponse.json({ error: "Could not record the proof." }, { status: 500 });
  }

  return NextResponse.json({ status: "VERIFICATION_REQUIRED" }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/admin/orders/[id]/payment">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await params;
  const parsed = paymentReviewSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid payment review details." }, { status: 400 });

  let confirmation: { to: string; customerName: string; orderNumber: string; total: number } | null = null;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          paymentStatus: true,
          email: true,
          customerName: true,
          publicNumber: true,
          total: true,
        },
      });
      if (!order) throw new PaymentAdminError("missing");
      const proof = await tx.paymentProof.findFirst({
        where: { id: parsed.data.proofId, orderId: id, status: "PENDING" },
        select: { id: true },
      });
      if (!proof) throw new PaymentAdminError("pending");
      if (!canReviewPayment({ paymentStatus: order.paymentStatus, proofStatus: "PENDING" })) {
        throw new PaymentAdminError("transition");
      }

      const reviewedAt = new Date();
      if (parsed.data.action === "VERIFY") {
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            status: "VERIFIED",
            reviewedAt,
            reviewedByAdminId: auth.admin.id,
            rejectionReason: null,
          },
        });
        await tx.order.update({
          where: { id },
          data: {
            paymentStatus: "CONFIRMED",
            paymentVerifiedAt: reviewedAt,
            paymentVerifiedById: auth.admin.id,
            paymentRejectionReason: null,
          },
        });
        return { verified: true as const, order };
      }

      await tx.paymentProof.update({
        where: { id: proof.id },
        data: {
          status: "REJECTED",
          reviewedAt,
          reviewedByAdminId: auth.admin.id,
          rejectionReason: parsed.data.rejectionReason,
        },
      });
      await tx.order.update({
        where: { id },
        data: {
          paymentStatus: "REJECTED",
          paymentVerifiedAt: null,
          paymentVerifiedById: null,
          paymentRejectionReason: parsed.data.rejectionReason,
        },
      });
      return { verified: false as const, order };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.verified) {
      confirmation = {
        to: result.order.email,
        customerName: result.order.customerName,
        orderNumber: result.order.publicNumber,
        total: Number(result.order.total),
      };
    }
  } catch (error) {
    const failure = getPaymentAdminFailure(error);
    if (failure) return failure;
    console.error("Payment verification update failed.");
    return NextResponse.json({ error: "Could not update payment status." }, { status: 500 });
  }

  if (confirmation) {
    const emailed = await sendPaymentConfirmedEmail(confirmation);
    if (!emailed) console.warn("Payment confirmation email was not sent; payment status remains confirmed.");
  }
  return NextResponse.json({ status: parsed.data.action === "VERIFY" ? "CONFIRMED" : "REJECTED" });
}

class PaymentAdminError extends Error {
  constructor(readonly code: "missing" | "closed" | "transition" | "pending") {
    super(code);
  }
}

function getPaymentAdminFailure(error: unknown) {
  if (error instanceof PaymentAdminError) {
    if (error.code === "missing") return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (error.code === "closed") return NextResponse.json({ error: "This order cannot accept payment proof." }, { status: 409 });
    if (error.code === "transition") return NextResponse.json({ error: "This payment status cannot make that transition." }, { status: 409 });
    return NextResponse.json({ error: "There is no pending proof for this order." }, { status: 409 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
    return NextResponse.json({ error: "The payment proof changed concurrently. Refresh and try again." }, { status: 409 });
  }
  return null;
}
