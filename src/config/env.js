import "dotenv/config";

// Required environment variables
const requiredEnv = [
  "MONGODB_URI",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "STRIPE_SECRET_KEY",
];

// Stop application startup if a required variable is missing
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Centralized application configuration
export const env = {
  // Server configuration
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",

  // MongoDB configuration
  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || "equipora",

  // Better Auth configuration
  betterAuthSecret: process.env.BETTER_AUTH_SECRET,
  betterAuthUrl: process.env.BETTER_AUTH_URL,

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

  // GitHub OAuth
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,

  // Stripe payment configuration
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
};