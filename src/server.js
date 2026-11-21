
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB, closeDB } from "./config/db.js";

const startServer = async () => {
  let server;

  try {
    // Connect to MongoDB before starting the server
    await connectDB();

    // Start Express server
    server = app.listen(env.port, () => {
      console.log("-----------------------------------");
      console.log("       EQUIPORA API SERVER");
      console.log("-----------------------------------");
      console.log(`Environment: ${env.nodeEnv}`);
      console.log(`Server URL:  http://localhost:${env.port}`);
      console.log(`Health URL:  http://localhost:${env.port}/api/health`);
      console.log("-----------------------------------");
    });

    // Prevent multiple shutdown executions
    let isShuttingDown = false;

    // Graceful shutdown
    const shutdown = async (signal) => {
      if (isShuttingDown) return;

      isShuttingDown = true;

      console.log(`\n${signal} received. Shutting down...`);

      server.close(async (error) => {
        if (error) {
          console.error("HTTP server shutdown error:", error);
          process.exitCode = 1;
        }

        try {
          await closeDB();
          console.log("MongoDB connection closed successfully");
        } catch (dbError) {
          console.error("Database shutdown error:", dbError);
          process.exitCode = 1;
        }

        console.log("EQUIPORA server shutdown complete");

        if (process.exitCode) {
          process.exit(process.exitCode);
        }
      });
    };

    // Handle shutdown signals
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

  } catch (error) {
    console.error("Server startup failed:", error.message);

    if (server) {
      server.close();
    }

    try {
      await closeDB();
    } catch (dbError) {
      console.error("Database cleanup failed:", dbError.message);
    }

    process.exit(1);
  }
};

startServer();
