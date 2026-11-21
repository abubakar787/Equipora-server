
import express from "express";

// Authentication and role authorization
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

// Review controllers
import {
  createReviewController,
  updateReviewController,
  getEquipmentReviewsController,
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

export default router;
