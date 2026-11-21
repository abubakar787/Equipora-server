import { getDB } from "../../config/db.js";
import { DEFAULT_FINANCIAL_CONFIG } from "./payment.config.js";

// Access the financial settings collection
const getSettingsCollection = () =>
  getDB().collection("financialSettings");

// Get the current financial configuration
export const getFinancialConfig = async () => {
  const settings = getSettingsCollection();

  // Return the saved configuration or the default configuration
  const config = await settings.findOne({ key: "platform" });

  if (config) {
    return config;
  }

  return DEFAULT_FINANCIAL_CONFIG;
};

// Create the initial configuration if it does not exist
export const initializeFinancialConfig = async () => {
  const settings = getSettingsCollection();

  await settings.updateOne(
    { key: "platform" },
    {
      $setOnInsert: {
        key: "platform",
        ...DEFAULT_FINANCIAL_CONFIG,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return getFinancialConfig();
};


/**
 * Update the platform commission rate.
 * Only an authorized admin should be able to call this service.
 */
export const updateFinancialConfig = async (commissionRate, adminId) => {
  // Validate commission rate
  if (
    typeof commissionRate !== "number" ||
    !Number.isFinite(commissionRate) ||
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw new Error("Commission rate must be between 0 and 100");
  }

  const settings = getSettingsCollection();
  const now = new Date();

  // Save the updated platform commission configuration
  await settings.updateOne(
    { key: "platform" },
    {
      $set: {
        commissionRate,
        currency: "usd",
        commissionType: "percentage",
        updatedBy: adminId,
        updatedAt: now,
      },
      $setOnInsert: {
        key: "platform",
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // Return the latest saved configuration
  return getFinancialConfig();
};
