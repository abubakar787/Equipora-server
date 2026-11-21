
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";

const getBookingCollection = () => getDB().collection("bookings");
const getEquipmentCollection = () => getDB().collection("equipment");

const RESERVATION_MINUTES = 15;

const RENTAL_UNIT_MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

// Calculate rental duration and price units
const calculateRentalUnits = (startAt, endAt, rentalType) => {
  const duration = endAt.getTime() - startAt.getTime();

  return Math.ceil(duration / RENTAL_UNIT_MS[rentalType]);
};

// Create a temporary equipment reservation
export const createBooking = async (bookingData, customer) => {
  const db = getDB();
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
    notes,
  } = bookingData;

  // 1. Find approved equipment
  const equipment = await equipmentCollection.findOne({
    _id: new ObjectId(equipmentId),
    status: "approved",
    isAvailable: true,
    isDeleted: { $ne: true },
  });

  if (!equipment) {
    throw new Error("Equipment is not available for booking");
  }

  // 2. Prevent owners from booking their own equipment
  if (equipment.ownerId === customer.id) {
    throw new Error("You cannot book your own equipment");
  }

  // 3. Validate rental pricing
  const pricePerUnit = equipment.pricing?.[rentalType];

  if (typeof pricePerUnit !== "number" || pricePerUnit <= 0) {
    throw new Error(`This equipment does not support ${rentalType} rental`);
  }

  // 4. Validate requested rental period
  const requestedStart = new Date(startAt);
  const requestedEnd = new Date(endAt);

  const availableFrom = new Date(equipment.availability.availableFrom);
  const availableUntil = new Date(equipment.availability.availableUntil);

  if (
    requestedStart < availableFrom ||
    requestedEnd > availableUntil
  ) {
    throw new Error("Selected dates are outside the equipment availability period");
  }

  // 5. Calculate rental units
  const rentalUnits = calculateRentalUnits(
    requestedStart,
    requestedEnd,
    rentalType
  );

  if (rentalUnits < 1) {
    throw new Error("Invalid rental duration");
  }

  // 6. Find overlapping active reservations
  const now = new Date();

  const overlappingBookings = await bookingCollection.aggregate([
    {
      $match: {
        equipmentId: equipment._id,
        startAt: { $lt: requestedEnd },
        endAt: { $gt: requestedStart },
       // Count all bookings that currently reserve equipment stock
$or: [
  // Confirmed and active bookings always reserve stock
  {
    status: { $in: ["confirmed", "active"] },
  },

  // Pending and approved bookings reserve stock until expiration
  {
    status: {
      $in: ["pending_payment", "approved_for_payment"],
    },
    expiresAt: { $gt: now },
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

  const bookedQuantity = overlappingBookings[0]?.bookedQuantity || 0;

  // 7. Check remaining stock
  const availableQuantity = equipment.quantity - bookedQuantity;

  if (quantity > availableQuantity) {
    throw new Error(
      `Only ${Math.max(availableQuantity, 0)} unit(s) available for the selected period`
    );
  }

  // 8. Calculate total price on the server
  const subtotal = pricePerUnit * rentalUnits * quantity;

  // 9. Create temporary reservation
  const expiresAt = new Date(
    Date.now() + RESERVATION_MINUTES * 60 * 1000
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

    status: "pending_payment",
    expiresAt,

    paymentStatus: "unpaid",
    createdAt: now,
    updatedAt: now,
  };

  const result = await bookingCollection.insertOne(booking);

  return {
    ...booking,
    _id: result.insertedId,
  };
};


/**
 * Get all bookings of the authenticated customer
 */
export const getMyBookings = async (customerId, filters = {}) => {
  const collection = getBookingCollection();

  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 24);

  const query = {
    customerId,
  };

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


/**
 * Get a specific booking belonging to the customer
 */
export const getBookingById = async (bookingId, customerId) => {
  if (!ObjectId.isValid(bookingId)) {
    return null;
  }

  return getBookingCollection().findOne({
    _id: new ObjectId(bookingId),
    customerId,
  });
};


/**
 * Cancel a customer's unpaid pending booking
 */
export const cancelBooking = async (bookingId, customerId) => {
  if (!ObjectId.isValid(bookingId)) {
    return null;
  }

  const result = await getBookingCollection().findOneAndUpdate(
    {
      _id: new ObjectId(bookingId),
      customerId,
      // Customer can cancel an unpaid pending or approved booking
status: {
  $in: ["pending_payment", "approved_for_payment"],
},
      paymentStatus: "unpaid",
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    }
  );

  return result;
};

// ============================================
// 10. OWNER BOOKING MANAGEMENT
// ============================================

/**
 * Get booking requests received by the authenticated owner.
 * Only bookings for equipment owned by this owner are returned.
 */
export const getOwnerBookings = async (ownerId, filters = {}) => {
  const collection = getBookingCollection();

  // Pagination settings
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 24);

  // Security: restrict results to the authenticated owner
  const query = {
    ownerId,
  };

  // Optional booking status filter
  if (filters.status) {
    query.status = filters.status;
  }

  const skip = (page - 1) * limit;

  // Fetch bookings and total count together
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


/**
 * Owner approves or rejects a pending booking request.
 *
 * Approval does NOT confirm the booking.
 * Payment must be verified by the Stripe webhook first.
 */
export const updateOwnerBookingStatus = async (
  bookingId,
  ownerId,
  action,
  reviewNote = ""
) => {
  // Validate MongoDB booking ID
  if (!ObjectId.isValid(bookingId)) {
    return null;
  }

  // Map owner action to the appropriate booking status
  const statusMap = {
    approve: "approved_for_payment",
    reject: "rejected",
  };

  const newStatus = statusMap[action];

  if (!newStatus) {
    throw new Error("Invalid booking action");
  }

  const now = new Date();

  // Update only an active pending request belonging to this owner
  const result = await getBookingCollection().findOneAndUpdate(
    {
      _id: new ObjectId(bookingId),
      ownerId,
      status: "pending_payment",
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: newStatus,
        ownerReviewNote: reviewNote,
        ownerReviewedAt: now,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
    }
  );

  return result;
};

/**
 * Owner marks a completed rental
 */
export const completeBooking = async (bookingId, ownerId) => {
  if (!ObjectId.isValid(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const bookings = getDB().collection("bookings");
  const bookingObjectId = new ObjectId(bookingId);

  // Find booking belonging to this owner
  const booking = await bookings.findOne({
    _id: bookingObjectId,
    ownerId,
  });

  if (!booking) {
    throw new Error("Booking not found or access denied");
  }

  // Booking must be confirmed and paid
  if (
    booking.status !== "confirmed" ||
    booking.paymentStatus !== "paid"
  ) {
    throw new Error("Only confirmed and paid bookings can be completed");
  }

  // Rental period must be finished
  if (new Date(booking.endAt) > new Date()) {
    throw new Error("Rental period has not ended yet");
  }

  // Update booking status
  const result = await bookings.updateOne(
    {
      _id: bookingObjectId,
      ownerId,
      status: "confirmed",
      paymentStatus: "paid",
    },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Booking could not be completed");
  }

  return bookings.findOne({ _id: bookingObjectId });
};
