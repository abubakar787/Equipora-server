
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt } from "better-auth/plugins";

import { client, getDB } from "./db.js";
import { env } from "./env.js";

export const auth = betterAuth({
  // Application configuration
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  
  // Social account linking
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },


  // MongoDB adapter
  database: mongodbAdapter(getDB(), {
    client,
  }),

  // Trusted frontend origin
trustedOrigins: [
  "https://equipora-client-gules.vercel.app",
  "http://localhost:3000",
],
advanced: {
  defaultCookieAttributes: {
    sameSite: "none",
    secure: true,
  },
},
  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
      allowDifferentEmails: false,
    },
  },
  // Social authentication
  socialProviders: {
    google: {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    },

    github: {
      clientId: env.githubClientId,
      clientSecret: env.githubClientSecret,
    },
  },

  // User role configuration
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: false,
      },
    },
  },

  // JWT configuration
  plugins: [
    jwt({
      jwt: {
        definePayload: ({ user }) => ({
          id: user.id,
          email: user.email,
          role: user.role,
        }),
      },
    }),
  ],
});
