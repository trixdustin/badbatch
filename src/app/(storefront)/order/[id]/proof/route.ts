import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { verifyOrderConfirmationToken } from "@/lib/auth/order-confirmation";
import { maxPaymentProofBytes, validatePaymentImage } from "@/lib/payments/proof";
import { canSubmitWebsiteProof } from "@/lib/payments/state";
import { paymentReferenceSchema } from "@/lib/validation/payment";

const maxRequestBytes = maxPaymentProofBytes + 32 * 1024;

export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/order/[id]/proof">,
) {
  const { id } = await params;
  const confirmationToken = (await cookies()).get("badbatch_order_confirmation")?.value;
  if (!confirmationToken || !(await verifyOrderConfirmationToken(confirmationToken, id))) {
    return NextResponse.json({ error: "This order link has expired or is invalid. Reopen the confirmation link to continue." }, { status: 404 });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Upload a JPG, PNG, or WebP image." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return NextResponse.json({ error: "Payment proof must be 4 MB or smaller." }, { status: 413 });
  }

  let form: FormData | null;
  try {
    form = await readBoundedFormData(request);
  } catch {
    return NextResponse.json({ error: "Could not read the upload. Please try again." }, { status: 400 });
  }
  if (form === null) return NextResponse.json({ error: "Payment proof must be 4 MB or smaller." }, { status: 413 });
  const file = form.get("proof");
  if (!(file instanceof File) || file.size < 1 || file.size > maxPaymentProofBytes) {
    return NextResponse.json({ error: "Choose an image no larger than 4 MB." }, { status: 400 });
  }
  const reference = paymentReferenceSchema.safeParse({ reference: form.get("reference") ?? "" });
  if (!reference.success) {
    return NextResponse.json({ error: "Payment reference must be 120 characters or fewer." }, { status: 400 });
  }

  const imageData = new Uint8Array(await file.arrayBuffer());
  const contentType = validatePaymentImage(imageData, file.size, file.type);
  if (!contentType) {
    return NextResponse.json({ error: "The file must be a valid JPG, PNG, or WebP image." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: { id: true, status: true, paymentStatus: true },
      });
      if (!order) throw new PaymentProofRequestError("missing");
      if (order.status === "CANCELLED") throw new PaymentProofRequestError("closed");
      const pending = await tx.paymentProof.findFirst({
        where: { orderId: id, status: "PENDING" },
        select: { id: true },
      });
      if (!canSubmitWebsiteProof({ paymentStatus: order.paymentStatus, orderStatus: order.status, hasPendingProof: Boolean(pending) })) {
        throw new PaymentProofRequestError(pending ? "pending" : "transition");
      }

      await tx.paymentProof.create({
        data: {
          orderId: id,
          method: "WEBSITE",
          reference: reference.data.reference,
          imageData,
          contentType,
        },
      });
      await tx.order.update({
        where: { id },
        data: {
          paymentStatus: "PROOF_SUBMITTED",
          paymentVerifiedAt: null,
          paymentVerifiedById: null,
          paymentRejectionReason: null,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof PaymentProofRequestError) {
      if (error.code === "missing") return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (error.code === "closed") return NextResponse.json({ error: "This order is closed to payment submissions." }, { status: 409 });
      return NextResponse.json({ error: "A proof is already under review or this order cannot accept another submission." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      return NextResponse.json({ error: "A proof is already under review. Refresh the order page." }, { status: 409 });
    }
    console.error("Payment proof upload failed.");
    return NextResponse.json({ error: "Could not save the payment proof. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "PROOF_SUBMITTED" }, { status: 201 });
}

class PaymentProofRequestError extends Error {
  constructor(readonly code: "missing" | "closed" | "transition" | "pending") {
    super(code);
  }
}

async function readBoundedFormData(request: NextRequest): Promise<FormData | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxRequestBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(body, {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
}
