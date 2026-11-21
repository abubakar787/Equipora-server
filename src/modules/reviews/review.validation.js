
import { z } from "zod";

// Validate customer equipment review
export const createReviewSchema = z.object({
  bookingId: z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    "Invalid booking ID"
  ),

  rating: z.number().int().min(1).max(5),

  comment: z.string().trim().min(5).max(1000),
});

// Validate review update
export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),

  comment: z.string().trim().min(5).max(1000).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  "At least one review field is required"
);

// Validate review listing pagination
export const reviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Validate admin review moderation request
 */
export const reviewModerationSchema = z.object({
  status: z.enum(["approved", "rejected"]),

  moderationNote: z.string().trim().max(500).optional().default(""),
});
