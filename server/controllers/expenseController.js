import Expense from '../models/Expense.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Get all expenses for a project
 * GET /api/projects/:projectId/expenses
 */
export const getExpenses = async (req, res) => {
  try {
    const { projectId } = req.params;

    const expenses = await Expense.find({ projectId })
      .populate('createdBy', '_id displayName email avatar')
      .populate('updatedBy', '_id displayName email')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { expenses });
  } catch (error) {
    logger.error(`Get Expenses Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch expenses', 500);
  }
};

/**
 * Create a new expense
 * POST /api/projects/:projectId/expenses
 */
export const createExpense = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, amount, frequency } = req.body;
    const userId = req.dbUser._id;

    // Validate input
    if (!name || !name.trim()) {
      return sendError(res, 'Expense name is required', 400);
    }

    if (amount === undefined || amount === null) {
      return sendError(res, 'Amount is required', 400);
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      return sendError(res, 'Amount must be a valid non-negative number', 400);
    }

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    const expenseFrequency = frequency && validFrequencies.includes(frequency) ? frequency : 'monthly';

    const expense = await Expense.create({
      projectId,
      name: name.trim(),
      amount: amountNum,
      frequency: expenseFrequency,
      createdBy: userId,
    });

    const populatedExpense = await Expense.findById(expense._id)
      .populate('createdBy', '_id displayName email avatar')
      .lean();

    logger.info(`Expense created: ${expense._id} for project ${projectId}`);

    sendSuccess(res, populatedExpense, 201);
  } catch (error) {
    logger.error(`Create Expense Error: ${error.message}`, { error });
    sendError(res, 'Failed to create expense', 500);
  }
};

/**
 * Update an expense
 * PUT /api/projects/:projectId/expenses/:expenseId
 */
export const updateExpense = async (req, res) => {
  try {
    const { projectId, expenseId } = req.params;
    const { name, amount, frequency } = req.body;
    const userId = req.dbUser._id;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return sendError(res, 'Expense not found', 404);
    }

    // Verify expense belongs to project
    if (expense.projectId.toString() !== projectId) {
      return sendError(res, 'Expense does not belong to this project', 403);
    }

    // Validate input
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return sendError(res, 'Expense name cannot be empty', 400);
      }
      expense.name = name.trim();
    }

    if (amount !== undefined && amount !== null) {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < 0) {
        return sendError(res, 'Amount must be a valid non-negative number', 400);
      }
      expense.amount = amountNum;
    }

    if (frequency !== undefined) {
      const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
      if (validFrequencies.includes(frequency)) {
        expense.frequency = frequency;
      }
    }

    expense.updatedBy = userId;
    await expense.save();

    const populatedExpense = await Expense.findById(expense._id)
      .populate('createdBy', '_id displayName email avatar')
      .populate('updatedBy', '_id displayName email')
      .lean();

    logger.info(`Expense updated: ${expenseId} by user ${userId}`);

    sendSuccess(res, populatedExpense);
  } catch (error) {
    logger.error(`Update Expense Error: ${error.message}`, { error });
    sendError(res, 'Failed to update expense', 500);
  }
};

/**
 * Delete an expense
 * DELETE /api/projects/:projectId/expenses/:expenseId
 */
export const deleteExpense = async (req, res) => {
  try {
    const { projectId, expenseId } = req.params;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return sendError(res, 'Expense not found', 404);
    }

    // Verify expense belongs to project
    if (expense.projectId.toString() !== projectId) {
      return sendError(res, 'Expense does not belong to this project', 403);
    }

    await Expense.findByIdAndDelete(expenseId);

    logger.info(`Expense deleted: ${expenseId} from project ${projectId}`);

    sendSuccess(res, { message: 'Expense deleted successfully' });
  } catch (error) {
    logger.error(`Delete Expense Error: ${error.message}`, { error });
    sendError(res, 'Failed to delete expense', 500);
  }
};

