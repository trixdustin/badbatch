-- Correct the legacy S'mores description missed by the previous backfill due
-- to an encoding mismatch. Only replace the exact untouched legacy copy.
UPDATE "Product"
SET "description" = 'S’mores, in cookie form.'
WHERE "slug" = 'the-dark'
  AND "description" = 's’mores';
