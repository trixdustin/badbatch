-- Customer reviews are stored privately as pending until admin moderation.
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

CREATE TABLE "CustomerReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "orderId" TEXT,
    "displayName" VARCHAR(80) NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" VARCHAR(1200) NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "CustomerReview_displayName_check" CHECK (char_length("displayName") BETWEEN 2 AND 80),
    CONSTRAINT "CustomerReview_body_check" CHECK (char_length("body") BETWEEN 10 AND 1200)
);

CREATE TABLE "ReviewSubmissionLimit" (
    "id" TEXT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "slot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSubmissionLimit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReviewSubmissionLimit_slot_check" CHECK ("slot" BETWEEN 0 AND 4)
);

CREATE UNIQUE INDEX "CustomerReview_contentHash_key" ON "CustomerReview"("contentHash");
CREATE UNIQUE INDEX "CustomerReview_orderId_productId_key" ON "CustomerReview"("orderId", "productId");
CREATE INDEX "CustomerReview_status_createdAt_idx" ON "CustomerReview"("status", "createdAt");
CREATE INDEX "CustomerReview_status_rating_createdAt_idx" ON "CustomerReview"("status", "rating", "createdAt");
CREATE INDEX "CustomerReview_productId_status_createdAt_idx" ON "CustomerReview"("productId", "status", "createdAt");
CREATE UNIQUE INDEX "ReviewSubmissionLimit_fingerprint_bucket_slot_key" ON "ReviewSubmissionLimit"("fingerprint", "bucket", "slot");
CREATE INDEX "ReviewSubmissionLimit_fingerprint_createdAt_idx" ON "ReviewSubmissionLimit"("fingerprint", "createdAt");
CREATE INDEX "ReviewSubmissionLimit_createdAt_idx" ON "ReviewSubmissionLimit"("createdAt");

ALTER TABLE "CustomerReview"
ADD CONSTRAINT "CustomerReview_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerReview"
ADD CONSTRAINT "CustomerReview_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Give the existing seasonal item the requested current name only when it
-- still has the untouched default copy. Admin-customized copy is preserved.
UPDATE "Product" SET "name" = 'After Hours'
WHERE "slug" = 'seasonal' AND "name" = 'Seasonal';

UPDATE "Product" SET "subtitle" = 'Cookies & Cream'
WHERE "slug" = 'seasonal' AND "subtitle" = 'Rotating seasonal cookie';
