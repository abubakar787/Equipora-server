
import {
  addFavorite,
  getMyFavorites,
  removeFavorite,
} from "./favorite.service.js";

import {
  favoriteSchema,
  favoriteQuerySchema,
} from "./favorite.validation.js";

// Add equipment to favorites
export const addFavoriteController = async (req, res) => {
  try {
    const validation = favoriteSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment information",
        errors: validation.error.flatten(),
      });
    }

    const favorite = await addFavorite(
      validation.data.equipmentId,
      req.user.id
    );

    return res.status(201).json({
      success: true,
      message: "Equipment added to favorites successfully",
      data: favorite,
    });
  } catch (error) {
    console.error("Add favorite error:", error);

    // Handle duplicate favorite errors from MongoDB
    if (
      error.code === 11000 ||
      error.message === "Equipment is already in your favorites"
    ) {
      return res.status(409).json({
        success: false,
        message: "Equipment is already in your favorites",
      });
    }

    const statusCode =
      error.message === "Approved equipment not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to add favorite",
    });
  }
};

// Get logged-in customer's favorite equipment
export const getMyFavoritesController = async (req, res) => {
  try {
    const validation = favoriteQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
        errors: validation.error.flatten(),
      });
    }

    const result = await getMyFavorites(
      req.user.id,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Favorites retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get favorites error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve favorites",
    });
  }
};

// Remove equipment from favorites
export const removeFavoriteController = async (req, res) => {
  try {
    const validation = favoriteSchema.safeParse({
      equipmentId: req.params.equipmentId,
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment ID",
        errors: validation.error.flatten(),
      });
    }

    await removeFavorite(
      validation.data.equipmentId,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Equipment removed from favorites successfully",
    });
  } catch (error) {
    console.error("Remove favorite error:", error);

    const statusCode =
      error.message === "Favorite equipment not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to remove favorite",
    });
  }
};
