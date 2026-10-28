import { z } from "zod";

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone: z.string().trim().min(5).max(40),
  address: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(1000).default(""),
  items: z
    .array(
      z
        .object({
          productId: z.string().min(1).optional(),
          setId: z.enum(["usual4", "doubleTrouble", "fullBatch"]).optional(),
          flavorSlug: z.string().optional(),
          quantity: z.number().int().min(1).max(20),
        })
        .strict()
        .refine((item) => Boolean(item.productId) !== Boolean(item.setId), "Choose either a product or a set.")
        .refine(
          (item) => item.setId === "doubleTrouble" ? Boolean(item.flavorSlug) : !item.flavorSlug,
          "Only Double Trouble takes one flavor selection.",
        ),
    )
    .min(1)
    .max(20)
    .refine(
      (items) => new Set(items.map((item) => item.productId ?? `${item.setId}:${item.flavorSlug ?? ""}`)).size === items.length,
      "Each cart line may appear only once.",
    ),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
