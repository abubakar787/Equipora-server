
import { createCheckoutSession } from "./payment.service.js";

// Create a Stripe Checkout Session for the logged-in customer
export const createCheckoutSessionController = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const result = await createCheckoutSession(bookingId, req.user);

    return res.status(200).json({
      success: true,
      message: "Stripe Checkout Session created successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
