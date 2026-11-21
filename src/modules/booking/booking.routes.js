
// ============================================
// 1. IMPORTS
// ============================================

import express from "express";

// Authentication and authorization middleware
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";
import {
   completeBookingController,
} from "./booking.controller.js";

// Booking controllers
import {
  createBookingController,
  getMyBookingsController,
  getBookingByIdController,
  cancelBookingController,
  getOwnerBookingsController,
  updateOwnerBookingStatusController,
} from "./booking.controller.js";


// ============================================
// 2. ROUTER INITIALIZATION
// ============================================

const router = express.Router();


// ============================================
// 3. CUSTOMER BOOKING ROUTES
// ============================================

// Create a new equipment booking
router.post(
  "/",
  verifyToken,
  authorizeRole("customer"),
  createBookingController
);

// Get all bookings of the logged-in customer
router.get(
  "/my-bookings",
  verifyToken,
  authorizeRole("customer"),
  getMyBookingsController
);

// ============================================
// 4. OWNER BOOKING ROUTES
// ============================================

// Get booking requests for the logged-in owner
// Supports pagination and status filtering
router.get(
  "/owner-bookings",
  verifyToken,
  authorizeRole("owner", "admin"),
  getOwnerBookingsController
);

// Owner approves or rejects a booking request
router.patch(
  "/:id/owner-review",
  verifyToken,
  authorizeRole("owner"),
  updateOwnerBookingStatusController
);


// ============================================
// 5. CUSTOMER BOOKING DETAILS & CANCELLATION
// ============================================

// Get details of a specific customer booking
router.get(
  "/:id",
  verifyToken,
  authorizeRole("customer"),
  getBookingByIdController
);

// Cancel an unpaid pending booking
router.patch(
  "/:id/cancel",
  verifyToken,
  authorizeRole("customer"),
  cancelBookingController
);


// ============================================
// 6. EXPORT ROUTER
// ============================================
// Owner: Complete a rental booking
router.patch(
  "/:id/complete",
  verifyToken,
  authorizeRole("owner"),
  completeBookingController
);

export default router;
