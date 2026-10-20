import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/auth/api";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/admin/orders/[id]/proof/[proofId]">,
) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id, proofId } = await params;
  const proof = await prisma.paymentProof.findFirst({
    where: { id: proofId, orderId: id, method: "WEBSITE" },
    select: { imageData: true, contentType: true },
  });
  if (!proof?.imageData || !proof.contentType) return NextResponse.json({ error: "Proof not found." }, { status: 404 });

  return new NextResponse(Buffer.from(proof.imageData), {
    headers: {
      "Content-Type": proof.contentType,
      "Content-Length": String(proof.imageData.byteLength),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
