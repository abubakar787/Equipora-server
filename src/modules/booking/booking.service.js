
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";

const getBookingCollection = () => getDB().collection("bookings");
const getEquipmentCollection = () => getDB().collection("equipment");

// Booking lifecycle configuration
const OWNER_REVIEW_HOURS = 72;

// Stripe Checkout currently uses a 31-minute session.
const PAYMENT_RESERVATION_MINUTES = 31;

const OWNER_REVIEW_DURATION_MS =
  OWNER_REVIEW_HOURS * 60 * 60 * 1000;

const PAYMENT_RESERVATION_DURATION_MS =
  PAYMENT_RESERVATION_MINUTES * 60 * 1000;

const RENTAL_UNIT_MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const calculateRentalUnits = (startAt, endAt, rentalType) => {
  const unit = RENTAL_UNIT_MS[rentalType];

  if (!unit) {
    throw new Error("Invalid rental type");
  }

  return Math.ceil(
    (endAt.getTime() - startAt.getTime()) / unit
  );
};

// Backward-compatible deadline helpers
const getOwnerReviewDeadline = (booking) =>
  booking.ownerReviewExpiresAt || booking.expiresAt;

const getPaymentDeadline = (booking) =>
  booking.paymentExpiresAt || booking.expiresAt;

// ============================================
// CREATE BOOKING
// ============================================

export const createBooking = async (bookingData, customer) => {
  const equipmentCollection = getEquipmentCollection();
  const bookingCollection = getBookingCollection();

  const {
    equipmentId,
    startAt,
    endAt,
    rentalType,
    quantity,
    contactName,
    contactPhone,
    deliveryAddress,
    notes = "",
  } = bookingData;

  if (!ObjectId.isValid(equipmentId)) {
    throw new Error("Invalid equipment ID");
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Invalid booking quantity");
  }

  const requestedStart = new Date(startAt);
  const requestedEnd = new Date(endAt);
  const now = new Date();

  if (
    Number.isNaN(requestedStart.getTime()) ||
    Number.isNaN(requestedEnd.getTime())
  ) {
    throw new Error("Invalid booking dates");
  }

  if (requestedStart <= now) {
    throw new Error("Booking start date must be in the future");
  }

  if (requestedEnd <= requestedStart) {
    throw new Error("End date must be after start date");
  }

  if (!RENTAL_UNIT_MS[rentalType]) {
    throw new Error("Invalid rental type");
  }

  // 1. Find equipment
  const equipment = await equipmentCollection.findOne({
    _id: new ObjectId(equipmentId),
    status: "approved",
    isAvailable: true,
    isDeleted: { $ne: true },
  });

  if (!equipment) {
    throw new Error("Equipment is not available for booking");
  }

  // 2. Prevent owner booking own equipment
  if (equipment.ownerId === customer.id) {
    throw new Error("You cannot book your own equipment");
  }

  // 3. Validate stock
  if (
    !Number.isInteger(equipment.quantity) ||
    equipment.quantity < 1
  ) {
    throw new Error("Equipment stock is unavailable");
  }

  // 4. Validate pricing
  const pricePerUnit = equipment.pricing?.[rentalType];

  if (
    typeof pricePerUnit !== "number" ||
    !Number.isFinite(pricePerUnit) ||
    pricePerUnit <= 0
  ) {
    throw new Error(
      `This equipment does not support ${rentalType} rental`
    );
  }

  // 5. Validate equipment availability dates
  const availability = equipment.availability;

  if (
    !availability?.availableFrom ||
    !availability?.availableUntil
  ) {
    throw new Error("Equipment availability dates are not configured");
  }

  const availableFrom = new Date(availability.availableFrom);
  const availableUntil = new Date(availability.availableUntil);

  if (
    Number.isNaN(availableFrom.getTime()) ||
    Number.isNaN(availableUntil.getTime())
  ) {
    throw new Error("Equipment availability dates are invalid");
  }

  if (
    requestedStart < availableFrom ||
    requestedEnd > availableUntil
  ) {
    throw new Error(
      "Selected dates are outside the equipment availability period"
    );
  }

  // 6. Calculate rental units
  const rentalUnits = calculateRentalUnits(
    requestedStart,
    requestedEnd,
    rentalType
  );

  if (rentalUnits < 1) {
    throw new Error("Invalid rental duration");
  }

  // 7. Find overlapping active reservations
  const overlappingBookings = await bookingCollection
    .aggregate([
      {
        $match: {
          equipmentId: equipment._id,
          startAt: { $lt: requestedEnd },
          endAt: { $gt: requestedStart },

          $or: [
            // Confirmed and active bookings always reserve stock
            {
              status: {
                $in: ["confirmed", "active"],
              },
            },

            // Pending owner review: 72-hour deadline
            {
              status: "pending_payment",
              $or: [
                {
                  ownerReviewExpiresAt: { $gt: now },
                },
                {
                  ownerReviewExpiresAt: { $exists: false },
                  expiresAt: { $gt: now },
                },
              ],
            },

            // Approved bookings: payment deadline
            {
              status: "approved_for_payment",
              $or: [
                {
                  paymentExpiresAt: { $gt: now },
                },
                {
                  paymentExpiresAt: { $exists: false },
                  expiresAt: { $gt: now },
                },
              ],
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          bookedQuantity: {
            $sum: "$quantity",
          },
        },
      },
    ])
    .toArray();

  const bookedQuantity =
    overlappingBookings[0]?.bookedQuantity ?? 0;

  const availableQuantity =
    equipment.quantity - bookedQuantity;

  if (quantity > availableQuantity) {
    throw new Error(
      `Only ${Math.max(
        availableQuantity,
        0
      )} unit(s) available for the selected period`
    );
  }

  // 8. Calculate server-side price
  const subtotal = pricePerUnit * rentalUnits * quantity;

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    throw new Error("Unable to calculate booking price");
  }

  // 9. Create 72-hour owner review deadline
  const ownerReviewExpiresAt = new Date(
    now.getTime() + OWNER_REVIEW_DURATION_MS
  );

  const booking = {
    equipmentId: equipment._id,
    equipmentTitle: equipment.title,
    equipmentImage: equipment.images?.[0] || "",

    ownerId: equipment.ownerId,
    customerId: customer.id,
    customerEmail: customer.email,

    startAt: requestedStart,
    endAt: requestedEnd,

    rentalType,
    rentalUnits,
    quantity,

    pricePerUnit,
    subtotal,
    totalAmount: subtotal,

    contactName,
    contactPhone,
    deliveryAddress,
    notes,

    // Booking lifecycle
    status: "pending_payment",
    paymentStatus: "unpaid",

    // Owner review deadline
    ownerReviewExpiresAt,

    // Payment deadline starts only after owner approval
    paymentExpiresAt: null,

    // Backward compatibility with existing services
    expiresAt: ownerReviewExpiresAt,

    // Extension workflow preparation
    extensionRequests: [],
    extensionHistory: [],
    extensionCount: 0,

    createdAt: now,
    updatedAt: now,
  };

  const result = await bookingCollection.insertOne(booking);

  return {
    ...booking,
    _id: result.insertedId,
  };
};

// ============================================
// CUSTOMER: GET MY BOOKINGS
// ============================================

export const getMyBookings = async (customerId, filters = {}) => {
  const collection = getBookingCollection();

  const page = Math.max(Number(filters.page) || 1, 1);

  const limit = Math.min(
    Math.max(Number(filters.limit) || 10, 1),
    24
  );

  const query = { customerId };

  if (filters.status) {
    query.status = filters.status;
  }

  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),

    collection.countDocuments(query),
  ]);

  return {
    bookings,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

// ============================================
// CUSTOMER: GET BOOKING BY ID
// ============================================

export const getBookingById = async (bookingId, customerId) => {
  if (!ObjectId.isValid(bookingId)) {
    return null;
  }

  return getBookingCollection().findOne({
    _id: new ObjectId(bookingId),
    customerId,
  });
};

// ============================================
// CUSTOMER: CANCEL BOOKING
// ============================================

export const cancelBooking = async (bookingId, customerId) => {
  if (!ObjectId.isValid(bookingId)) {
    return null;
  }

  const now = new Date();

  return getBookingCollection().findOneAndUpdate(
    {
      _id: new ObjectId(bookingId),
      customerId,

      status: {
        $in: ["pending_payment", "approved_for_payment"],
      },

      paymentStatus: "unpaid",

      $or: [
        // Pending owner review
        {
          status: "pending_payment",
          $or: [
            {
              ownerReviewExpiresAt: { $gt: now },
            },
            {
              ownerReviewExpiresAt: { $exists: false },
              expiresAt: { $gt: now },
            },
          ],
        },

        // Approved and waiting for payment
        {
          status: "approved_for_payment",
          $or: [
            {
              paymentExpiresAt: { $gt: now },
            },
            {
              paymentExpiresAt: { $exists: false },
              expiresAt: { $gt: now },
            },
          ],
        },
      ],
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
    }
  );
};

// ============================================
// OWNER: GET RECEIVED BOOKINGS
// ============================================

export const getOwnerBookings = async (ownerId, filters = {}) => {
  const collection = getBookingCollection();

  const page = Math.max(Number(filters.page) || 1, 1);

  const limit = Math.min(
    Math.max(Number(filters.limit) || 10, 1),
    24
  );

  const query = { ownerId };

  if (filters.status) {
    query.status = filters.status;
  }

  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),

    collection.countDocuments(query),
  ]);

  return {
    bookings,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

// ============================================
// OWNER: APPROVE OR REJECT BOOKING
// ============================================

export const updateOwnerBookingStatus = async (
  bookingId,
  ownerId,
  action,
  reviewNote = ""
) => {
  if (!ObjectId.isValid(bookingId)) {
    return null;
  }

  const statusMap = {
    approve: "approved_for_payment",
    reject: "rejected",
  };

  const newStatus = statusMap[action];

  if (!newStatus) {
    throw new Error("Invalid booking action");
  }

  const now = new Date();

  // Start a separate payment deadline after approval.
  const paymentExpiresAt =
    action === "approve"
      ? new Date(
          now.getTime() + PAYMENT_RESERVATION_DURATION_MS
        )
      : null;

  return getBookingCollection().findOneAndUpdate(
    {
      _id: new ObjectId(bookingId),
      ownerId,
      status: "pending_payment",

      $or: [
        {
          ownerReviewExpiresAt: { $gt: now },
        },
        {
          ownerReviewExpiresAt: { $exists: false },
          expiresAt: { $gt: now },
        },
      ],
    },
    {
      $set: {
        status: newStatus,
        ownerReviewNote: reviewNote,
        ownerReviewedAt: now,
        updatedAt: now,

        ...(action === "approve"
          ? {
              paymentExpiresAt,
              // Legacy compatibility for existing payment service
              expiresAt: paymentExpiresAt,
            }
          : {}),
      },
    },
    {
      returnDocument: "after",
    }
  );
};

// ============================================
// OWNER: COMPLETE BOOKING
// ============================================

export const completeBooking = async (bookingId, ownerId) => {
  if (!ObjectId.isValid(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const collection = getBookingCollection();
  const bookingObjectId = new ObjectId(bookingId);

  const booking = await collection.findOne({
    _id: bookingObjectId,
    ownerId,
  });

  if (!booking) {
    throw new Error("Booking not found or access denied");
  }

  if (
    booking.status !== "confirmed" ||
    booking.paymentStatus !== "paid"
  ) {
    throw new Error(
      "Only confirmed and paid bookings can be completed"
    );
  }

  if (new Date(booking.endAt) > new Date()) {
    throw new Error("Rental period has not ended yet");
  }

  const now = new Date();

  const result = await collection.updateOne(
    {
      _id: bookingObjectId,
      ownerId,
      status: "confirmed",
      paymentStatus: "paid",
    },
    {
      $set: {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      },
    }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Booking could not be completed");
  }

  return collection.findOne({
    _id: bookingObjectId,
    ownerId,
  });
};

// ============================================
// BOOKING EXTENSION HELPERS
// ============================================

const ALLOWED_EXTENSION_HOURS = [12, 24, 48];

const getReviewDeadline = (booking) =>
  booking.ownerReviewExpiresAt || booking.expiresAt;

const validateExtensionHours = (hours) => {
  if (!ALLOWED_EXTENSION_HOURS.includes(Number(hours))) {
    throw new Error(
      "Extension must be 12, 24, or 48 hours"
    );
  }

  return Number(hours);
};

// Recheck equipment availability before reopening
// an expired booking reservation.
const ensureBookingAvailability = async (booking) => {
  const bookings = getBookingCollection();
  const equipmentCollection = getEquipmentCollection();
  const now = new Date();

  const equipment = await equipmentCollection.findOne({
    _id: booking.equipmentId,
    status: "approved",
    isAvailable: true,
    isDeleted: { $ne: true },
  });

  if (!equipment) {
    throw new Error(
      "Equipment is no longer available"
    );
  }

  const overlapping = await bookings.aggregate([
    {
      $match: {
        _id: { $ne: booking._id },
        equipmentId: booking.equipmentId,
        startAt: { $lt: booking.endAt },
        endAt: { $gt: booking.startAt },

        $or: [
          {
            status: { $in: ["confirmed", "active"] },
          },
          {
            status: "pending_payment",
            $or: [
              { ownerReviewExpiresAt: { $gt: now } },
              {
                ownerReviewExpiresAt: { $exists: false },
                expiresAt: { $gt: now },
              },
            ],
          },
          {
            status: "approved_for_payment",
            $or: [
              { paymentExpiresAt: { $gt: now } },
              {
                paymentExpiresAt: { $exists: false },
                expiresAt: { $gt: now },
              },
            ],
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        bookedQuantity: { $sum: "$quantity" },
      },
    },
  ]).toArray();

  const bookedQuantity =
    overlapping[0]?.bookedQuantity ?? 0;

  const availableQuantity =
    equipment.quantity - bookedQuantity;

  if (booking.quantity > availableQuantity) {
    throw new Error(
      `Cannot extend this booking. Only ${Math.max(
        availableQuantity,
        0
      )} unit(s) are currently available.`
    );
  }
};

// ============================================
// CUSTOMER: REQUEST BOOKING EXTENSION
// ============================================

export const requestBookingExtension = async (
  bookingId,
  customerId,
  requestedHours,
  reason
) => {
  if (!ObjectId.isValid(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const hours = validateExtensionHours(requestedHours);
  const now = new Date();

  const bookings = getBookingCollection();
  const bookingObjectId = new ObjectId(bookingId);

  const booking = await bookings.findOne({
    _id: bookingObjectId,
    customerId,
    status: "pending_payment",
    paymentStatus: "unpaid",
  });

  if (!booking) {
    throw new Error(
      "Pending booking not found or unavailable"
    );
  }

  const deadline = getReviewDeadline(booking);

  if (!deadline || new Date(deadline) > now) {
    throw new Error(
      "You can request an extension after the review deadline expires"
    );
  }

  const pendingRequest = (
    booking.extensionRequests || []
  ).some((request) => request.status === "pending");

  if (pendingRequest) {
    throw new Error(
      "You already have a pending extension request"
    );
  }

  const request = {
    _id: new ObjectId(),
    requestedBy: customerId,
    requestedHours: hours,
    reason: reason.trim(),
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: "",
    createdAt: now,
  };

  const result = await bookings.updateOne(
    {
      _id: bookingObjectId,
      customerId,
      status: "pending_payment",
      paymentStatus: "unpaid",

      // Prevent duplicate pending requests
      extensionRequests: {
        $not: {
          $elemMatch: {
            status: "pending",
          },
        },
      },
    },
    {
      $push: {
        extensionRequests: request,
      },
      $set: {
        updatedAt: now,
      },
    }
  );

  if (result.modifiedCount === 0) {
    throw new Error(
      "Extension request could not be submitted. Please refresh and try again."
    );
  }

  return bookings.findOne({
    _id: bookingObjectId,
    customerId,
  });
};

// ============================================
// OWNER / ADMIN: DIRECTLY EXTEND DEADLINE
// ============================================

export const extendBookingDeadline = async (
  bookingId,
  user,
  requestedHours,
  reason
) => {
  if (!ObjectId.isValid(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const hours = validateExtensionHours(requestedHours);
  const now = new Date();

  const bookings = getBookingCollection();
  const bookingObjectId = new ObjectId(bookingId);

  const query = {
    _id: bookingObjectId,
    status: "pending_payment",
    paymentStatus: "unpaid",
  };

  if (user.role === "owner") {
    query.ownerId = user.id;
  } else if (user.role !== "admin") {
    throw new Error("You are not allowed to extend this booking");
  }

  const booking = await bookings.findOne(query);

  if (!booking) {
    throw new Error(
      "Pending booking not found or access denied"
    );
  }

  const oldDeadline = getReviewDeadline(booking);

  if (!oldDeadline) {
    throw new Error("Booking review deadline is missing");
  }

  // Recheck availability if the previous deadline has expired
  if (new Date(oldDeadline) <= now) {
    await ensureBookingAvailability(booking);
  }

  const baseTime = Math.max(
    new Date(oldDeadline).getTime(),
    now.getTime()
  );

  const newDeadline = new Date(
    baseTime + hours * 60 * 60 * 1000
  );

  const result = await bookings.updateOne(
    {
      _id: bookingObjectId,
      status: "pending_payment",
      paymentStatus: "unpaid",
      ...(user.role === "owner"
        ? { ownerId: user.id }
        : {}),
      ownerReviewExpiresAt: booking.ownerReviewExpiresAt,
    },
    {
      $set: {
        ownerReviewExpiresAt: newDeadline,
        expiresAt: newDeadline,
        updatedAt: now,
      },
      $inc: {
        extensionCount: 1,
      },
      $push: {
        extensionHistory: {
          extendedBy: user.id,
          extendedByRole: user.role,
          previousDeadline: new Date(oldDeadline),
          newDeadline,
          hours,
          reason: reason.trim(),
          createdAt: now,
        },
      },
    }
  );

  if (result.modifiedCount === 0) {
    throw new Error(
      "Deadline could not be extended. The booking may have changed. Refresh and try again."
    );
  }

  return bookings.findOne({
    _id: bookingObjectId,
  });
};

// ============================================
// OWNER / ADMIN: REVIEW CUSTOMER EXTENSION
// ============================================

export const reviewBookingExtension = async (
  bookingId,
  requestId,
  user,
  action,
  reviewNote = ""
) => {
  if (
    !ObjectId.isValid(bookingId) ||
    !ObjectId.isValid(requestId)
  ) {
    throw new Error("Invalid booking or request ID");
  }

  if (!["approve", "reject"].includes(action)) {
    throw new Error("Action must be approve or reject");
  }

  const bookings = getBookingCollection();
  const bookingObjectId = new ObjectId(bookingId);
  const requestObjectId = new ObjectId(requestId);
  const now = new Date();

  const query = {
    _id: bookingObjectId,
    status: "pending_payment",
    paymentStatus: "unpaid",
    extensionRequests: {
      $elemMatch: {
        _id: requestObjectId,
        status: "pending",
      },
    },
  };

  if (user.role === "owner") {
    query.ownerId = user.id;
  } else if (user.role !== "admin") {
    throw new Error(
      "You are not allowed to review this extension"
    );
  }

  const booking = await bookings.findOne(query);

  if (!booking) {
    throw new Error(
      "Pending extension request not found or access denied"
    );
  }

  const request = booking.extensionRequests.find(
    (item) =>
      item._id.toString() === requestObjectId.toString() &&
      item.status === "pending"
  );

  if (!request) {
    throw new Error("Extension request is no longer pending");
  }

  let newDeadline = null;

  if (action === "approve") {
    const oldDeadline = getReviewDeadline(booking);

    if (!oldDeadline) {
      throw new Error("Booking review deadline is missing");
    }

    // Recheck stock before reopening an expired reservation
    if (new Date(oldDeadline) <= now) {
      await ensureBookingAvailability(booking);
    }

    const baseTime = Math.max(
      new Date(oldDeadline).getTime(),
      now.getTime()
    );

    newDeadline = new Date(
      baseTime + request.requestedHours * 60 * 60 * 1000
    );
  }

  const update = {
    $set: {
      "extensionRequests.$.status": action === "approve"
        ? "approved"
        : "rejected",
      "extensionRequests.$.reviewedBy": user.id,
      "extensionRequests.$.reviewedAt": now,
      "extensionRequests.$.reviewNote": reviewNote.trim(),
      updatedAt: now,
    },
  };

  if (action === "approve") {
    update.$set.ownerReviewExpiresAt = newDeadline;
    update.$set.expiresAt = newDeadline;

    update.$inc = {
      extensionCount: 1,
    };

    update.$push = {
      extensionHistory: {
        extendedBy: user.id,
        extendedByRole: user.role,
        previousDeadline: new Date(
          getReviewDeadline(booking)
        ),
        newDeadline,
        hours: request.requestedHours,
        reason: request.reason,
        requestId: requestObjectId,
        createdAt: now,
      },
    };
  }

  const result = await bookings.updateOne(query, update);

  if (result.modifiedCount === 0) {
    throw new Error(
      "Extension request could not be reviewed. Refresh and try again."
    );
  }

  return bookings.findOne({
    _id: bookingObjectId,
  });
};
