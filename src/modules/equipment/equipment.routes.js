
import express from "express";

import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

import {
  createEquipmentController,
  getAllEquipmentController,
  getEquipmentByIdController,
  getOwnerEquipmentByIdController,
  updateEquipmentController,
  deleteEquipmentController,
  getMyEquipmentController,
  reviewEquipmentController,
  getPendingEquipmentController,
} from "./equipment.controller.js";

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================

// GET /api/equipment
router.get("/", getAllEquipmentController);

// ============================================
// OWNER ROUTES
// Specific routes MUST come before /:id
// ============================================

// GET /api/equipment/my-equipment
router.get(
  "/my-equipment",
  verifyToken,
  authorizeRole("owner", "admin"),
  getMyEquipmentController
);

// GET /api/equipment/my-equipment/:id
router.get(
  "/my-equipment/:id",
  verifyToken,
  authorizeRole("owner", "admin"),
  getOwnerEquipmentByIdController
);

// POST /api/equipment
router.post(
  "/",
  verifyToken,
  authorizeRole("owner", "admin"),
  createEquipmentController
);

// ============================================
// ADMIN ROUTES
// ============================================

// GET /api/equipment/admin/pending
router.get(
  "/admin/pending",
  verifyToken,
  authorizeRole("admin"),
  getPendingEquipmentController
);

// PATCH /api/equipment/:id/review
router.patch(
  "/:id/review",
  verifyToken,
  authorizeRole("admin"),
  reviewEquipmentController
);

// ============================================
// DYNAMIC EQUIPMENT ROUTES
// Keep these AFTER specific GET routes
// ============================================

// GET /api/equipment/:id
router.get("/:id", getEquipmentByIdController);

// PATCH /api/equipment/:id
router.patch(
  "/:id",
  verifyToken,
  authorizeRole("owner", "admin"),
  updateEquipmentController
);

// DELETE /api/equipment/:id
router.delete(
  "/:id",
  verifyToken,
  authorizeRole("owner"),
  deleteEquipmentController
);

export default router;
