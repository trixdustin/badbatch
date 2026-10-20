import { z } from "zod";

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone: z.string().trim().min(5).max(40),
  address: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(1000).default(""),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20)
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "Each product may appear only once.",
    ),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
