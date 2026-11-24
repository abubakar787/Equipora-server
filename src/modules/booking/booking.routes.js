
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
// CUSTOMER BOOKING ROUTES
// ============================================

// Create booking
router.post(
  "/",
  verifyToken,
  authorizeRole("customer"),
  createBookingController
);

// Get logged-in customer's bookings
router.get(
  "/my-bookings",
  verifyToken,
  authorizeRole("customer"),
  getMyBookingsController
);

// Request deadline extension
router.post(
  "/:id/extension-request",
  verifyToken,
  authorizeRole("customer"),
  requestBookingExtensionController
);

// Get a specific customer booking
router.get(
  "/:id",
  verifyToken,
  authorizeRole("customer"),
  getBookingByIdController
);

// Cancel booking
router.patch(
  "/:id/cancel",
  verifyToken,
  authorizeRole("customer"),
  cancelBookingController
);

// ============================================
// OWNER / ADMIN BOOKING ROUTES
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

// Owner or Admin directly extends review deadline
router.patch(
  "/:id/extend-deadline",
  verifyToken,
  authorizeRole("owner", "admin"),
  extendBookingDeadlineController
);

// Owner or Admin reviews customer extension request
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

export default router;
