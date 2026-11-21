
import { z } from "zod";

// Validate Admin refund request
export const createRefundSchema = z.object({
  paymentId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid payment ID"),

  amountCents: z
    .number()
    .int()
    .positive("Refund amount must be greater than zero"),

  reason: z
    .enum([
      "requested_by_customer",
      "duplicate",
      "fraudulent",
    ])
    .default("requested_by_customer"),

  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default(""),
});
