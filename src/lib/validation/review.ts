import { z } from "zod";

export const publicReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  displayName: z.string().trim().min(2).max(80),
  body: z.string().trim().min(10).max(1200),
  productId: z.string().trim().min(1).max(64).nullable().optional(),
}).strict();

export const verifiedReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  displayName: z.string().trim().min(2).max(80),
  body: z.string().trim().min(10).max(1200),
  productId: z.string().trim().min(1).max(64),
}).strict();

export const reviewModerationSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "HIDE"]),
}).strict();

export const reviewIdSchema = z.string().trim().min(1).max(64);
