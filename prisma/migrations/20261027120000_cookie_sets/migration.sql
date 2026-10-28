ALTER TABLE "OrderItem" ADD COLUMN "setId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "setContents" JSONB;
ALTER TABLE "PosSaleItem" ADD COLUMN "setId" TEXT;
ALTER TABLE "PosSaleItem" ADD COLUMN "setContents" JSONB;

-- Fill only the zero-price placeholders created by the original seed. This
-- intentionally preserves any non-zero price an admin has since configured.
-- Product IDs, existing orders, and historical item price snapshots are unchanged.
UPDATE "Product" SET "price" = 70.00 WHERE "slug" = 'the-classic' AND "price" = 0.00;
UPDATE "Product" SET "price" = 80.00 WHERE "slug" = 'the-dark' AND "price" = 0.00;
UPDATE "Product" SET "price" = 90.00 WHERE "slug" = 'the-third' AND "price" = 0.00;
UPDATE "Product" SET "price" = 80.00 WHERE "slug" = 'seasonal' AND "price" = 0.00;
