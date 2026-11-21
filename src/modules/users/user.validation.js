
import { z } from "zod";

// Validate profile update information
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  image: z.string().url().max(500).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  "At least one profile field is required"
);

// Validate admin user listing filters
export const userQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(["customer", "owner", "admin"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Validate role changes by admin
export const updateUserRoleSchema = z.object({
  role: z.enum(["customer", "owner", "admin"]),
});
