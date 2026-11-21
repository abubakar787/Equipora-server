
import express from "express";

// Authentication and role authorization
import { verifyToken } from "../../middlewares/verifyToken.js";
import { authorizeRole } from "../../middlewares/authorizeRole.js";

// Expense controllers
import {
  createExpenseController,
  getAllExpensesController,
  updateExpenseController,
  deleteExpenseController,
} from "./expense.controller.js";

const router = express.Router();

// All expense management endpoints are restricted to admins
router.use(verifyToken, authorizeRole("admin"));

// Create a new business expense
router.post("/", createExpenseController);

// Get all expenses with pagination and optional category filter
router.get("/", getAllExpensesController);

// Update an existing expense
router.patch("/:id", updateExpenseController);

// Delete an expense
router.delete("/:id", deleteExpenseController);

export default router;
