
import express from "express";

import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

import {
  createEquipmentController,
  getAllEquipmentController,
  getEquipmentByIdController,
  updateEquipmentController,
  deleteEquipmentController,
  getMyEquipmentController,
  reviewEquipmentController,
  getPendingEquipmentController,
  getOwnerEquipmentByIdController,
} from "./equipment.controller.js";

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================

// Get all approved equipment
router.get("/", getAllEquipmentController);

// ============================================
// AUTHENTICATED OWNER ROUTES
// ============================================

// Get my equipment
// Keep this before /:id
router.get(
  "/my-equipment",
  verifyToken,
  authorizeRole("owner", "admin"),
  getMyEquipmentController
);

// Create equipment
router.post(
  "/",
  verifyToken,
  authorizeRole("owner", "admin"),
  createEquipmentController
);

// ============================================
// ADMIN ROUTES
// ============================================

// Get pending equipment
// Keep this before /:id
router.get(
  "/admin/pending",
  verifyToken,
  authorizeRole("admin"),
  getPendingEquipmentController
);

// Approve or reject equipment
router.patch(
  "/:id/review",
  verifyToken,
  authorizeRole("admin"),
  reviewEquipmentController
);

router.get(
  "/my-equipment/:id",
  verifyToken,
  authorizeRole("owner", "admin"),
  getOwnerEquipmentByIdController
);
// ============================================
// EQUIPMENT DETAILS
// ============================================

// Get equipment details
router.get("/:id", getEquipmentByIdController);

// Update equipment
router.patch(
  "/:id",
  verifyToken,
  authorizeRole("owner", "admin"),
  updateEquipmentController
);

// Delete equipment
router.delete(
  "/:id",
  verifyToken,
  authorizeRole("owner"),
  deleteEquipmentController
);

export default router;
