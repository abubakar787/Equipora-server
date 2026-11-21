
import { z } from "zod";

// Allowed business expense categories
const expenseCategories = [
  "hosting",
  "marketing",
  "software",
  "maintenance",
  "stripe_fee",
  "salary",
  "office",
  "other",
];

// Validate expense creation data
export const createExpenseSchema = z.object({
  title: z.string().trim().min(3).max(120),

  description: z.string().trim().max(1000).optional().default(""),

  category: z.enum(expenseCategories),

  // Store monetary amounts in integer cents (USD)
  amountCents: z.number().int().positive(),

  currency: z.literal("usd").default("usd"),

  expenseDate: z.string().date(),

  reference: z.string().trim().max(150).optional().default(""),
});

// Validate expense update data
export const updateExpenseSchema = createExpenseSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );
