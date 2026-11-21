
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
