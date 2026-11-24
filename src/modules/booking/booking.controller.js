 
import {
  createBookingSchema,
  bookingQuerySchema,
  adminBookingQuerySchema,
} from "./booking.validation.js";

import * as bookingService from "./booking.service.js";

/**
 * Create a new booking reservation
 */
export const createBookingController = async (req, res, next) => {
  try {
    const validation = createBookingSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking information",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const booking = await bookingService.createBooking(
      validation.data,
      req.user
    );

    return res.status(201).json({
      success: true,
      message: "Booking reservation created successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get bookings of the authenticated customer
 */
export const getMyBookingsController = async (req, res, next) => {
  try {
    const validation = bookingQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking filters",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const result = await bookingService.getMyBookings(
      req.user.id,
      validation.data
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

/**
 * Get a specific booking belonging to the customer
 */
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

/**
 * Cancel an unpaid pending booking
 */
export const cancelBookingController = async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBooking(
      req.params.id,
      req.user.id
    );

    if (!booking) {
      return res.status(400).json({
        success: false,
        message:
          "Booking cannot be cancelled. It may already be paid, expired, or unavailable.",
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

/**
 * Get booking requests received by the authenticated owner
 */
export const getOwnerBookingsController = async (req, res, next) => {
  try {
    const validation = bookingQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking filters",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const result = await bookingService.getOwnerBookings(
      req.user.id,
      validation.data
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

// ============================================
// ADMIN: GET ALL BOOKINGS
// ============================================

export const getAdminBookingsController = async (
  req,
  res,
  next
) => {
  try {
    const validation = adminBookingQuerySchema.safeParse(
      req.query
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin booking filters",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const result = await bookingService.getAdminBookings(
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "All bookings retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Owner approves or rejects a booking request
 */
export const updateOwnerBookingStatusController = async (
  req,
  res,
  next
) => {
  try {
    const { action, reviewNote = "" } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be approve or reject",
      });
    }

    if (
      typeof reviewNote !== "string" ||
      reviewNote.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Review note must not exceed 500 characters",
      });
    }

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

/**
 * Owner completes a rental booking
 */
export const completeBookingController = async (req, res, next) => {
  try {
    const booking = await bookingService.completeBooking(
      req.params.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Booking completed successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================
// CUSTOMER: REQUEST BOOKING EXTENSION
// ============================================

export const requestBookingExtensionController = async (
  req,
  res,
  next
) => {
  try {
    const { requestedHours, reason } = req.body;

    if (
      ![12, 24, 48].includes(Number(requestedHours))
    ) {
      return res.status(400).json({
        success: false,
        message: "Extension must be 12, 24, or 48 hours",
      });
    }

    if (
      typeof reason !== "string" ||
      reason.trim().length < 5 ||
      reason.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Reason must be between 5 and 500 characters",
      });
    }

    const booking = await bookingService.requestBookingExtension(
      req.params.id,
      req.user.id,
      Number(requestedHours),
      reason.trim()
    );

    return res.status(201).json({
      success: true,
      message: "Extension request submitted successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================
// OWNER / ADMIN: DIRECTLY EXTEND DEADLINE
// ============================================

export const extendBookingDeadlineController = async (
  req,
  res,
  next
) => {
  try {
    const { hours, reason } = req.body;

    if (![12, 24, 48].includes(Number(hours))) {
      return res.status(400).json({
        success: false,
        message: "Extension must be 12, 24, or 48 hours",
      });
    }

    if (
      typeof reason !== "string" ||
      reason.trim().length < 5 ||
      reason.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Reason must be between 5 and 500 characters",
      });
    }

    const booking = await bookingService.extendBookingDeadline(
      req.params.id,
      req.user,
      Number(hours),
      reason.trim()
    );

    return res.status(200).json({
      success: true,
      message: "Booking review deadline extended successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================
// OWNER / ADMIN: REVIEW EXTENSION REQUEST
// ============================================

export const reviewBookingExtensionController = async (
  req,
  res,
  next
) => {
  try {
    const { action, reviewNote = "" } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be approve or reject",
      });
    }

    if (
      typeof reviewNote !== "string" ||
      reviewNote.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Review note must not exceed 500 characters",
      });
    }

    const booking = await bookingService.reviewBookingExtension(
      req.params.id,
      req.params.requestId,
      req.user,
      action,
      reviewNote.trim()
    );

    return res.status(200).json({
      success: true,
      message:
        action === "approve"
          ? "Extension request approved successfully"
          : "Extension request rejected successfully",
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};
