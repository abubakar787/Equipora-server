
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { toNodeHandler } from "better-auth/node";

import { env } from "./config/env.js";
import { getDB, connectDB } from "./config/db.js";
import { auth } from "./config/auth.js";

import testRoutes from "./routes/test.routes.js";
import equipmentRoutes from "./modules/equipment/equipment.routes.js";
import categoryRoutes from "./modules/categories/category.routes.js";
import bookingRoutes from "./modules/booking/booking.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import { stripeWebhookController } from "./modules/payments/payment.controller.js";
import expenseRoutes from "./modules/expenses/expense.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import favoriteRoutes from "./modules/favorites/favorite.routes.js";
import reviewRoutes from "./modules/reviews/review.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";

const app = express();

// ============================================
// 1. CORS — MUST RUN BEFORE OTHER MIDDLEWARE
// ============================================

const allowedOrigins = [
  "http://localhost:3000",
  "https://equipora-client-gules.vercel.app",
  "https://equipora-client-8xc091qfz-anas-tech-solutions.vercel.app",
  env.clientUrl?.replace(/\/$/, ""),
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
      return callback(null, true);
    }

    console.error("Blocked CORS origin:", origin);
    return callback(new Error(`CORS blocked this origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// ============================================
// 2. SECURITY & LOGGING
// ============================================

app.use(helmet());

if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// ============================================
// 3. DATABASE CONNECTION
// ============================================

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error);
    next(error);
  }
});

// ============================================
// 4. BETTER AUTH
// Must run before express.json()
// ============================================

app.all("/api/auth/*splat", toNodeHandler(auth));

// ============================================
// 5. STRIPE WEBHOOK
// Raw body must be preserved
// ============================================

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookController
);

// ============================================
// 6. JSON BODY PARSER
// ============================================

app.use(express.json({ limit: "1mb" }));

// ============================================
// 7. APPLICATION ROUTES
// ============================================

app.use("/api/categories", categoryRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/test", testRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);

// ============================================
// 8. ROOT ROUTE
// ============================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Equipora API is running",
  });
});

// ============================================
// 9. DATABASE HEALTH CHECK
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
// 10. 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// ============================================
// 11. GLOBAL ERROR HANDLER
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
