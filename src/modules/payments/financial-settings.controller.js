
import {
  getFinancialConfig,
  updateFinancialConfig,
} from "./financial.service.js";

// Get current platform financial settings
export const getFinancialSettingsController = async (req, res) => {
  try {
    const settings = await getFinancialConfig();

    return res.status(200).json({
      success: true,
      message: "Financial settings retrieved successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Get financial settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve financial settings",
    });
  }
};

// Update platform commission rate
export const updateFinancialSettingsController = async (req, res) => {
  try {
    const { commissionRate } = req.body;

    // Validate the commission rate
    if (
      typeof commissionRate !== "number" ||
      !Number.isFinite(commissionRate) ||
      commissionRate < 0 ||
      commissionRate > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Commission rate must be a number between 0 and 100",
      });
    }

    const settings = await updateFinancialConfig(
      commissionRate,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Platform commission updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Update financial settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update financial settings",
    });
  }
};
