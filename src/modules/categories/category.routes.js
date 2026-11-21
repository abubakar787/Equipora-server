
import express from "express";

import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

import {
  createCategoryController,
  getActiveCategoriesController,
  updateCategoryController,
  deactivateCategoryController,
} from "./category.controller.js";

const router = express.Router();

// Public
router.get("/", getActiveCategoriesController);

// Admin only
router.post("/", verifyToken, authorizeRole("admin"), createCategoryController);

router.patch("/:id", verifyToken, authorizeRole("admin"), updateCategoryController);

router.delete("/:id", verifyToken, authorizeRole("admin"), deactivateCategoryController);

export default router;
