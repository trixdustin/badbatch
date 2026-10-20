-- Payment proof workflow. Existing orders remain NULL (untracked) rather than
-- being represented as unpaid; new checkout orders set AWAITING_PAYMENT.
CREATE TYPE "PaymentStatus" AS ENUM (
    'AWAITING_PAYMENT',
    'PROOF_SUBMITTED',
    'VERIFICATION_REQUIRED',
    'CONFIRMED',
    'REJECTED'
);
CREATE TYPE "PaymentProofMethod" AS ENUM ('WEBSITE', 'INSTAGRAM');
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "Order"
    ADD COLUMN "paymentStatus" "PaymentStatus",
    ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "paymentVerifiedById" TEXT,
    ADD COLUMN "paymentRejectionReason" TEXT;

CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentProofMethod" NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "imageData" BYTEA,
    "contentType" TEXT,
    "internalNote" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentProof_orderId_submittedAt_idx"
    ON "PaymentProof"("orderId", "submittedAt");
CREATE INDEX "PaymentProof_reviewedByAdminId_idx"
    ON "PaymentProof"("reviewedByAdminId");

-- At most one proof can await review for an order. A rejected proof can be
-- followed by a new submission, preserving the full review history.
CREATE UNIQUE INDEX "PaymentProof_one_pending_per_order_key"
    ON "PaymentProof"("orderId") WHERE "status" = 'PENDING';

ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_image_method_check"
CHECK (
    ("method" = 'WEBSITE' AND "imageData" IS NOT NULL AND "contentType" IS NOT NULL AND "contentType" IN ('image/jpeg', 'image/png', 'image/webp'))
    OR
    ("method" = 'INSTAGRAM' AND "imageData" IS NULL AND "contentType" IS NULL)
);
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_reference_length_check"
CHECK ("reference" IS NULL OR char_length("reference") <= 120);
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_image_size_check"
CHECK ("imageData" IS NULL OR octet_length("imageData") <= 4194304);
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_internalNote_length_check"
CHECK ("internalNote" IS NULL OR char_length("internalNote") <= 1000);
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_rejectionReason_length_check"
CHECK ("rejectionReason" IS NULL OR char_length("rejectionReason") <= 1000);
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_review_state_check"
CHECK (
    ("status" = 'PENDING' AND "reviewedAt" IS NULL AND "rejectionReason" IS NULL)
    OR ("status" = 'VERIFIED' AND "reviewedAt" IS NOT NULL AND "rejectionReason" IS NULL)
    OR ("status" = 'REJECTED' AND "reviewedAt" IS NOT NULL)
);

ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentRejectionReason_length_check"
CHECK ("paymentRejectionReason" IS NULL OR char_length("paymentRejectionReason") <= 1000);
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentVerification_state_check"
CHECK (
    ("paymentStatus" = 'CONFIRMED' AND "paymentVerifiedAt" IS NOT NULL)
    OR ("paymentStatus" IS DISTINCT FROM 'CONFIRMED' AND "paymentVerifiedAt" IS NULL AND "paymentVerifiedById" IS NULL)
);

ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_reviewedByAdminId_fkey"
FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentVerifiedById_fkey"
FOREIGN KEY ("paymentVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
