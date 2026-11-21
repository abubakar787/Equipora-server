
import express from "express";

// Authentication and role authorization
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

// Review controllers
import {
  getEquipmentReviewsController,
  createReviewController,
  updateReviewController,
  getPendingReviewsController,
  moderateReviewController,
} from "./review.controller.js";

const router = express.Router();

// Public: Get approved reviews for specific equipment
router.get(
  "/equipment/:equipmentId",
  getEquipmentReviewsController
);

// Customer: Create a review
router.post(
  "/",
  verifyToken,
  authorizeRole("customer"),
  createReviewController
);

// Customer: Update their own review
router.patch(
  "/:id",
  verifyToken,
  authorizeRole("customer"),
  updateReviewController
);

// Admin: Get all pending reviews
router.get(
  "/admin/pending",
  verifyToken,
  authorizeRole("admin"),
  getPendingReviewsController
);

// Admin: Approve or reject a review
router.patch(
  "/admin/:id/moderate",
  verifyToken,
  authorizeRole("admin"),
  moderateReviewController
);

export default router;
