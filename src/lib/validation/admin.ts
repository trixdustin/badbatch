import { OrderStatus } from "@prisma/client";
import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password is too long."),
});

export const orderStatusSchema = z.object({
  status: z.enum(OrderStatus),
});

export const orderIdSchema = z.string().min(1).max(64);

export const storeSettingsSchema = z
  .object({
    orderingEnabled: z.boolean().optional(),
    announcement: z.string().max(500).optional(),
    seasonalProductId: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((settings) => Object.keys(settings).length > 0, "At least one field is required.");
