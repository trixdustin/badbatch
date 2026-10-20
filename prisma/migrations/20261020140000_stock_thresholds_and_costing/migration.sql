-- Add a configurable alert threshold without changing any product stock.
-- Existing products receive threshold 5; stock=NULL remains untracked.
-- Costing tables start empty. Existing order and POS records are untouched.
ALTER TABLE "Product"
ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

CREATE TYPE "IngredientUnit" AS ENUM ('GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'UNIT');

CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchaseQuantity" DECIMAL(12,3) NOT NULL,
    "purchaseUnit" "IngredientUnit" NOT NULL,
    "purchaseCost" DECIMAL(12,2) NOT NULL,
    "costPerBaseUnit" DECIMAL(18,8) NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductRecipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "batchYield" INTEGER NOT NULL,
    "sellingPriceSnapshot" DECIMAL(10,2) NOT NULL,
    "cookieWeight" DECIMAL(10,3),
    "packagingCostPerCookie" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "additionalDirectCostPerCookie" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeVersionIngredient" (
    "id" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "ingredientName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "IngredientUnit" NOT NULL,
    "costPerBaseUnitSnapshot" DECIMAL(18,8) NOT NULL,
    "ingredientCostSnapshot" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "RecipeVersionIngredient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductRecipe_productId_key" ON "ProductRecipe"("productId");
CREATE INDEX "Ingredient_name_idx" ON "Ingredient"("name");
CREATE UNIQUE INDEX "RecipeVersion_recipeId_version_key" ON "RecipeVersion"("recipeId", "version");
CREATE INDEX "RecipeVersion_recipeId_createdAt_idx" ON "RecipeVersion"("recipeId", "createdAt");
CREATE INDEX "RecipeVersionIngredient_recipeVersionId_idx" ON "RecipeVersionIngredient"("recipeVersionId");
CREATE INDEX "RecipeVersionIngredient_ingredientId_idx" ON "RecipeVersionIngredient"("ingredientId");

ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_recipeId_fkey"
FOREIGN KEY ("recipeId") REFERENCES "ProductRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeVersionIngredient" ADD CONSTRAINT "RecipeVersionIngredient_recipeVersionId_fkey"
FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeVersionIngredient" ADD CONSTRAINT "RecipeVersionIngredient_ingredientId_fkey"
FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Match application validation at the database boundary. Zero is valid for
-- optional direct costs and for a rounded ingredient line snapshot.
ALTER TABLE "Product" ADD CONSTRAINT "Product_lowStockThreshold_range_check"
CHECK ("lowStockThreshold" BETWEEN 0 AND 1000000);

ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_purchaseQuantity_range_check"
CHECK ("purchaseQuantity" > 0 AND "purchaseQuantity" <= 999999999.999);
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_purchaseCost_range_check"
CHECK ("purchaseCost" > 0 AND "purchaseCost" <= 1000000000.00);
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_costPerBaseUnit_range_check"
CHECK ("costPerBaseUnit" > 0 AND "costPerBaseUnit" < 10000000000);

ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_version_range_check"
CHECK ("version" BETWEEN 1 AND 2147483647);
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_batchYield_range_check"
CHECK ("batchYield" BETWEEN 1 AND 100000);
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_sellingPriceSnapshot_range_check"
CHECK ("sellingPriceSnapshot" BETWEEN 0 AND 100000.00);
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_cookieWeight_range_check"
CHECK ("cookieWeight" IS NULL OR ("cookieWeight" > 0 AND "cookieWeight" <= 100000));
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_packagingCostPerCookie_range_check"
CHECK ("packagingCostPerCookie" BETWEEN 0 AND 99999999.99);
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_additionalDirectCostPerCookie_range_check"
CHECK ("additionalDirectCostPerCookie" BETWEEN 0 AND 99999999.99);

ALTER TABLE "RecipeVersionIngredient" ADD CONSTRAINT "RecipeVersionIngredient_quantity_range_check"
CHECK ("quantity" > 0 AND "quantity" <= 999999999.999);
ALTER TABLE "RecipeVersionIngredient" ADD CONSTRAINT "RecipeVersionIngredient_costPerBaseUnitSnapshot_range_check"
CHECK ("costPerBaseUnitSnapshot" > 0 AND "costPerBaseUnitSnapshot" < 10000000000);
ALTER TABLE "RecipeVersionIngredient" ADD CONSTRAINT "RecipeVersionIngredient_ingredientCostSnapshot_range_check"
CHECK ("ingredientCostSnapshot" BETWEEN 0 AND 9999999999.99);

-- Prevent accidental re-parenting or removal of recipe history. The only
-- permitted snapshot-row update is Ingredient ON DELETE SET NULL; its saved
-- name, units, quantities, and costs must remain unchanged.
CREATE FUNCTION "reject_recipe_snapshot_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'RecipeVersionIngredient'
       AND TG_OP = 'UPDATE'
       AND OLD."ingredientId" IS NOT NULL
       AND NEW."ingredientId" IS NULL
       AND (NEW."id", NEW."recipeVersionId", NEW."ingredientName", NEW."quantity", NEW."unit", NEW."costPerBaseUnitSnapshot", NEW."ingredientCostSnapshot")
           IS NOT DISTINCT FROM
           (OLD."id", OLD."recipeVersionId", OLD."ingredientName", OLD."quantity", OLD."unit", OLD."costPerBaseUnitSnapshot", OLD."ingredientCostSnapshot")
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Recipe cost history is immutable; create a new recipe version.'
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "ProductRecipe_immutable_history"
BEFORE UPDATE OR DELETE ON "ProductRecipe"
FOR EACH ROW EXECUTE FUNCTION "reject_recipe_snapshot_mutation"();
CREATE TRIGGER "RecipeVersion_immutable_history"
BEFORE UPDATE OR DELETE ON "RecipeVersion"
FOR EACH ROW EXECUTE FUNCTION "reject_recipe_snapshot_mutation"();
CREATE TRIGGER "RecipeVersionIngredient_immutable_snapshot"
BEFORE UPDATE OR DELETE ON "RecipeVersionIngredient"
FOR EACH ROW EXECUTE FUNCTION "reject_recipe_snapshot_mutation"();
