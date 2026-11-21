
import { getDB } from "../../config/db.js";
import { getFinancialSummary } from "../payments/financial.service.js";

// Get complete marketplace analytics for Admin Dashboard
export const getAdminDashboardAnalytics = async () => {
  const db = getDB();

  const users = db.collection("user");
  const equipment = db.collection("equipment");
  const bookings = db.collection("bookings");
  const payments = db.collection("payments");

  const [
    totalUsers,
    totalCustomers,
    totalOwners,
    totalAdmins,
    totalEquipment,
    pendingEquipment,
    approvedEquipment,
    rejectedEquipment,
    totalBookings,
    pendingBookings,
    confirmedBookings,
    completedBookings,
    cancelledBookings,
    totalPayments,
    financialSummary,
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ role: "customer" }),
    users.countDocuments({ role: "owner" }),
    users.countDocuments({ role: "admin" }),

    equipment.countDocuments(),
    equipment.countDocuments({ status: "pending" }),
    equipment.countDocuments({ status: "approved" }),
    equipment.countDocuments({ status: "rejected" }),

    bookings.countDocuments(),
    bookings.countDocuments({
      status: { $in: ["pending_payment", "approved_for_payment"] },
    }),
    bookings.countDocuments({ status: "confirmed" }),
    bookings.countDocuments({ status: "completed" }),
    bookings.countDocuments({ status: "cancelled" }),

    payments.countDocuments({ status: "paid" }),

    getFinancialSummary(),
  ]);

  return {
    users: {
      total: totalUsers,
      customers: totalCustomers,
      owners: totalOwners,
      admins: totalAdmins,
    },

    equipment: {
      total: totalEquipment,
      pending: pendingEquipment,
      approved: approvedEquipment,
      rejected: rejectedEquipment,
    },

    bookings: {
      total: totalBookings,
      pending: pendingBookings,
      confirmed: confirmedBookings,
      completed: completedBookings,
      cancelled: cancelledBookings,
    },

    payments: {
      total: totalPayments,
    },

    finances: financialSummary,
  };
};
