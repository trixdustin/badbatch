import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

export const posSaleSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(64),
          quantity: z.number().int().min(1).max(1000),
        }),
      )
      .min(1)
      .max(100)
      .refine(
        (items) => new Set(items.map((item) => item.productId)).size === items.length,
        "Each product may appear only once.",
      ),
    paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.OTHER]),
    note: z.string().trim().max(500).optional().default(""),
  })
  .strict();

export type PosSaleInput = z.infer<typeof posSaleSchema>;
