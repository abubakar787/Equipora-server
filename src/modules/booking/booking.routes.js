
import express from "express";

import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

import {
  createBookingController,
  getMyBookingsController,
  getBookingByIdController,
  cancelBookingController,
  getOwnerBookingsController,
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

// Create booking
router.post(
  "/",
  verifyToken,
  authorizeRole("customer"),
  createBookingController
);

// Get customer's bookings
router.get(
  "/my-bookings",
  verifyToken,
  authorizeRole("customer"),
  getMyBookingsController
);

// ============================================
// OWNER / ADMIN ROUTES
// IMPORTANT: Keep these before GET /:id
// ============================================

// Get received bookings
router.get(
  "/owner-bookings",
  verifyToken,
  authorizeRole("owner", "admin"),
  getOwnerBookingsController
);

// Owner approves or rejects booking
router.patch(
  "/:id/owner-review",
  verifyToken,
  authorizeRole("owner"),
  updateOwnerBookingStatusController
);

// Owner or Admin extends review deadline
router.patch(
  "/:id/extend-deadline",
  verifyToken,
  authorizeRole("owner", "admin"),
  extendBookingDeadlineController
);

// Owner or Admin reviews extension request
router.patch(
  "/:id/extension-requests/:requestId/review",
  verifyToken,
  authorizeRole("owner", "admin"),
  reviewBookingExtensionController
);

// Owner completes rental
router.patch(
  "/:id/complete",
  verifyToken,
  authorizeRole("owner"),
  completeBookingController
);

// ============================================
// CUSTOMER BOOKING ACTIONS
// ============================================

// Customer requests deadline extension
router.post(
  "/:id/extension-request",
  verifyToken,
  authorizeRole("customer"),
  requestBookingExtensionController
);

// Customer cancels booking
router.patch(
  "/:id/cancel",
  verifyToken,
  authorizeRole("customer"),
  cancelBookingController
);

// ============================================
// DYNAMIC CUSTOMER ROUTE
// MUST BE LAST AMONG GET ROUTES
// ============================================

// Get a specific customer booking
router.get(
  "/:id",
  verifyToken,
  authorizeRole("customer"),
  getBookingByIdController
);

export default router;
