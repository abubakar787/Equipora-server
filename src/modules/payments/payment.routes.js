
import express from "express";

import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

import {
  createCheckoutSessionController,
  getPaymentHistoryController,
} from "./payment.controller.js";

import {
  getFinancialSummaryController,
} from "./financial.controller.js";

import {
  getFinancialSettingsController,
  updateFinancialSettingsController,
} from "./financial-settings.controller.js";

import {
  createRefundController,
} from "./refund.controller.js";

const router = express.Router();

// ============================================
// ADMIN FINANCIAL SETTINGS
// ============================================

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

// ============================================
// ADMIN FINANCIAL SUMMARY
// ============================================

router.get(
  "/financial-summary",
  verifyToken,
  authorizeRole("admin"),
  getFinancialSummaryController
);

// ============================================
// PAYMENT HISTORY
// ============================================

router.get(
  "/history",
  verifyToken,
  authorizeRole("customer", "owner", "admin"),
  getPaymentHistoryController
);

// ============================================
// ADMIN REFUND
// ============================================

router.post(
  "/refunds",
  verifyToken,
  authorizeRole("admin"),
  createRefundController
);

// ============================================
// STRIPE CHECKOUT
// ============================================

router.post(
  "/checkout/:bookingId",
  verifyToken,
  authorizeRole("customer"),
  createCheckoutSessionController
);

export default router;
