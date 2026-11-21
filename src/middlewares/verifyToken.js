
import { jwtVerify, createRemoteJWKSet } from "jose";
import { ObjectId } from "mongodb";

import { env } from "../config/env.js";
import { getDB } from "../config/db.js";

// Better Auth public signing keys
const JWKS = createRemoteJWKSet(
  new URL(`${env.betterAuthUrl}/api/auth/jwks`)
);

// Authentication middleware
export const verifyToken = async (req, res, next) => {
  try {
    // 1. Read Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    // 2. Extract JWT
    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // 3. Verify JWT signature and claims
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.betterAuthUrl,
      audience: env.betterAuthUrl,
    });

    // 4. Get authenticated user ID
    const userId = payload.sub || payload.id;

    if (typeof userId !== "string" || !userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user information in token",
      });
    }

    // 5. Find current user in MongoDB
    const usersCollection = getDB().collection("user");

    const userConditions = [{ id: userId }];

    if (ObjectId.isValid(userId)) {
      userConditions.push({
        _id: new ObjectId(userId),
      });
    }

    const currentUser = await usersCollection.findOne({
      $or: userConditions,
    });

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    // 6. Validate current database role
    const allowedRoles = ["customer", "owner", "admin"];

    if (!allowedRoles.includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role",
      });
    }

    // 7. Attach trusted user information
    req.user = {
      id: currentUser.id || currentUser._id.toString(),
      email: currentUser.email,
      role: currentUser.role,
    };

    // 8. Continue to next middleware
    return next();
  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
};
