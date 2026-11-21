
import { z } from "zod";

// Validate equipment ID for adding or removing favorites
export const favoriteSchema = z.object({
  equipmentId: z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    "Invalid equipment ID"
  ),
});

// Validate pagination for favorite listing
export const favoriteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});
