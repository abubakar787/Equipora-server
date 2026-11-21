
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";

// Access the expenses collection
const getExpenseCollection = () =>
  getDB().collection("expenses");

// ============================================
// 1. CREATE EXPENSE
// ============================================

export const createExpense = async (expenseData, admin) => {
  const expenses = getExpenseCollection();

  const expense = {
    title: expenseData.title,
    description: expenseData.description || "",
    category: expenseData.category,

    // Store money as integer cents in USD
    amountCents: expenseData.amountCents,
    currency: "usd",

    expenseDate: new Date(
      `${expenseData.expenseDate}T00:00:00.000Z`
    ),

    reference: expenseData.reference || "",

    // Expense audit information
    status: "active",
    createdBy: admin.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await expenses.insertOne(expense);

  return {
    _id: result.insertedId,
    ...expense,
  };
};

// ============================================
// 2. GET ALL EXPENSES
// ============================================

export const getAllExpenses = async (query) => {
  const expenses = getExpenseCollection();

  const filter = {
    status: { $ne: "void" },
  };

  if (query.category) {
    filter.category = query.category;
  }

  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    expenses
      .find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),

    expenses.countDocuments(filter),
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ============================================
// 3. UPDATE EXPENSE
// ============================================

export const updateExpense = async (expenseId, updateData) => {
  if (!ObjectId.isValid(expenseId)) {
    throw new Error("Invalid expense ID");
  }

  const expenses = getExpenseCollection();
  const objectId = new ObjectId(expenseId);

  const allowedFields = [
    "title",
    "description",
    "category",
    "amountCents",
    "expenseDate",
    "reference",
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      updates[field] =
        field === "expenseDate"
          ? new Date(`${updateData[field]}T00:00:00.000Z`)
          : updateData[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided for update");
  }

  updates.updatedAt = new Date();

  const result = await expenses.updateOne(
    {
      _id: objectId,
      status: { $ne: "void" },
    },
    {
      $set: updates,
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("Active expense record not found");
  }

  return expenses.findOne({ _id: objectId });
};

// ============================================
// 4. VOID EXPENSE (SOFT DELETE)
// ============================================

export const deleteExpense = async (expenseId, admin) => {
  if (!ObjectId.isValid(expenseId)) {
    throw new Error("Invalid expense ID");
  }

  const expenses = getExpenseCollection();
  const objectId = new ObjectId(expenseId);

  const result = await expenses.updateOne(
    {
      _id: objectId,
      status: { $ne: "void" },
    },
    {
      $set: {
        status: "void",
        voidedBy: admin.id,
        voidedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("Active expense record not found");
  }

  return {
    deleted: true,
    message: "Expense successfully voided",
  };
};
