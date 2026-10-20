import type { OrderStatus } from "@prisma/client";

export const orderTransitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

export function availableOrderTransitions(status: OrderStatus): readonly OrderStatus[] {
  return orderTransitions[status];
}

export function formatOrderStatus(status: OrderStatus) {
  return status.toLowerCase().replaceAll("_", " ");
}

/** Clear, staff-facing verb for a valid next transition, used as a button label. */
export function nextActionLabel(status: OrderStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "Confirm order";
    case "PREPARING":
      return "Start preparing";
    case "READY":
      return "Mark ready";
    case "COMPLETED":
      return "Mark completed";
    case "CANCELLED":
      return "Cancel order";
    default:
      return formatOrderStatus(status);
  }
}
