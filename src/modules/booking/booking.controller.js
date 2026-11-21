
import { createBookingSchema } from "./booking.validation.js";
import * as bookingService from "./booking.service.js";

export const createBookingController = async (req, res, next) => {
  try {
    // 1. Validate request body
    const validation = createBookingSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking information",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    // 2. Create booking using authenticated customer
    const booking = await bookingService.createBooking(
      validation.data,
      req.user
    );

    // 3. Send response
    return res.status(201).json({
      success: true,
      message: "Booking reservation created successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};


export const getMyBookingsController = async (req, res, next) => {
  try {
    const allowedStatuses = [
      "pending_payment",
      "confirmed",
      "active",
      "completed",
      "cancelled",
      "expired",
    ];

    const status = req.query.status;

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
      });
    }

    const result = await bookingService.getMyBookings(
      req.user.id,
      {
        page: req.query.page,
        limit: req.query.limit,
        status,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Your bookings retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};


export const getBookingByIdController = async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(
      req.params.id,
      req.user.id
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking details retrieved successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};


export const cancelBookingController = async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBooking(
      req.params.id,
      req.user.id
    );

    if (!booking) {
      return res.status(400).json({
        success: false,
        message: "Booking cannot be cancelled. It may already be paid, expired, or unavailable.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

 // ============================================
 // 4. OWNER BOOKING MANAGEMENT CONTROLLERS
 // ============================================

/**
 * Get all booking requests received by the logged-in owner.
 *
 * Supports:
 * - Pagination
 * - Booking status filtering
 *
 * Security:
 * Only bookings belonging to the authenticated owner are returned.
 */
export const getOwnerBookingsController = async (req, res, next) => {
  try {
    // Validate optional booking status
    const allowedStatuses = [
      "pending_payment",
      "approved_for_payment",
      "confirmed",
      "active",
      "completed",
      "cancelled",
      "expired",
      "rejected",
    ];

    const status = req.query.status;

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
      });
    }

    // Fetch owner's bookings from service layer
    const result = await bookingService.getOwnerBookings(
      req.user.id,
      {
        page: req.query.page,
        limit: req.query.limit,
        status,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Owner bookings retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};


/**
 * Owner approves or rejects a booking request.
 *
 * Request body:
 * {
 *   "action": "approve",
 *   "reviewNote": "Booking approved"
 * }
 *
 * Approval allows the customer to proceed with payment.
 * Actual booking confirmation happens after verified payment.
 */
export const updateOwnerBookingStatusController = async (
  req,
  res,
  next
) => {
  try {
    // Validate the requested owner action
    const { action, reviewNote = "" } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be approve or reject",
      });
    }

    // Validate review note
    if (
      typeof reviewNote !== "string" ||
      reviewNote.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Review note must not exceed 500 characters",
      });
    }

    // Update booking through service layer
    const booking = await bookingService.updateOwnerBookingStatus(
      req.params.id,
      req.user.id,
      action,
      reviewNote.trim()
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or no longer available for review",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        action === "approve"
          ? "Booking approved for payment"
          : "Booking request rejected successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};
