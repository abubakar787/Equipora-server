
import express from "express";

import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

import {
  createBookingController,
  getMyBookingsController,
  getBookingByIdController,
  cancelBookingController,
  getOwnerBookingsController,
  getAdminBookingsController,
  updateOwnerBookingStatusController,
  completeBookingController,
  requestBookingExtensionController,
  extendBookingDeadlineController,
  reviewBookingExtensionController,
} from "./booking.controller.js";

const router = express.Router();

// ============================================
// CUSTOMER ROUTES
// ============================================

router.post(
  "/",
  verifyToken,
  authorizeRole("customer"),
  createBookingController
);

router.get(
  "/my-bookings",
  verifyToken,
  authorizeRole("customer"),
  getMyBookingsController
);

// ============================================
// ADMIN ROUTES
// Keep before GET /:id
// ============================================

router.get(
  "/admin-bookings",
  verifyToken,
  authorizeRole("admin"),
  getAdminBookingsController
);

// ============================================
// OWNER ROUTES
// ============================================

router.get(
  "/owner-bookings",
  verifyToken,
  authorizeRole("owner", "admin"),
  getOwnerBookingsController
);

router.patch(
  "/:id/owner-review",
  verifyToken,
  authorizeRole("owner"),
  updateOwnerBookingStatusController
);

router.patch(
  "/:id/extend-deadline",
  verifyToken,
  authorizeRole("owner", "admin"),
  extendBookingDeadlineController
);

router.patch(
  "/:id/extension-requests/:requestId/review",
  verifyToken,
  authorizeRole("owner", "admin"),
  reviewBookingExtensionController
);

router.patch(
  "/:id/complete",
  verifyToken,
  authorizeRole("owner"),
  completeBookingController
);

// ============================================
// CUSTOMER BOOKING ACTIONS
// ============================================

router.post(
  "/:id/extension-request",
  verifyToken,
  authorizeRole("customer"),
  requestBookingExtensionController
);

router.patch(
  "/:id/cancel",
  verifyToken,
  authorizeRole("customer"),
  cancelBookingController
);

// ============================================
// DYNAMIC ROUTE — KEEP LAST
// ============================================

router.get(
  "/:id",
  verifyToken,
  authorizeRole("customer"),
  getBookingByIdController
);

export default router;
