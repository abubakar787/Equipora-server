
import {
  createExpense,
  getAllExpenses,
  updateExpense,
  deleteExpense,
} from "./expense.service.js";

import {
  createExpenseSchema,
  updateExpenseSchema,
} from "./expense.validation.js";

// ============================================
// 1. CREATE EXPENSE
// ============================================

export const createExpenseController = async (req, res, next) => {
  try {
    // Validate incoming expense data
    const validation = createExpenseSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense data",
        errors: validation.error.flatten(),
      });
    }

    const result = await createExpense(validation.data, req.user);

    return res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================
// 2. GET ALL EXPENSES
// ============================================

export const getAllExpensesController = async (req, res, next) => {
  try {
    const query = {
      category: req.query.category,
      page: Math.max(1, Number(req.query.page) || 1),
      limit: Math.min(50, Math.max(1, Number(req.query.limit) || 10)),
    };

    const result = await getAllExpenses(query);

    return res.status(200).json({
      success: true,
      message: "Expenses retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================
// 3. UPDATE EXPENSE
// ============================================

export const updateExpenseController = async (req, res, next) => {
  try {
    // Validate expense update data
    const validation = updateExpenseSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense update data",
        errors: validation.error.flatten(),
      });
    }

    const result = await updateExpense(
      req.params.id,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================
// 4. DELETE EXPENSE
// ============================================

export const deleteExpenseController = async (req, res, next) => {
  try {
    await deleteExpense(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};
