
import { getAdminDashboardAnalytics } from "./admin.service.js";

// Get Admin Dashboard Analytics
export const getAdminDashboardAnalyticsController = async (
  req,
  res,
  next
) => {
  try {
    const analytics = await getAdminDashboardAnalytics();

    return res.status(200).json({
      success: true,
      message: "Admin dashboard analytics retrieved successfully",
      data: analytics,
    });
  } catch (error) {
    return next(error);
  }
};
