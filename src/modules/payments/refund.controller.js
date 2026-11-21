
import { createRefundSchema } from "./refund.validation.js";
import { createRefund } from "./refund.service.js";

// ============================================
// CREATE REFUND CONTROLLER
// ============================================

export const createRefundController = async (req, res, next) => {
  try {
    // Validate request body
    const validation = createRefundSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund request",
        errors: validation.error.flatten(),
      });
    }

    // Create Stripe refund
    const result = await createRefund(
      validation.data,
      req.user
    );

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};
