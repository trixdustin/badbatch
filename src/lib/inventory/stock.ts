import type { InventoryReason, PaymentMethod, Prisma } from "@prisma/client";

export const inventoryReasonLabels: Record<InventoryReason, string> = {
  RESTOCK: "New batch / restock",
  WASTE: "Waste / spoilage",
  CORRECTION: "Manual correction",
  SALE: "POS sale",
  ONLINE_ORDER: "Online order",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  OTHER: "Other",
};

/** A product's inventory is "tracked" only when stock is a non-null integer. */
export function isStockTracked(stock: number | null): stock is number {
  return typeof stock === "number" && Number.isInteger(stock);
}

/**
 * Whether a product can currently be added to a cart / POS sale.
 * - Untracked stock (null) falls back to the availability flag only.
 * - Tracked stock requires stock > 0 in addition to being available.
 */
export function isPurchasable(product: {
  isAvailable: boolean;
  stock: number | null;
}): boolean {
  if (!product.isAvailable) return false;
  if (!isStockTracked(product.stock)) return true;
  return product.stock > 0;
}

/** Short label describing a product's stock state for admin lists. */
export function stockStateLabel(product: {
  isAvailable: boolean;
  stock: number | null;
  lowStockThreshold: number;
}): { text: "In Stock" | "Low Stock" | "Out of Stock" | "Not Tracked"; tone: "muted" | "ok" | "warn" | "danger" } {
  if (!isStockTracked(product.stock)) {
    return { text: "Not Tracked", tone: "muted" };
  }
  if (product.stock <= 0) {
    return { text: "Out of Stock", tone: "danger" };
  }
  if (product.stock <= product.lowStockThreshold) {
    return { text: "Low Stock", tone: "warn" };
  }
  return { text: "In Stock", tone: "ok" };
}

/**
 * Atomically decrement a tracked product's stock, refusing to go negative.
 * Returns the number of rows updated (1 = success, 0 = insufficient stock or
 * untracked). Must be called inside a transaction; combined with a
 * Serializable isolation level this prevents overselling under concurrency.
 */
export async function decrementStock(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
): Promise<number> {
  const result = await tx.product.updateMany({
    where: { id: productId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  return result.count;
}
