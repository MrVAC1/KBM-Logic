import Transaction from '../models/Transaction.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import { calculatePV, calculateEV, calculateAC } from '../services/evmEngine.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';
import { logDataOperation, ensureTransactionInMongo } from '../services/mongoSync.js';
import { normalizeDate } from '../utils/dateUtils.js';

/**
 * Get summary stats only (fast load for metric cards)
 * Internal helper function
 */
async function getSummaryStats(project, projectId, res) {
  try {
    const today = normalizeDate(new Date());
    
    // Calculate current values (today) - these use snapshots for historical dates
    let currentPV = 0;
    let currentAC = 0;
    let currentEV = 0;

    try {
      currentPV = await calculatePV(project, today);
    } catch (error) {
      logger.warn(`Error calculating current PV: ${error.message}`);
    }

    try {
      currentAC = await calculateAC(project, today);
    } catch (error) {
      logger.warn(`Error calculating current AC: ${error.message}`);
    }

    try {
      currentEV = await calculateEV(project, today);
    } catch (error) {
      logger.warn(`Error calculating current EV: ${error.message}`);
    }

    // Calculate variances
    const scheduleVariance = currentEV - currentPV;
    const costVariance = currentEV - currentAC;

    // Calculate total additional funds from income transactions
    const incomeTransactions = await Transaction.find({
      projectId,
      type: '+',
    }).lean();
    
    const totalAdditionalFunds = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const remainingBudget = Math.max(0, (currentPV + totalAdditionalFunds) - currentAC);

    return sendSuccess(res, {
      current: {
        PV: Math.round(currentPV * 100) / 100,
        AC: Math.round(currentAC * 100) / 100,
        EV: Math.round(currentEV * 100) / 100,
      },
      variances: {
        scheduleVariance: Math.round(scheduleVariance * 100) / 100,
        costVariance: Math.round(costVariance * 100) / 100,
      },
      budget: {
        baseline: Math.round(currentPV * 100) / 100,
        totalAdditionalFunds: Math.round(totalAdditionalFunds * 100) / 100,
        remaining: Math.round(remainingBudget * 100) / 100,
      },
      // Legacy fields for backward compatibility
      actualCost: currentAC,
      remaining: Math.round(remainingBudget * 100) / 100,
    });
  } catch (error) {
    logger.error(`Get Summary Stats Error: ${error.message}`, { error });
    return sendError(res, 'Failed to fetch summary stats', 500);
  }
}

/**
 * Get chart data only (evmDataPoints for S-Curve)
 * Internal helper function
 */
async function getChartData(project, projectId, res) {
  try {
    // Get project date range
    const projectStartDate = project.createdAt || new Date();
    let projectEndDate = project.deadline ? new Date(project.deadline) : new Date(projectStartDate);
    
    // If no deadline, use project start + 6 months or latest task deadline
    if (!project.deadline) {
      projectEndDate.setMonth(projectEndDate.getMonth() + 6);
      
      const tasks = await Task.find({ projectId }).select('deadline').lean();
      if (tasks && tasks.length > 0) {
        const latestDeadline = tasks
          .map(t => t.deadline ? new Date(t.deadline) : null)
          .filter(d => d !== null)
          .sort((a, b) => b - a)[0];
        
        if (latestDeadline && latestDeadline > projectEndDate) {
          projectEndDate = latestDeadline;
        }
      }
    }

    // Calculate duration and step using adaptive granularity
    const durationDays = Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // 5-Tier Step Logic for optimal chart density (30-60 points)
    let step = 1; // Default: daily
    if (durationDays < 60) {
      step = 1; // Daily
    } else if (durationDays < 180) {
      step = 7; // Weekly
    } else if (durationDays < 730) { // 2 years
      step = 14; // Bi-weekly
    } else if (durationDays < 1825) { // 5 years
      step = 30; // Monthly
    } else {
      step = 90; // Quarterly
    }

    const evmDataPoints = [];
    const today = normalizeDate(new Date());
    
    // Generate key dates set for injection
    const keyDates = new Set();
    keyDates.add(projectStartDate.getTime());
    keyDates.add(today.getTime());
    if (project.deadline) {
      keyDates.add(new Date(project.deadline).getTime());
    }

    // Generate data points with step
    const allDates = new Set();
    
    // Add step-based dates
    for (let i = 0; i <= durationDays; i += step) {
      const currentDate = new Date(projectStartDate);
      currentDate.setDate(projectStartDate.getDate() + i);
      currentDate.setHours(0, 0, 0, 0);
      allDates.add(currentDate.getTime());
    }
    
    // Inject key dates
    keyDates.forEach(timestamp => {
      allDates.add(timestamp);
    });

    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort((a, b) => a - b);

    // Calculate EVM values for each date (using snapshots for historical dates)
    for (const timestamp of sortedDates) {
      const currentDate = new Date(timestamp);
      currentDate.setHours(0, 0, 0, 0);

      let pv = 0;
      let ac = null; // null for future dates
      let ev = null; // null for future dates

      // PV is calculated for all dates (extends to future)
      try {
        pv = await calculatePV(project, currentDate);
      } catch (error) {
        logger.warn(`Error calculating PV for date ${currentDate.toISOString()}: ${error.message}`);
      }

      // AC and EV only for dates <= today
      if (currentDate.getTime() <= today.getTime()) {
        try {
          ac = await calculateAC(project, currentDate);
        } catch (error) {
          logger.warn(`Error calculating AC for date ${currentDate.toISOString()}: ${error.message}`);
        }

        try {
          ev = await calculateEV(project, currentDate);
        } catch (error) {
          logger.warn(`Error calculating EV for date ${currentDate.toISOString()}: ${error.message}`);
        }
      }

      evmDataPoints.push({
        date: currentDate.toISOString().split('T')[0],
        PV: Math.round(pv * 100) / 100,
        AC: ac !== null ? Math.round(ac * 100) / 100 : null,
        EV: ev !== null ? Math.round(ev * 100) / 100 : null,
      });
    }

    return sendSuccess(res, {
      evmDataPoints,
      plannedValueCurve: evmDataPoints.map(d => ({
        date: d.date,
        plannedValue: d.PV,
      })),
    });
  } catch (error) {
    logger.error(`Get Chart Data Error: ${error.message}`, { error });
    return sendError(res, 'Failed to fetch chart data', 500);
  }
}

/**
 * Get dashboard stats with EVM data
 * GET /api/projects/:projectId/stats
 * Query params:
 *   - summary=true: Returns only summary metrics (fast load)
 *   - chart=true: Returns only chart data (evmDataPoints)
 *   - (no params): Returns both (backward compatibility)
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { summary, chart } = req.query;
    const project = await Project.findById(projectId);

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Fast path: Return only summary metrics (6 cards)
    if (summary === 'true') {
      return await getSummaryStats(project, projectId, res);
    }

    // Chart data only: Return only evmDataPoints
    if (chart === 'true') {
      return await getChartData(project, projectId, res);
    }

    // Get project date range (from creation to 6 months ahead, or latest task deadline)
    const projectStartDate = project.createdAt || new Date();
    let projectEndDate = new Date(projectStartDate);
    projectEndDate.setMonth(projectEndDate.getMonth() + 6); // Default 6 months

    // Find latest task deadline to extend end date if needed
    const tasks = await Task.find({ projectId }).select('deadline').lean();
    if (tasks && tasks.length > 0) {
      const latestDeadline = tasks
        .map(t => t.deadline ? new Date(t.deadline) : null)
        .filter(d => d !== null)
        .sort((a, b) => b - a)[0];
      
      if (latestDeadline && latestDeadline > projectEndDate) {
        projectEndDate = latestDeadline;
      }
    }

    // Generate date range for S-Curve (daily data points, but limit to reasonable range)
    const daysDiff = Math.ceil((projectEndDate - projectStartDate) / (1000 * 60 * 60 * 24));
    // Limit to max 365 days to prevent performance issues
    const maxDays = Math.min(daysDiff, 365);
    const evmDataPoints = [];

    // Generate data points for each day (or every 7th day if more than 100 days)
    const step = maxDays > 100 ? 7 : 1;
    
    try {
      for (let i = 0; i <= maxDays; i += step) {
        const currentDate = new Date(projectStartDate);
        currentDate.setDate(projectStartDate.getDate() + i);
        currentDate.setHours(0, 0, 0, 0);

        // Calculate PV, AC, EV for this date
        let pv = 0;
        let ac = 0;
        let ev = 0;

        try {
          pv = await calculatePV(project, currentDate);
        } catch (error) {
          logger.warn(`Error calculating PV for date ${currentDate.toISOString()}: ${error.message}`);
        }

        try {
          ac = await calculateAC(project, currentDate);
        } catch (error) {
          logger.warn(`Error calculating AC for date ${currentDate.toISOString()}: ${error.message}`);
        }

        try {
          ev = await calculateEV(project, currentDate);
        } catch (error) {
          logger.warn(`Error calculating EV for date ${currentDate.toISOString()}: ${error.message}`);
        }

        evmDataPoints.push({
          date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD format
          PV: Math.round(pv * 100) / 100,
          AC: Math.round(ac * 100) / 100,
          EV: Math.round(ev * 100) / 100,
        });
      }
    } catch (error) {
      logger.error(`Error generating EVM data points: ${error.message}`, { error });
      // Return empty array if generation fails
    }

    // Get current values (today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentPV = 0;
    let currentAC = 0;
    let currentEV = 0;

    try {
      currentPV = await calculatePV(project, today);
      logger.info(`[Financial Dashboard] PV calculated: ${currentPV} (using calculatePV from evmEngine)`);
    } catch (error) {
      logger.warn(`Error calculating current PV: ${error.message}`);
    }

    try {
      currentAC = await calculateAC(project, today);
      logger.info(`[Financial Dashboard] AC calculated: ${currentAC} (using calculateAC from evmEngine)`);
    } catch (error) {
      logger.warn(`Error calculating current AC: ${error.message}`);
    }

    // Log for verification - these should match Investor Report exactly
    console.log('[Financial Dashboard] Financial Data Verification:', {
      PV: currentPV,
      AC: currentAC,
      Variance: currentAC - currentPV,
      Date: today.toISOString(),
      ProjectId: projectId,
    });

    try {
      currentEV = await calculateEV(project, today);
    } catch (error) {
      logger.warn(`Error calculating current EV: ${error.message}`);
    }

    // Calculate variances
    const scheduleVariance = currentEV - currentPV; // SV = EV - PV
    const costVariance = currentEV - currentAC; // CV = EV - AC

    // Calculate total additional funds from income transactions (type === '+')
    // This represents funds added via "Manage Funds" that increase the available budget
    const incomeTransactions = await Transaction.find({
      projectId,
      type: '+', // Income transactions
    }).lean();
    
    const totalAdditionalFunds = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Calculate Remaining Budget
    // Formula: Remaining = (PV + totalAdditionalFunds) - AC
    // PV is the baseline budget (Planned Value)
    // totalAdditionalFunds are income transactions that increase available funds
    // AC is the actual cost spent
    const remainingBudget = Math.max(0, (currentPV + totalAdditionalFunds) - currentAC);

    // Get transactions
    const transactions = await Transaction.find({ projectId })
      .populate('authorId', 'displayName')
      .sort({ date: -1 })
      .limit(10);

    // Get tasks summary
    const allTasks = await Task.find({ projectId });
    const tasksByStatus = {
      Todo: allTasks.filter(t => t.status === 'Todo').length,
      'In Progress': allTasks.filter(t => t.status === 'In Progress').length,
      Review: allTasks.filter(t => t.status === 'Review').length,
      Done: allTasks.filter(t => t.status === 'Done').length,
    };

    sendSuccess(res, {
      evmDataPoints, // Array of { date, PV, AC, EV } for S-Curve chart
      current: {
        PV: Math.round(currentPV * 100) / 100,
        AC: Math.round(currentAC * 100) / 100,
        EV: Math.round(currentEV * 100) / 100,
      },
      variances: {
        scheduleVariance: Math.round(scheduleVariance * 100) / 100, // SV = EV - PV
        costVariance: Math.round(costVariance * 100) / 100, // CV = EV - AC
      },
      budget: {
        baseline: Math.round(currentPV * 100) / 100, // PV is the baseline budget
        totalAdditionalFunds: Math.round(totalAdditionalFunds * 100) / 100, // Income from transactions
        remaining: Math.round(remainingBudget * 100) / 100, // Remaining = (PV + totalAdditionalFunds) - AC
      },
      transactions,
      tasksByStatus,
      totalTasks: allTasks.length,
      // Legacy fields for backward compatibility
      actualCost: currentAC,
      remaining: Math.round(remainingBudget * 100) / 100, // For backward compatibility
      plannedValueCurve: evmDataPoints.map(d => ({
        date: d.date,
        plannedValue: d.PV,
      })),
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


