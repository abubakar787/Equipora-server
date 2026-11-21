import "dotenv/config";

const requiredEnv = ["MONGODB_URI"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || "equipora",
};