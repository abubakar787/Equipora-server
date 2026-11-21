 
import express from "express";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";
import { createCheckoutSessionController } from "./payment.controller.js";

// Initialize the payment router
const router = express.Router();

// Customer creates a Stripe Checkout Session for an approved booking
router.post(
  "/checkout/:bookingId",
  verifyToken,
  authorizeRole("customer"),
  createCheckoutSessionController
);

export default router;
