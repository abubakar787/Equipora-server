
import { z } from "zod";

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
