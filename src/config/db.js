
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

    console.log("Payment database indexes initialized");

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
