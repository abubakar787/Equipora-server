import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { getDB } from "./config/db.js";

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.clientUrl,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true,
  }),
);

// Request parsing
app.use(express.json({ limit: "1mb" }));

// HTTP request logging
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

// Not found handler
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