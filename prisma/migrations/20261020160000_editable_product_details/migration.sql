-- Add editable storefront copy without changing product identifiers, slugs,
-- prices, availability, stock, or any order/POS records.
ALTER TABLE "Product"
ADD COLUMN "subtitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'cookie';

-- Keep existing storefront text when replacing the old slug-based copy map.
UPDATE "Product"
SET "subtitle" = CASE "slug"
    WHEN 'the-classic' THEN 'Chocolate Chip'
    WHEN 'the-dark' THEN 'S’mores'
    WHEN 'the-third' THEN 'Biscoff White Chocolate'
    WHEN 'seasonal' THEN 'Rotating seasonal cookie'
    ELSE ''
END
WHERE "slug" IN ('the-classic', 'the-dark', 'the-third', 'seasonal');

-- Preserve the current title case for products still using the original seed names.
UPDATE "Product"
SET "name" = CASE "slug"
    WHEN 'the-classic' THEN 'The Usual'
    WHEN 'the-dark' THEN 'Burn Notice'
    WHEN 'the-third' THEN 'White Lie'
    WHEN 'seasonal' THEN 'Seasonal'
END
WHERE ("slug" = 'the-classic' AND "name" = 'the usual')
   OR ("slug" = 'the-dark' AND "name" = 'burn notice')
   OR ("slug" = 'the-third' AND "name" = 'white lie')
   OR ("slug" = 'seasonal' AND "name" = 'seasonal');

-- The old storefront ignored Product.description and rendered these copy-map
-- descriptions. Convert only untouched seed descriptions so existing custom
-- admin descriptions remain intact.
UPDATE "Product"
SET "description" = CASE "slug"
    WHEN 'the-classic' THEN 'The one you come back for.'
    WHEN 'the-dark' THEN 'S’mores, in cookie form.'
    WHEN 'the-third' THEN 'Biscoff with white chocolate.'
    WHEN 'seasonal' THEN 'The current seasonal cookie.'
END
WHERE ("slug" = 'the-classic' AND "description" = 'chocolate chip')
   OR ("slug" = 'the-dark' AND "description" = 's’mores')
   OR ("slug" = 'the-third' AND "description" = 'biscoff + white chocolate')
   OR ("slug" = 'seasonal' AND "description" = 'rotating limited batch');
