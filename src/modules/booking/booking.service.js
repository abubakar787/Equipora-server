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

const calculateRentalUnits = (startAt, endAt, rentalType) => {
  const unit = RENTAL_UNIT_MS[rentalType];

  if (!unit) {
    throw new Error("Invalid rental type");
  }

  return Math.ceil((endAt.getTime() - startAt.getTime()) / unit);
};

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

  // 7. Find overlapping bookings
  const overlappingBookings = await bookingCollection
    .aggregate([
      {
        $match: {
          equipmentId: equipment._id,
          startAt: { $lt: requestedEnd },
          endAt: { $gt: requestedStart },
          $or: [
            {
              status: { $in: ["confirmed", "active"] },
            },
            {
              status: {
                $in: [
                  "pending_payment",
                  "approved_for_payment",
                ],
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
    ])
    .toArray();

  const bookedQuantity =
    overlappingBookings[0]?.bookedQuantity ?? 0;

  const availableQuantity =
    equipment.quantity - bookedQuantity;

  if (quantity > availableQuantity) {
    throw new Error(
      `Only ${Math.max(availableQuantity, 0)} unit(s) available for the selected period`
    );
  }

  // 8. Calculate server-side price
  const subtotal = pricePerUnit * rentalUnits * quantity;

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    throw new Error("Unable to calculate booking price");
  }

  // 9. Create temporary reservation
  const expiresAt = new Date(
    now.getTime() + RESERVATION_MINUTES * 60 * 1000
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
      expiresAt: { $gt: now },
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

  return getBookingCollection().findOneAndUpdate(
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
        completedAt: new Date(),
        updatedAt: new Date(),
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