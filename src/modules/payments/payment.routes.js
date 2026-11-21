 
import express from "express";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";
import { createCheckoutSessionController } from "./payment.controller.js";

// Initialize the payment router
const router = express.Router();

// Customer creates a Stripe Checkout Session for an approved booking
// Get payment history for customers, owners and admins
router.get(
  "/history",
  verifyToken,
  authorizeRole("customer", "owner", "admin"),
  getPaymentHistoryController
);
router.post(
  "/checkout/:bookingId",
  verifyToken,
  authorizeRole("customer"),
  createCheckoutSessionController
);

// Import payment controllers
import {
  createCheckoutSessionController,
  getPaymentHistoryController,
} from "./payment.controller.js";



export default router;

