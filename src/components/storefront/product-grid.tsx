import type { StorefrontProduct } from "@/components/storefront/product-item";
import { ProductItem } from "@/components/storefront/product-item";

export function ProductGrid({ products }: { products: StorefrontProduct[] }) {
  return (
    <div className="border-b border-[var(--rule)]">
      {products.map((product, position) => (
        <ProductItem
          index={String(position + 1).padStart(2, "0")}
          key={product.id}
          product={product}
        />
      ))}
    </div>
  );
}
