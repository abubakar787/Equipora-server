
// ============================================
// 1. IMPORTS
// ============================================

import express from "express";

// Authentication and role authorization middleware
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

// Booking controllers
import {
  createBookingController,
  getMyBookingsController,
  getBookingByIdController,
  cancelBookingController,
} from "./booking.controller.js";


// ============================================
// 2. ROUTER INITIALIZATION
// ============================================

const router = express.Router();


// ============================================
// 3. CUSTOMER BOOKING ROUTES
// All routes require customer authentication
// ============================================

// Create a new equipment booking
router.post(
  "/",
  verifyToken,
  authorizeRole("customer"),
  createBookingController
);

// Get all bookings of the logged-in customer
// Supports pagination and status filtering
// Example: /api/bookings/my-bookings?page=1&limit=10
router.get(
  "/my-bookings",
  verifyToken,
  authorizeRole("customer"),
  getMyBookingsController
);

// Get details of a specific booking
// Customer can only access their own booking
router.get(
  "/:id",
  verifyToken,
  authorizeRole("customer"),
  getBookingByIdController
);

// Cancel an unpaid pending booking
// Only the booking owner can cancel it
router.patch(
  "/:id/cancel",
  verifyToken,
  authorizeRole("customer"),
  cancelBookingController
);


// ============================================
// 4. EXPORT ROUTER
// ============================================

export default router;
