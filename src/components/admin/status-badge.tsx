import type { OrderStatus } from "@prisma/client";
import { formatOrderStatus } from "@/lib/orders/workflow";

const toneClasses: Record<OrderStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800",
  CONFIRMED: "border-sky-300 bg-sky-50 text-sky-800",
  PREPARING: "border-indigo-300 bg-indigo-50 text-indigo-800",
  READY: "border-emerald-300 bg-emerald-50 text-emerald-800",
  COMPLETED: "border-neutral-300 bg-neutral-100 text-neutral-700",
  CANCELLED: "border-red-300 bg-red-50 text-red-800",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs ${toneClasses[status]}`}
    >
      {formatOrderStatus(status)}
    </span>
  );
}
