-- REVIEW REQUIRED BEFORE APPLYING.
-- Existing orders currently expose their internal IDs as references. This
-- backfill assigns each existing order a new, stable six-digit reference in
-- creation order. That changes the displayed historical reference and must be
-- explicitly approved. Internal IDs and all relationships remain unchanged.
DO $$
BEGIN
  IF (SELECT count(*) FROM "Order") > 999999 THEN
    RAISE EXCEPTION 'Cannot assign six-digit order numbers: more than 999999 orders exist.';
  END IF;
END
$$;

CREATE SEQUENCE "OrderPublicNumber_seq" MINVALUE 1 MAXVALUE 999999 START WITH 1 NO CYCLE;
ALTER TABLE "Order" ADD COLUMN "publicNumber" CHAR(6);
WITH numbered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "Order"
)
UPDATE "Order" AS o
SET "publicNumber" = lpad(numbered.n::text, 6, '0')
FROM numbered
WHERE numbered."id" = o."id";
ALTER TABLE "Order" ALTER COLUMN "publicNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Order_publicNumber_key" ON "Order"("publicNumber");
SELECT setval('"OrderPublicNumber_seq"', GREATEST((SELECT count(*) FROM "Order"), 1), (SELECT count(*) > 0 FROM "Order"));
