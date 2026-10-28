import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

export const posSaleSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(64).optional(),
          setId: z.enum(["usual4", "doubleTrouble", "fullBatch"]).optional(),
          flavorSlug: z.string().min(1).max(120).optional(),
          quantity: z.number().int().min(1).max(1000),
        }).strict().refine((item) => Boolean(item.productId) !== Boolean(item.setId), "Choose a product or set.").refine((item) => item.setId === "doubleTrouble" ? Boolean(item.flavorSlug) : !item.flavorSlug, "Only Double Trouble takes a flavor selection."),
      )
      .min(1)
      .max(100)
      .refine(
        (items) => new Set(items.map((item) => item.productId ?? `${item.setId}:${item.flavorSlug ?? ""}`)).size === items.length,
        "Each sale line may appear only once.",
      ),
    paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.OTHER]),
    note: z.string().trim().max(500).optional().default(""),
  })
  .strict();

export type PosSaleInput = z.infer<typeof posSaleSchema>;
