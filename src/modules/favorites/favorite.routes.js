
import express from "express";

// Authentication and role authorization
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

// Favorite controllers
import {
  addFavoriteController,
  getMyFavoritesController,
  removeFavoriteController,
} from "./favorite.controller.js";

const router = express.Router();

// Only logged-in customers can manage favorites
router.use(verifyToken, authorizeRole("customer"));

// Add equipment to favorites
router.post("/", addFavoriteController);

// Get customer's favorite equipment
router.get("/", getMyFavoritesController);

// Remove equipment from favorites
router.delete("/:equipmentId", removeFavoriteController);

export default router;
