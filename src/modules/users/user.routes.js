
import express from "express";

// Authentication and role authorization
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

// User controllers
import {
  getMyProfileController,
  updateMyProfileController,
  getAllUsersController,
  updateUserRoleController,
} from "./user.controller.js";

const router = express.Router();

// Customer, Owner and Admin can access their own profile
router.get(
  "/me",
  verifyToken,
  getMyProfileController
);

router.patch(
  "/me",
  verifyToken,
  updateMyProfileController
);

// Admin-only user management
router.get(
  "/",
  verifyToken,
  authorizeRole("admin"),
  getAllUsersController
);

router.patch(
  "/:id/role",
  verifyToken,
  authorizeRole("admin"),
  updateUserRoleController
);

export default router;
