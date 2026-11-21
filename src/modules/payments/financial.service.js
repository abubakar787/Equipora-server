
import { getDB } from "../../config/db.js";
import { DEFAULT_FINANCIAL_CONFIG } from "./payment.config.js";

// Access the financial settings collection
const getSettingsCollection = () =>
  getDB().collection("financialSettings");

// Get the current financial configuration
export const getFinancialConfig = async () => {
  const settings = getSettingsCollection();

  const config = await settings.findOne({ key: "platform" });

  return config || DEFAULT_FINANCIAL_CONFIG;
};

// Initialize the default financial configuration
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

// Update platform commission rate
export const updateFinancialConfig = async (commissionRate, adminId) => {
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

  return getFinancialConfig();
};

// Calculate EQUIPORA platform commission
export const calculateRentalCommission = async (rentalSubtotal) => {
  if (
    typeof rentalSubtotal !== "number" ||
    !Number.isFinite(rentalSubtotal) ||
    rentalSubtotal <= 0
  ) {
    throw new Error("Invalid rental subtotal");
  }

  const config = await getFinancialConfig();
  const commissionRate = Number(config.commissionRate);

  if (
    !Number.isFinite(commissionRate) ||
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw new Error("Invalid platform commission configuration");
  }

  const rentalAmountCents = Math.round(rentalSubtotal * 100);

  const commissionCents = Math.round(
    (rentalAmountCents * commissionRate) / 100
  );

  const ownerEarningsCents =
    rentalAmountCents - commissionCents;

  return {
    currency: config.currency || "usd",
    commissionRate,
    rentalAmountCents,
    commissionCents,
    ownerEarningsCents,
  };
};

// Get financial summary for the admin dashboard
export const getFinancialSummary = async () => {
  const db = getDB();

  const payments = db.collection("payments");
  const expenses = db.collection("expenses");

  // Include successful payments even when partially or fully refunded.
  const paymentSummary = await payments.aggregate([
    {
      $match: {
        status: {
          $in: ["paid", "partially_refunded", "refunded"],
        },
        currency: "usd",
      },
    },
    {
      $group: {
        _id: null,

        // Rental revenue after deducting refunds.
        totalRentalRevenueCents: {
          $sum: {
            $subtract: [
              "$amountCents",
              { $ifNull: ["$refundedAmountCents", 0] },
            ],
          },
        },

        // EQUIPORA commission after commission refunds.
        equiporaRevenueCents: {
          $sum: {
            $subtract: [
              "$commissionCents",
              { $ifNull: ["$refundedCommissionCents", 0] },
            ],
          },
        },

        // Owner earnings after owner refund adjustments.
        ownerEarningsCents: {
          $sum: {
            $subtract: [
              "$ownerEarningsCents",
              { $ifNull: ["$refundedOwnerEarningsCents", 0] },
            ],
          },
        },

        totalPayments: { $sum: 1 },

        totalRefundedCents: {
          $sum: { $ifNull: ["$refundedAmountCents", 0] },
        },
      },
    },
  ]).toArray();

  // Calculate recorded business expenses.
  const expenseSummary = await expenses.aggregate([
    {
      $match: {
        status: { $ne: "void" },
        currency: "usd",
      },
    },
    {
      $group: {
        _id: null,
        totalExpensesCents: { $sum: "$amountCents" },
        totalExpenseRecords: { $sum: 1 },
      },
    },
  ]).toArray();

  const paymentData = paymentSummary[0] || {};
  const expenseData = expenseSummary[0] || {};

  const totalRentalRevenueCents =
    paymentData.totalRentalRevenueCents || 0;

  const equiporaRevenueCents =
    paymentData.equiporaRevenueCents || 0;

  const ownerEarningsCents =
    paymentData.ownerEarningsCents || 0;

  const totalRefundedCents =
    paymentData.totalRefundedCents || 0;

  const totalExpensesCents =
    expenseData.totalExpensesCents || 0;

  // EQUIPORA net profit = net commission - operating expenses.
  const netProfitCents =
    equiporaRevenueCents - totalExpensesCents;

  return {
    currency: "usd",

    summary: {
      totalRentalRevenueCents,
      equiporaRevenueCents,
      ownerEarningsCents,
      totalRefundedCents,
      totalExpensesCents,
      netProfitCents,
      totalPayments: paymentData.totalPayments || 0,
      totalExpenseRecords: expenseData.totalExpenseRecords || 0,
    },
  };
};
