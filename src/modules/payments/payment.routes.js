import express from "express";

// Authentication and role authorization
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

// Import both payment controllers only once
import {
  createCheckoutSessionController,
  getPaymentHistoryController,
} from "./payment.controller.js";

const router = express.Router();

// Get payment history for customers, owners and admins
router.get(
  "/history",
  verifyToken,
  authorizeRole("customer", "owner", "admin"),
  getPaymentHistoryController
);

// Create Stripe Checkout Session for an approved booking
router.post(
  "/checkout/:bookingId",
  verifyToken,
  authorizeRole("customer"),
  createCheckoutSessionController
);

export default router;