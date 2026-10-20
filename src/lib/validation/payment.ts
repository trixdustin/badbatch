import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);

export const paymentReferenceSchema = z.object({
  reference: optionalText(120),
}).strict();

export const instagramProofSchema = z.object({
  reference: optionalText(120),
  internalNote: optionalText(1000),
}).strict();

export const paymentReviewSchema = z.object({
  proofId: z.string().min(1).max(64),
  action: z.enum(["VERIFY", "REJECT"]),
  rejectionReason: optionalText(1000),
}).strict();
