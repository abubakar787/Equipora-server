 
import {
  createBookingSchema,
  bookingQuerySchema,
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
