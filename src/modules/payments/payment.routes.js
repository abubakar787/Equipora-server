import express from "express";

// Authentication and role authorization
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

// Import both payment controllers only once
import {
  createCheckoutSessionController,
  getPaymentHistoryController,
} from "./payment.controller.js";


// Financial dashboard controller
import {
  getFinancialSummaryController,
} from "./financial.controller.js";

// Financial settings controllers
import {
  getFinancialSettingsController,
  updateFinancialSettingsController,
} from "./financial-settings.controller.js";

const router = express.Router();


// Admin-only financial settings
router.get(
  "/financial-settings",
  verifyToken,
  authorizeRole("admin"),
  getFinancialSettingsController
);

router.patch(
  "/financial-settings",
  verifyToken,
  authorizeRole("admin"),
  updateFinancialSettingsController
);

// Admin-only financial dashboard summary
router.get(
  "/financial-summary",
  verifyToken,
  authorizeRole("admin"),
  getFinancialSummaryController
);

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