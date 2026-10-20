import { z } from "zod";

export const productFields = {
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subtitle: z.string().trim().max(120).default(""),
  category: z.string().trim().min(1).max(80).default("cookie"),
  description: z.string().max(2000),
  price: z.number().finite().min(0).max(100000),
  image: z.string().max(1000),
  isSeasonal: z.boolean(),
  isAvailable: z.boolean(),
  lowStockThreshold: z.number().int().min(0).max(1000000),
};

export const createProductSchema = z.object(productFields).omit({ lowStockThreshold: true }).strict();
export const updateProductSchema = z
  .object(productFields)
  .partial()
  .strict()
  .refine((product) => Object.keys(product).length > 0, "At least one field is required.");

export const productIdSchema = z.string().min(1).max(64);
