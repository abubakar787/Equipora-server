 
import { z } from "zod";

// ============================================
// COMMON VALIDATION
// ============================================

const objectIdSchema = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  "Invalid MongoDB ID"
);

const pricingSchema = z.object({
  hourly: z.number().positive().optional(),
  daily: z.number().positive().optional(),
  weekly: z.number().positive().optional(),
  monthly: z.number().positive().optional(),
}).refine(
  (data) => Object.values(data).some(
    (value) => value !== undefined
  ),
  "At least one rental price is required"
);

const availabilitySchema = z.object({
  availableFrom: z.string().date(),
  availableUntil: z.string().date(),
}).refine(
  (data) => data.availableFrom <= data.availableUntil,
  "Available until date must be after available from date"
);

// ============================================
// CREATE EQUIPMENT
// ============================================

export const createEquipmentSchema = z.object({
  title: z.string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(100),

  description: z.string()
    .trim()
    .min(20, "Description must be at least 20 characters")
    .max(2000),

  categoryId: objectIdSchema,

  location: z.string()
    .trim()
    .min(3)
    .max(150),

  rentalType: z.enum([
    "hourly",
    "daily",
    "weekly",
    "monthly",
  ]),

  // Primary rental price, used for listing and sorting
  price: z.number().positive(),

  // All available rental rates
  pricing: pricingSchema,

  quantity: z.number()
    .int()
    .min(1),

  images: z.array(
    z.string().url("Each image must be a valid URL")
  )
    .min(1, "At least one equipment image is required")
    .max(5, "Maximum 5 images are allowed"),

  availability: availabilitySchema,
});

// ============================================
// UPDATE EQUIPMENT
// ============================================

export const updateEquipmentSchema = createEquipmentSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );

// ============================================
// PUBLIC EQUIPMENT QUERY
// ============================================

export const equipmentQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),

  // MongoDB category ID
  category: objectIdSchema.optional(),

  location: z.string().trim().max(150).optional(),

  sort: z.enum([
    "newest",
    "price_asc",
    "price_desc",
  ]).default("newest"),

  page: z.coerce.number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(24)
    .default(9),
});

// ============================================
// OWNER: MY EQUIPMENT QUERY
// ============================================

export const myEquipmentQuerySchema = z.object({
  status: z.enum([
    "all",
    "pending",
    "approved",
    "rejected",
  ]).default("all"),

  page: z.coerce.number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(24)
    .default(9),
});

// ============================================
// ADMIN: EQUIPMENT REVIEW
// ============================================

export const equipmentReviewSchema = z.object({
  status: z.enum([
    "approved",
    "rejected",
  ]),

  reviewNote: z.string()
    .trim()
    .max(500)
    .optional()
    .default(""),
});
