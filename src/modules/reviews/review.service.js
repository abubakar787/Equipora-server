
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";

// Access MongoDB collections
const getReviewCollection = () => getDB().collection("reviews");
const getBookingCollection = () => getDB().collection("bookings");

// Create a review after verifying the customer's completed rental
export const createReview = async (reviewData, customer) => {
  const bookings = getBookingCollection();
  const reviews = getReviewCollection();

  const booking = await bookings.findOne({
    _id: new ObjectId(reviewData.bookingId),
    customerId: customer.id,
    paymentStatus: "paid",
    status: { $in: ["confirmed", "completed"] },
    endAt: { $lte: new Date() },
  });

  if (!booking) {
    throw new Error(
      "You can review only your completed and paid rentals"
    );
  }

  // Prevent multiple reviews for the same booking
  const existingReview = await reviews.findOne({
    bookingId: booking._id,
  });

  if (existingReview) {
    throw new Error("You have already reviewed this booking");
  }

  const review = {
    bookingId: booking._id,
    equipmentId: booking.equipmentId,
    customerId: customer.id,
    customerName: customer.name || "Customer",
    rating: reviewData.rating,
    comment: reviewData.comment,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await reviews.insertOne(review);

  return {
    _id: result.insertedId,
    ...review,
  };
};

// Update a customer's own review
export const updateReview = async (reviewId, updateData, customerId) => {
  if (!ObjectId.isValid(reviewId)) {
    throw new Error("Invalid review ID");
  }

  const reviews = getReviewCollection();
  const reviewObjectId = new ObjectId(reviewId);

  const existingReview = await reviews.findOne({
    _id: reviewObjectId,
    customerId,
  });

  if (!existingReview) {
    throw new Error("Review not found");
  }

  // Update only the supplied review fields
  const updates = {
    ...updateData,
    status: "pending",
    updatedAt: new Date(),
  };

  await reviews.updateOne(
    {
      _id: reviewObjectId,
      customerId,
    },
    {
      $set: updates,
    }
  );

  // Updated reviews require admin approval again
  return reviews.findOne({ _id: reviewObjectId });
};

// Get approved reviews for a specific equipment
export const getEquipmentReviews = async (equipmentId, query) => {
  if (!ObjectId.isValid(equipmentId)) {
    throw new Error("Invalid equipment ID");
  }

  const reviews = getReviewCollection();

  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;

  const filter = {
    equipmentId: new ObjectId(equipmentId),
    status: "approved",
  };

  const [data, total, ratingSummary] = await Promise.all([
    reviews.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .project({
        customerId: 0,
        bookingId: 0,
      })
      .toArray(),

    reviews.countDocuments(filter),

    reviews.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]).toArray(),
  ]);

  const summary = ratingSummary[0] || {};

  return {
    data,
    summary: {
      averageRating: summary.averageRating
        ? Number(summary.averageRating.toFixed(1))
        : 0,
      totalReviews: summary.totalReviews || 0,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};
