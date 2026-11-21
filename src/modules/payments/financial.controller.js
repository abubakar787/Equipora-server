
import { getFinancialSummary } from "./financial.service.js";

// Get financial summary for the admin dashboard
export const getFinancialSummaryController = async (req, res) => {
  try {
    const financialSummary = await getFinancialSummary();

    return res.status(200).json({
      success: true,
      message: "Financial summary retrieved successfully",
      data: financialSummary,
    });
  } catch (error) {
    console.error("Financial summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve financial summary",
    });
  }
};
