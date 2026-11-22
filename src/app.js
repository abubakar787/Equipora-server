
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { toNodeHandler } from "better-auth/node";

import { env } from "./config/env.js";
import { getDB } from "./config/db.js";
import { auth } from "./config/auth.js";

import testRoutes from "./routes/test.routes.js";
import equipmentRoutes from "./modules/equipment/equipment.routes.js";
import categoryRoutes from "./modules/categories/category.routes.js";
import bookingRoutes from "./modules/booking/booking.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import { stripeWebhookController } from "./modules/payments/payment.controller.js";
// Expense management routes
import expenseRoutes from "./modules/expenses/expense.routes.js";
// User profile and management routes
import userRoutes from "./modules/users/user.routes.js";
// Customer favorites routes
import favoriteRoutes from "./modules/favorites/favorite.routes.js";
// Equipment reviews and ratings routes
import reviewRoutes from "./modules/reviews/review.routes.js";
// Admin dashboard and analytics routes
import adminRoutes from "./modules/admin/admin.routes.js";



// Create the Express application before registering any routes
const app = express();

 
// ============================================
// 1. SECURITY MIDDLEWARE
// ============================================

app.use(helmet());

// Allow both local development and production frontend
const allowedOrigins = [
  "http://localhost:3000",
  env.clientUrl,
  "https://equipora-client-gules.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header (e.g. server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked this origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Log HTTP requests during development
if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// ============================================
// 2. BETTER AUTH
// ============================================

// Better Auth handler must run before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

// ============================================
// 3. STRIPE WEBHOOK
// ============================================

// Stripe requires the original raw request body for signature verification.
// This route must be registered before express.json().
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookController
);

// ============================================
// 4. REQUEST BODY PARSER
// ============================================

// Parse JSON bodies for normal API requests
app.use(express.json({ limit: "1mb" }));

// ============================================
// Application routes
// Application routes
app.use("/api/categories", categoryRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/test", testRoutes);
// Customer favorites endpoints
app.use("/api/favorites", favoriteRoutes);
// Equipment reviews endpoints
app.use("/api/reviews", reviewRoutes);
// Admin dashboard endpoints
app.use("/api/admin", adminRoutes);
// ============================================
// 6. ROOT ROUTE
// ============================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Equipora API is running",
  });
});

// ============================================
// 7. DATABASE HEALTH CHECK
// ============================================

app.get("/api/health", async (req, res, next) => {
  try {
    await getDB().command({ ping: 1 });

    res.status(200).json({
      success: true,
      message: "API and database are healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// 8. 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// ============================================
// 9. GLOBAL ERROR HANDLER
// ============================================

app.use((error, req, res, next) => {
  console.error(error);

  res.status(error.status || 500).json({
    success: false,
    message:
      env.nodeEnv === "development"
        ? error.message
        : "Internal server error",
  });
});

export default app;
