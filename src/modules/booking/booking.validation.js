
import { z } from "zod";

// Valid booking statuses across the platform
export const BOOKING_STATUSES = [
  "pending_payment",
  "approved_for_payment",
  "confirmed",
  "active",
  "completed",
  "rejected",
  "cancelled",
  "expired",
];

// Validate booking creation
export const createBookingSchema = z
  .object({
    equipmentId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid equipment ID"),

    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),

    rentalType: z.enum(["hourly", "daily", "weekly", "monthly"]),

    quantity: z.number().int().min(1),

    contactName: z.string().trim().min(2).max(100),
    contactPhone: z.string().trim().min(7).max(20),

    deliveryAddress: z.string().trim().min(5).max(300),

    notes: z.string().trim().max(1000).optional().default(""),
  })
  .refine(
    (data) => new Date(data.endAt) > new Date(data.startAt),
    {
      message: "End time must be after start time",
      path: ["endAt"],
    }
  );

// Customer and Owner booking list filters
export const bookingQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(10),
});

// Admin booking filters
// Frontend sends: pending, approved, confirmed, etc.
export const adminBookingQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),

  status: z.enum([
    "pending",
    "approved",
    "confirmed",
    "rejected",
    "cancelled",
    "completed",
    ...BOOKING_STATUSES,
  ]).optional(),

  paymentStatus: z.enum([
    "paid",
    "pending",
    "unpaid",
    "failed",
    "refunded",
  ]).optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
