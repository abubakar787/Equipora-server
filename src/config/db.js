
import { MongoClient } from "mongodb";
import { env } from "./env.js";

// ============================================
// 1. GLOBAL MONGODB CLIENT CACHE
// ============================================

// Reuse the MongoDB client across serverless warm instances
const globalForMongo = globalThis;

export const client =
  globalForMongo.__equiporaMongoClient ??
  (globalForMongo.__equiporaMongoClient = new MongoClient(
    env.mongoUri,
    {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 10000,
    }
  ));

// Select EQUIPORA database
const database = client.db(env.dbName);

// ============================================
// 2. DATABASE CONNECTION INITIALIZATION
// ============================================

export const connectDB = async () => {
  // Reuse an existing initialization promise
  if (globalForMongo.__equiporaMongoConnectPromise) {
    return globalForMongo.__equiporaMongoConnectPromise;
  }

  const connectionPromise = (async () => {
    try {
      await client.connect();

      await database.command({ ping: 1 });

      console.log("MongoDB connected successfully");

      // =========================================
      // 3. PAYMENT INDEXES
      // =========================================

      const payments = database.collection("payments");

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

      await payments.createIndex(
        { customerId: 1, createdAt: -1 },
        { name: "customer_payment_history" }
      );

      await payments.createIndex(
        { ownerId: 1, createdAt: -1 },
        { name: "owner_payment_history" }
      );

      await payments.createIndex(
        { createdAt: -1 },
        { name: "admin_payment_history" }
      );

      await payments.createIndex(
        { stripePaymentIntentId: 1 },
        { name: "stripe_payment_intent_lookup" }
      );

      await payments.createIndex(
        { bookingId: 1 },
        { name: "booking_payment_lookup" }
      );

      console.log("Payment database indexes initialized");

      // =========================================
      // 4. REFUND INDEXES
      // =========================================

      const refunds = database.collection("refunds");

      await refunds.createIndex(
        { stripeRefundId: 1 },
        {
          unique: true,
          partialFilterExpression: {
            stripeRefundId: { $type: "string" },
          },
          name: "unique_stripe_refund",
        }
      );

      await refunds.createIndex(
        { paymentId: 1, createdAt: -1 },
        { name: "payment_refund_history" }
      );

      await refunds.createIndex(
        { bookingId: 1, createdAt: -1 },
        { name: "booking_refund_history" }
      );

      console.log("Refund database indexes initialized");

      // =========================================
      // 5. FAVORITES INDEXES
      // =========================================

      const favorites = database.collection("favorites");

      await favorites.createIndex(
        { customerId: 1, equipmentId: 1 },
        {
          unique: true,
          name: "unique_customer_equipment_favorite",
        }
      );

      await favorites.createIndex(
        { customerId: 1, createdAt: -1 },
        { name: "customer_favorites_history" }
      );

      console.log("Favorites database indexes initialized");

      // =========================================
      // 6. REVIEWS INDEXES
      // =========================================

      const reviews = database.collection("reviews");

      await reviews.createIndex(
        { bookingId: 1 },
        {
          unique: true,
          name: "unique_booking_review",
        }
      );

      await reviews.createIndex(
        { equipmentId: 1, status: 1, createdAt: -1 },
        { name: "equipment_approved_reviews" }
      );

      await reviews.createIndex(
        { customerId: 1, createdAt: -1 },
        { name: "customer_review_history" }
      );

      console.log("Reviews database indexes initialized");

      return database;
    } catch (error) {
      console.error(
        "MongoDB initialization failed:",
        error.message
      );

      throw error;
    }
  })();

  globalForMongo.__equiporaMongoConnectPromise = connectionPromise;

  try {
    return await connectionPromise;
  } catch (error) {
    // Allow a future invocation to retry after initialization failure
    delete globalForMongo.__equiporaMongoConnectPromise;
    throw error;
  }
};

// ============================================
// 7. DATABASE ACCESS
// ============================================

export const getDB = () => database;

// ============================================
// 8. CLOSE DATABASE CONNECTION
// ============================================

// Do not call this after individual API requests.
// Keep the connection alive for serverless reuse.
export const closeDB = async () => {
  await client.close();

  delete globalForMongo.__equiporaMongoClient;
  delete globalForMongo.__equiporaMongoConnectPromise;

  console.log("MongoDB connection closed");
};
