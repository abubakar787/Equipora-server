
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().default(""),
  image: z.string().url().optional().or(z.literal("")),
  icon: z.string().max(100).optional().default(""),
  parentId: z.string().optional().nullable(),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );
