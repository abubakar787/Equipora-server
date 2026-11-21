
import express from "express";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyRole } from "../middlewares/verifyRole.js";

const router = express.Router();

// Test 1: Public API
router.get("/public", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Public API is working",
  });
});

// Test 2: Protected API - Any authenticated user
router.get("/protected", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authentication successful",
    user: req.user,
  });
});

// Test 3: Owner and Admin only
router.get(
  "/owner",
  verifyToken,
  verifyRole("owner", "admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Owner access granted",
      user: req.user,
    });
  }
);

// Test 4: Admin only
router.get(
  "/admin",
  verifyToken,
  verifyRole("admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Admin access granted",
      user: req.user,
    });
  }
);

export default router;
