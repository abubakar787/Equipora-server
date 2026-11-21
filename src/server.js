import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB, closeDB } from "./config/db.js";

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(env.port, () => {
      console.log(`Equipora server running on port ${env.port}`);
      console.log(`Local URL: http://localhost:${env.port}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        await closeDB();
        console.log("Server and database connection closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();