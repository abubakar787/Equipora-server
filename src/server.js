
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";

const startServer = async () => {
  try {
    // Connect to MongoDB before starting the server
    await connectDB();

    // Start Express server
    app.listen(env.port, () => {
      console.log("-----------------------------------");
      console.log("       EQUIPORA API SERVER");
      console.log("-----------------------------------");
      console.log(`Environment: ${env.nodeEnv}`);
      console.log(`Server URL:  http://localhost:${env.port}`);
      console.log(`Health URL:  http://localhost:${env.port}/api/health`);
      console.log("-----------------------------------");
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
