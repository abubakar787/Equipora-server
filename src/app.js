
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


const app = express();

app.use("/api/categories", categoryRoutes);

app.use("/api/bookings", bookingRoutes);
// Equipment routes
app.use("/api/equipment", equipmentRoutes);
// Test routes
app.use("/api/test", testRoutes);
// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.clientUrl,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Better Auth handler
// IMPORTANT: Must be before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

// Request body parser
app.use(express.json({ limit: "1mb" }));

// HTTP request logger
if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Equipora API is running",
  });
});

// Health check
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// Global error handler
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
