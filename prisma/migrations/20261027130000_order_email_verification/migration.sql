ALTER TABLE "Order"
    ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "emailVerificationTokenHash" CHAR(64),
    ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
    ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_emailVerificationTokenHash_key"
    ON "Order"("emailVerificationTokenHash");
