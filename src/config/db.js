
import { MongoClient } from "mongodb";
import { env } from "./env.js";

// Create the MongoDB client
export const client = new MongoClient(env.mongoUri);

// Select the EQUIPORA database
const database = client.db(env.dbName);

// Connect to MongoDB and initialize database indexes
export const connectDB = async () => {
  try {
    await client.connect();

    // Confirm that MongoDB is reachable
    await database.command({ ping: 1 });

    console.log("MongoDB connected successfully");

    // ============================================
    // PAYMENT COLLECTION INDEXES
    // ============================================

    const payments = database.collection("payments");

    // Prevent duplicate payment records for the same Stripe session
    await payments.createIndex(
      { stripeSessionId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          stripeSessionId: { $type: "string" },
        },
        name: "unique_stripe_session",
      }
    );

    // Improve customer payment history queries
    await payments.createIndex(
      { customerId: 1, createdAt: -1 },
      { name: "customer_payment_history" }
    );

    // Improve owner payment history queries
    await payments.createIndex(
      { ownerId: 1, createdAt: -1 },
      { name: "owner_payment_history" }
    );

    // Improve admin payment history queries
    await payments.createIndex(
      { createdAt: -1 },
      { name: "admin_payment_history" }
    );

    // FAVORITES COLLECTION INDEXES
    const favorites = database.collection("favorites");

    // Prevent duplicate favorites for the same customer and equipment
    await favorites.createIndex(
      { customerId: 1, equipmentId: 1 },
      {
        unique: true,
        name: "unique_customer_equipment_favorite",
      }
    );

    // Improve customer favorite listing performance
    await favorites.createIndex(
      { customerId: 1, createdAt: -1 },
      { name: "customer_favorites_history" }
    );

    console.log("Favorites database indexes initialized");
 
    // REVIEWS COLLECTION INDEXES
    const reviews = database.collection("reviews");

    // One review per booking
    await reviews.createIndex(
      { bookingId: 1 },
      {
        unique: true,
        name: "unique_booking_review",
      }
    );

    // Improve approved equipment review listing
    await reviews.createIndex(
      { equipmentId: 1, status: 1, createdAt: -1 },
      { name: "equipment_approved_reviews" }
    );

    // Improve customer review history
    await reviews.createIndex(
      { customerId: 1, createdAt: -1 },
      { name: "customer_review_history" }
    );

    console.log("Reviews database indexes initialized");


    return database;
  } catch (error) {
    console.error("MongoDB initialization failed:", error.message);
    throw error;
  }
};

// Access the connected database
export const getDB = () => database;

// Gracefully close MongoDB connection
export const closeDB = async () => {
  await client.close();
  console.log("MongoDB connection closed");
};
