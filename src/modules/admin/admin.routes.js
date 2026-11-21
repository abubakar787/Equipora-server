
import { Router } from "express";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

import {
  getAdminDashboardAnalyticsController,
} from "./admin.controller.js";

const router = Router();

// Only authenticated Admin can access analytics
router.get(
  "/analytics",
  verifyToken,
  authorizeRole("admin"),
  getAdminDashboardAnalyticsController
);

export default router;
