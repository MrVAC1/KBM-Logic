import Transaction from '../models/Transaction.js';
import Task from '../models/Task.js';
import { calculatePlannedValue, calculateActualCost } from '../services/budgetEngine.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';
import { logDataOperation, ensureTransactionInMongo } from '../services/mongoSync.js';

/**
 * Get dashboard stats
 * GET /api/projects/:projectId/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = req.project;

    // Calculate actual cost
    const actualCost = await calculateActualCost(projectId);

    // Calculate planned value (S-curve)
    const projectStartDate = project.createdAt;
    const projectEndDate = new Date(projectStartDate);
    projectEndDate.setMonth(projectEndDate.getMonth() + 6); // Default 6 months

    const plannedValueCurve = await calculatePlannedValue(
      projectId,
      projectStartDate,
      projectEndDate,
      project.fixedCosts
    );

    // Get transactions
    const transactions = await Transaction.find({ projectId })
      .populate('authorId', 'displayName')
      .sort({ date: -1 })
      .limit(10);

    // Get tasks summary
    const tasks = await Task.find({ projectId });
    const tasksByStatus = {
      Todo: tasks.filter(t => t.status === 'Todo').length,
      'In Progress': tasks.filter(t => t.status === 'In Progress').length,
      Review: tasks.filter(t => t.status === 'Review').length,
      Done: tasks.filter(t => t.status === 'Done').length,
    };

    sendSuccess(res, {
      actualCost,
      plannedValueCurve,
      transactions,
      tasksByStatus,
      totalTasks: tasks.length,
    });
  } catch (error) {
    logger.error(`Get Stats Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch stats', 500);
  }
};

/**
 * Create transaction
 * POST /api/projects/:projectId/transactions
 */
export const createTransaction = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { amount, type, source, date, description } = req.body;
    const authorId = req.dbUser._id;

    const transaction = await Transaction.create({
      projectId,
      amount,
      type,
      source,
      date: date || new Date(),
      description,
      authorId,
    });

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate('authorId', 'displayName email');

    // Log MongoDB persistence
    await logDataOperation('create', 'transactions', transaction._id.toString(), authorId, {
      projectId: projectId.toString(),
      amount,
      type,
      source,
    });

    sendSuccess(res, {
      ...populatedTransaction.toObject(),
      _persistedToMongo: true, // Flag indicating MongoDB persistence
    }, 201);
  } catch (error) {
    logger.error(`Create Transaction Error: ${error.message}`, { error });
    sendError(res, 'Failed to create transaction', 500);
  }
};

/**
 * Get transactions
 * GET /api/projects/:projectId/transactions
 */
export const getTransactions = async (req, res) => {
  try {
    const { projectId } = req.params;

    const transactions = await Transaction.find({ projectId })
      .populate('authorId', 'displayName email')
      .sort({ date: -1 });

    sendSuccess(res, transactions);
  } catch (error) {
    logger.error(`Get Transactions Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch transactions', 500);
  }
};


