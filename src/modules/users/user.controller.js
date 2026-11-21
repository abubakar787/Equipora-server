
import {
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  updateUserRole,
} from "./user.service.js";

import {
  updateProfileSchema,
  userQuerySchema,
  updateUserRoleSchema,
} from "./user.validation.js";

// Get logged-in user's profile
export const getMyProfileController = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(404).json({
      success: false,
      message: error.message || "Failed to retrieve profile",
    });
  }
};

// Update logged-in user's profile
export const updateMyProfileController = async (req, res) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile information",
        errors: validation.error.flatten(),
      });
    }

    const profile = await updateMyProfile(
      req.user.id,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
};

// Get all users (admin only)
export const getAllUsersController = async (req, res) => {
  try {
    const validation = userQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid user search parameters",
        errors: validation.error.flatten(),
      });
    }

    const result = await getAllUsers(validation.data);

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
};

// Update user role (admin only)
export const updateUserRoleController = async (req, res) => {
  try {
    const validation = updateUserRoleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
        errors: validation.error.flatten(),
      });
    }

    const user = await updateUserRole(
      req.params.id,
      validation.data.role,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update user role error:", error);

    const statusCode =
      error.message === "User not found" ? 404 :
      error.message === "You cannot change your own role" ? 403 :
      400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update user role",
    });
  }
};
