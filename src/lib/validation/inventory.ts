import { z } from "zod";
import { InventoryReason } from "@prisma/client";

// Reasons an admin may record directly from the inventory screen.
const manualReasons = [
  InventoryReason.RESTOCK,
  InventoryReason.WASTE,
  InventoryReason.CORRECTION,
] as const;

export const inventoryAdjustmentSchema = z
  .object({
    productId: z.string().min(1).max(64),
    // Signed change: positive adds stock, negative removes it.
    change: z.number().int().refine((value) => value !== 0, "Change must be a non-zero whole number."),
    reason: z.enum(manualReasons),
    note: z.string().trim().max(500).optional().default(""),
  })
  .strict();

export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
