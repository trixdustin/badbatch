"use client";

import { useState } from "react";
import { useCart, type CartProduct } from "@/components/storefront/cart-provider";
import { QuantitySelector } from "@/components/storefront/quantity-selector";

export function AddToBatchButton({
  product,
  disabled,
}: {
  product: CartProduct;
  disabled?: boolean;
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function addToBatch() {
    addItem(product, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <QuantitySelector label={product.name} onChange={setQuantity} value={quantity} />
      <button
        aria-live="polite"
        className="editorial-button min-w-44"
        disabled={disabled}
        onClick={addToBatch}
        type="button"
      >
        {disabled ? "not available" : added ? "added to batch" : "add to batch"}
      </button>
    </div>
  );
}
