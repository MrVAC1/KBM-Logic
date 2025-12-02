import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import Transaction from '../models/Transaction.js';
import logger from '../utils/logger.js';
import { normalizeDate, getEndOfDay } from '../utils/dateUtils.js';

/**
 * Get the effective deadline for a project
 * Priority A: project.deadline if set
 * Priority B: Latest deadline among all tasks
 * Priority C: Today or Project Start + 30 days (to avoid division by zero)
 * @param {Object} project - Project document
 * @param {Date} today - Current date (defaults to new Date())
 * @returns {Promise<Date>} - Effective deadline date
 */
export async function getEffectiveDeadline(project, today = new Date()) {
  try {
    // Priority A: Use project.deadline if set
    if (project.deadline) {
      return normalizeDate(project.deadline);
    }

    // Priority B: Find latest deadline among all tasks
    const projectId = project._id || project.id;
    const tasks = await Task.find({ projectId })
      .select('deadline')
      .lean();

    if (tasks && tasks.length > 0) {
      const taskDeadlines = tasks
        .map(t => t.deadline ? normalizeDate(t.deadline) : null)
        .filter(d => d !== null)
        .sort((a, b) => b.getTime() - a.getTime()); // Sort descending (latest first)

      if (taskDeadlines.length > 0) {
        return taskDeadlines[0]; // Return latest task deadline
      }
    }

    // Priority C: Default to Today or Project Start + 30 days (whichever is later)
    const projectStartDate = normalizeDate(project.createdAt || new Date());
    const todayNormalized = normalizeDate(today);
    const defaultDeadline = new Date(projectStartDate);
    defaultDeadline.setDate(defaultDeadline.getDate() + 30); // Add 30 days

    // Return the later of: today or project start + 30 days
    return todayNormalized.getTime() > defaultDeadline.getTime() 
      ? todayNormalized 
      : defaultDeadline;
  } catch (error) {
    logger.error(`Get Effective Deadline Error: ${error.message}`, { error });
    // Fallback: return today + 30 days
    const fallbackDate = new Date(today);
    fallbackDate.setDate(fallbackDate.getDate() + 30);
    return normalizeDate(fallbackDate);
  }
}

/**
 * Calculate daily rate for a user based on monthly salary and work schedule
 * @param {Number} monthlySalary - Monthly salary
 * @param {Object} workSchedule - Project work schedule
 * @returns {Number} - Daily rate
 */
export function calculateDailyRate(monthlySalary, workSchedule) {
  if (!monthlySalary || monthlySalary === 0) {
    return 0;
  }

  // Default work schedule if not provided or invalid
  const workingDaysPerWeek = (workSchedule && typeof workSchedule.workingDaysPerWeek === 'number') 
    ? workSchedule.workingDaysPerWeek 
    : 5;
  const daysOffPerWeek = (workSchedule && typeof workSchedule.daysOffPerWeek === 'number')
    ? workSchedule.daysOffPerWeek
    : 2;
  const hoursPerDay = (workSchedule && typeof workSchedule.hoursPerDay === 'number')
    ? workSchedule.hoursPerDay
    : 8;

  // Calculate working days per month (approx)
  // Average working days per month = (workingDaysPerWeek / 7) * 30.44
  const workingDaysPerMonth = (workingDaysPerWeek / 7) * 30.44;

  // Daily rate = Monthly Salary / Working Days per Month
  return monthlySalary / workingDaysPerMonth;
}

/**
 * Calculate hourly rate from monthly salary and work schedule
 * @param {Number} monthlySalary - Monthly salary
 * @param {Object} workSchedule - Project work schedule
 * @returns {Number} - Hourly rate
 */
export function calculateHourlyRate(monthlySalary, workSchedule) {
  if (!monthlySalary || monthlySalary === 0) {
    return 0;
  }

  // Default work schedule if not provided or invalid
  const workingDaysPerWeek = (workSchedule && typeof workSchedule.workingDaysPerWeek === 'number')
    ? workSchedule.workingDaysPerWeek
    : 5;
  const hoursPerDay = (workSchedule && typeof workSchedule.hoursPerDay === 'number')
    ? workSchedule.hoursPerDay
    : 8;

  // Calculate working hours per month using formula: (workingDaysPerWeek * 4.33) * hoursPerDay
  // 4.33 represents average weeks per month (30.44 days / 7 days per week)
  const workingHoursPerMonth = (workingDaysPerWeek * 4.33) * hoursPerDay;

  // Hourly rate = Monthly Salary / Working Hours per Month
  return monthlySalary / workingHoursPerMonth;
}

/**
 * Calculate Planned Value (PV) for a specific date
 * PV represents the budgeted cost of work scheduled to be completed by a given date
 * OPTIMIZED: Uses cached snapshots for historical dates to avoid recalculation
 * @param {Object} project - Project document
 * @param {Date} date - Target date
 * @param {Date} [startDate] - Optional start date for time range filtering (only include tasks that start >= startDate)
 * @returns {Number} - Planned Value
 */
export async function calculatePV(project, date, startDate = null) {
  try {
    // OPTIMIZATION: Check snapshots first for historical dates (date < today)
    const today = normalizeDate(new Date());
    const targetDate = normalizeDate(date);
    
    // Only use snapshots for historical dates (not today or future)
    if (targetDate.getTime() < today.getTime() && project.evmSnapshots && project.evmSnapshots.length > 0) {
      // Find snapshot for this exact date
      const snapshot = project.evmSnapshots.find(s => {
        if (!s.date) return false;
        const snapshotDate = normalizeDate(s.date);
        return snapshotDate.getTime() === targetDate.getTime();
      });
      
      if (snapshot && snapshot.plannedValue !== undefined && snapshot.plannedValue !== null) {
        logger.debug(`[PV Cache Hit] Using snapshot for ${targetDate.toISOString()}: ${snapshot.plannedValue}`);
        return snapshot.plannedValue;
      }
    }
    
    // If no snapshot found or date is today/future, calculate normally
    logger.debug(`[PV Cache Miss] Calculating PV for ${targetDate.toISOString()}`);
    
    const projectId = project._id || project.id;
    const tasks = await Task.find({ projectId })
      .populate('assignees', 'monthlySalary')
      .lean();

    let totalPV = 0;

    // Get project deadline for fallback
    const projectStartDate = normalizeDate(project.createdAt || new Date());
    const projectDeadline = project.deadline ? normalizeDate(project.deadline) : null;
    
    // Get effective deadline for tasks without deadlines
    const effectiveDeadline = await getEffectiveDeadline(project, date);
    
    // If startDate is provided, normalize it for comparison
    const periodStartDate = startDate ? normalizeDate(startDate) : null;

    for (const task of tasks) {
      // Skip tasks without estimateHours
      if (!task.estimateHours || task.estimateHours === 0) {
        continue;
      }

      // Use project deadline as fallback if task doesn't have a deadline
      // If no project deadline, use effective deadline (latest task or default)
      let taskDeadline = null;
      if (task.deadline) {
        taskDeadline = normalizeDate(task.deadline);
      } else if (projectDeadline) {
        taskDeadline = projectDeadline;
      } else {
        // Use effective deadline (latest task deadline or default)
        taskDeadline = effectiveDeadline;
      }

      // Use project start date as fallback if task doesn't have startDate
      let taskStartDate = null;
      if (task.startDate) {
        taskStartDate = normalizeDate(task.startDate);
      } else {
        taskStartDate = projectStartDate;
      }

      // If periodStartDate is provided, skip tasks that start before the period
      if (periodStartDate && taskStartDate.getTime() < periodStartDate.getTime()) {
        // Task started before period, but might have work during the period
        // Only include if task deadline is within the period
        if (taskDeadline.getTime() < periodStartDate.getTime()) {
          continue; // Task completed before period, skip entirely
        }
        // Task started before period but extends into period - adjust startDate to periodStartDate
        taskStartDate = periodStartDate;
      }

      const startDate = taskStartDate;
      const deadline = taskDeadline;
      // Use end of day to include all work scheduled for the target date
      const targetDate = getEndOfDay(date);

      // Skip if date is before task starts (compare with start of day for task start)
      if (targetDate.getTime() < startDate.getTime()) {
        continue;
      }

      // Calculate task budget based on assignees
      let taskBudget = 0;
      
      if (task.assignees && task.assignees.length > 0) {
        // Calculate average hourly rate from assignees
        let totalHourlyRate = 0;
        let assigneesCount = 0;

        for (const assignee of task.assignees) {
          const user = assignee;
          if (user && user.monthlySalary && user.monthlySalary > 0) {
            const hourlyRate = calculateHourlyRate(user.monthlySalary, project.workSchedule);
            totalHourlyRate += hourlyRate;
            assigneesCount++;
          }
        }

        if (assigneesCount > 0) {
          const averageHourlyRate = totalHourlyRate / assigneesCount;
          taskBudget = task.estimateHours * averageHourlyRate;
        }
      }

      // If task is fully completed by this date, add full budget
      if (targetDate.getTime() >= deadline.getTime()) {
        totalPV += taskBudget;
      } else {
        // Calculate linear daily portion (using normalized dates)
        const taskDuration = Math.max(1, Math.ceil((deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))); // Days
        const daysSinceStart = Math.max(0, Math.ceil((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))); // Days
        const dailyPortion = taskBudget / taskDuration;
        const partialPV = Math.min(taskBudget, dailyPortion * daysSinceStart);
        totalPV += partialPV;
      }
    }

    return totalPV;
  } catch (error) {
    logger.error(`Calculate PV Error: ${error.message}`, { error });
    return 0;
  }
}

/**
 * Calculate Earned Value (EV) for a specific date
 * EV represents the budgeted cost of work actually completed by a given date
 * OPTIMIZED: Uses cached snapshots for historical dates to avoid recalculation
 * @param {Object} project - Project document
 * @param {Date} date - Target date
 * @param {Date} [startDate] - Optional start date for time range filtering (only include tasks completed >= startDate)
 * @returns {Number} - Earned Value
 */
export async function calculateEV(project, date, startDate = null) {
  try {
    // OPTIMIZATION: Check snapshots first for historical dates (date < today)
    const today = normalizeDate(new Date());
    const targetDate = normalizeDate(date);
    
    // Only use snapshots for historical dates (not today or future)
    if (targetDate.getTime() < today.getTime() && project.evmSnapshots && project.evmSnapshots.length > 0) {
      // Find snapshot for this exact date
      const snapshot = project.evmSnapshots.find(s => {
        if (!s.date) return false;
        const snapshotDate = normalizeDate(s.date);
        return snapshotDate.getTime() === targetDate.getTime();
      });
      
      if (snapshot && snapshot.earnedValue !== undefined && snapshot.earnedValue !== null) {
        logger.debug(`[EV Cache Hit] Using snapshot for ${targetDate.toISOString()}: ${snapshot.earnedValue}`);
        return snapshot.earnedValue;
      }
    }
    
    // If no snapshot found or date is today/future, calculate normally
    logger.debug(`[EV Cache Miss] Calculating EV for ${targetDate.toISOString()}`);
    
    const projectId = project._id || project.id;
    
    // Use end of day to include all tasks completed during the target date
    // If date is Dec 2nd, we want to include tasks completed at any time on Dec 2nd
    const endOfTargetDay = getEndOfDay(date);
    
    // Build query filter
    const queryFilter = {
      projectId,
      status: 'Done',
      updatedAt: { $lte: endOfTargetDay }, // Completed before or during the target date (inclusive)
    };
    
    // If startDate is provided, only include tasks completed on or after startDate
    if (startDate) {
      const startOfPeriod = normalizeDate(startDate);
      queryFilter.updatedAt.$gte = startOfPeriod; // Add lower bound
    }
    
    // Get all completed tasks that match the filter
    const completedTasks = await Task.find(queryFilter)
      .populate('assignees', 'monthlySalary')
      .lean();

    let totalEV = 0;

    for (const task of completedTasks) {
      // Skip tasks without estimateHours
      if (!task.estimateHours || task.estimateHours === 0) {
        continue;
      }

      // Calculate task budget based on assignees
      let taskBudget = 0;
      
      if (task.assignees && task.assignees.length > 0) {
        // Calculate average hourly rate from assignees
        let totalHourlyRate = 0;
        let assigneesCount = 0;

        for (const assignee of task.assignees) {
          const user = assignee;
          if (user && user.monthlySalary && user.monthlySalary > 0) {
            const hourlyRate = calculateHourlyRate(user.monthlySalary, project.workSchedule);
            totalHourlyRate += hourlyRate;
            assigneesCount++;
          }
        }

        if (assigneesCount > 0) {
          const averageHourlyRate = totalHourlyRate / assigneesCount;
          taskBudget = task.estimateHours * averageHourlyRate;
        }
      }

      totalEV += taskBudget;
    }

    return totalEV;
  } catch (error) {
    logger.error(`Calculate EV Error: ${error.message}`, { error });
    return 0;
  }
}

/**
 * Calculate Actual Cost (AC) for a specific date
 * AC represents the actual cost incurred for work performed by a given date
 * @param {Object} project - Project document
 * @param {Date} date - Target date
 * @param {Date} [startDate] - Optional start date for time range filtering (only include costs from >= startDate)
 * @returns {Number} - Actual Cost
 */
export async function calculateAC(project, date, startDate = null) {
  try {
    const projectId = project._id || project.id;

    // Use end of day to include all costs incurred during the target date
    const targetDate = getEndOfDay(date);
    
    // If startDate is provided, normalize it for comparison
    const periodStartDate = startDate ? normalizeDate(startDate) : null;

    // OPTIMIZATION: Check snapshots first for historical dates (date < today)
    const today = normalizeDate(new Date());
    const normalizedTargetDate = normalizeDate(date);
    
    // Only use snapshots for historical dates (not today or future)
    if (normalizedTargetDate.getTime() < today.getTime() && project.evmSnapshots && project.evmSnapshots.length > 0) {
      // First, try to find exact snapshot for this date
      const exactSnapshot = project.evmSnapshots.find(s => {
        if (!s.date) return false;
        const snapshotDate = normalizeDate(s.date);
        return snapshotDate.getTime() === normalizedTargetDate.getTime();
      });
      
      if (exactSnapshot && exactSnapshot.actualCost !== undefined && exactSnapshot.actualCost !== null) {
        logger.debug(`[AC Cache Hit] Using exact snapshot for ${normalizedTargetDate.toISOString()}: ${exactSnapshot.actualCost}`);
        
        // If periodStartDate is provided, we need to calculate the difference
        if (periodStartDate) {
          const periodStart = normalizeDate(periodStartDate);
          // Find snapshot at period start (or closest before)
          const periodStartSnapshot = project.evmSnapshots
            .filter(s => {
              if (!s.date) return false;
              const snapshotDate = normalizeDate(s.date);
              return snapshotDate.getTime() <= periodStart.getTime();
            })
            .sort((a, b) => normalizeDate(b.date).getTime() - normalizeDate(a.date).getTime())[0];
          
          if (periodStartSnapshot && periodStartSnapshot.actualCost !== undefined) {
            // Return difference between target date AC and period start AC
            return Math.max(0, exactSnapshot.actualCost - periodStartSnapshot.actualCost);
          }
        }
        
        return exactSnapshot.actualCost || 0;
      }
      
      // If no exact snapshot, find latest snapshot before or on target date
      const snapshotsUpToDate = project.evmSnapshots.filter(
        snapshot => {
          try {
            const snapshotDate = normalizeDate(snapshot.date);
            return snapshotDate.getTime() <= normalizedTargetDate.getTime();
          } catch (error) {
            logger.warn(`Error normalizing snapshot date: ${error.message}`);
            return false;
          }
        }
      );

      if (snapshotsUpToDate.length > 0) {
        // Get the latest snapshot before or on the target date
        const latestSnapshot = snapshotsUpToDate[snapshotsUpToDate.length - 1];
        logger.debug(`[AC Cache Hit] Using latest snapshot for ${normalizedTargetDate.toISOString()}: ${latestSnapshot.actualCost}`);
        
        // If periodStartDate is provided, calculate the difference
        if (periodStartDate) {
          const periodStart = normalizeDate(periodStartDate);
          const periodStartSnapshot = project.evmSnapshots
            .filter(s => {
              if (!s.date) return false;
              const snapshotDate = normalizeDate(s.date);
              return snapshotDate.getTime() <= periodStart.getTime();
            })
            .sort((a, b) => normalizeDate(b.date).getTime() - normalizeDate(a.date).getTime())[0];
          
          if (periodStartSnapshot && periodStartSnapshot.actualCost !== undefined) {
            return Math.max(0, latestSnapshot.actualCost - periodStartSnapshot.actualCost);
          }
        }
        
        return latestSnapshot.actualCost || 0;
      }
    }
    
    // If no snapshot found or date is today/future, calculate normally
    logger.debug(`[AC Cache Miss] Calculating AC for ${normalizedTargetDate.toISOString()}`);

    // If no snapshots, calculate from project start date or period start date
    // Normalize dates to prevent timezone/off-by-one-day errors
    const projectStartDate = normalizeDate(project.createdAt || new Date());
    // Use periodStartDate if provided, otherwise use projectStartDate
    const calculationStartDate = periodStartDate || projectStartDate;
    
    // Calculate daily costs from salaries and expenses
    let totalAC = 0;

    // Get all active members with salaries
    const activeMembers = project.members || [];
    
    for (const member of activeMembers) {
      const user = await User.findById(member.userId);
      if (user && user.monthlySalary && user.monthlySalary > 0) {
        const dailyRate = calculateDailyRate(user.monthlySalary, project.workSchedule);
        
        // Calculate days from calculation start date to target date
        // If periodStartDate is provided, only count days within the period
        const memberStartDate = normalizeDate(member.joinedAt || projectStartDate);
        const effectiveStartDate = periodStartDate && periodStartDate.getTime() > memberStartDate.getTime() 
          ? periodStartDate 
          : memberStartDate;
        
        const daysSinceStart = Math.max(0, Math.ceil((targetDate.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24)));
        totalAC += dailyRate * daysSinceStart;
      }
    }

    // Add monthly expenses (adjusted for frequency) from Expense collection
    const expenses = await Expense.find({ projectId }).lean();
    for (const expense of expenses) {
      const expenseStartDate = normalizeDate(expense.createdAt || projectStartDate);
      // Use the later of expenseStartDate or periodStartDate
      const effectiveExpenseStartDate = periodStartDate && periodStartDate.getTime() > expenseStartDate.getTime()
        ? periodStartDate
        : expenseStartDate;
      
      if (targetDate.getTime() >= effectiveExpenseStartDate.getTime()) {
        const daysSinceExpenseStart = Math.max(0, Math.ceil((targetDate.getTime() - effectiveExpenseStartDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        let expenseCost = 0;
        switch (expense.frequency) {
          case 'daily':
            expenseCost = expense.amount * daysSinceExpenseStart;
            break;
          case 'weekly':
            expenseCost = expense.amount * Math.ceil(daysSinceExpenseStart / 7);
            break;
          case 'monthly':
            expenseCost = expense.amount * Math.ceil(daysSinceExpenseStart / 30.44);
            break;
          case 'yearly':
            expenseCost = expense.amount * Math.ceil(daysSinceExpenseStart / 365);
            break;
          default:
            expenseCost = expense.amount * Math.ceil(daysSinceExpenseStart / 30.44); // Default to monthly
        }
        totalAC += expenseCost;
      }
    }

    // Add fixed costs from project.fixedCosts array (Settings -> Costs)
    if (project.fixedCosts && Array.isArray(project.fixedCosts) && project.fixedCosts.length > 0) {
      for (const fixedCost of project.fixedCosts) {
        // Validate fixedCost structure
        if (!fixedCost || typeof fixedCost !== 'object') {
          logger.warn(`Invalid fixedCost structure: ${JSON.stringify(fixedCost)}`);
          continue;
        }
        
        // Validate amount
        const amount = typeof fixedCost.amount === 'number' ? fixedCost.amount : 0;
        if (amount <= 0) {
          continue; // Skip invalid amounts
        }
        
        const fixedCostStartDate = normalizeDate(projectStartDate);
        // Use the later of fixedCostStartDate or periodStartDate
        const effectiveFixedCostStartDate = periodStartDate && periodStartDate.getTime() > fixedCostStartDate.getTime()
          ? periodStartDate
          : fixedCostStartDate;
        
        if (targetDate.getTime() >= effectiveFixedCostStartDate.getTime()) {
          const daysSinceStart = Math.max(0, Math.ceil((targetDate.getTime() - effectiveFixedCostStartDate.getTime()) / (1000 * 60 * 60 * 24)));
          
          let fixedCostAmount = 0;
          const frequency = fixedCost.frequency || 'monthly'; // Default to monthly if not specified
          
          switch (frequency) {
            case 'daily':
              fixedCostAmount = amount * daysSinceStart;
              break;
            case 'weekly':
              fixedCostAmount = amount * Math.ceil(daysSinceStart / 7);
              break;
            case 'monthly':
              fixedCostAmount = amount * Math.ceil(daysSinceStart / 30.44);
              break;
            case 'yearly':
              fixedCostAmount = amount * Math.ceil(daysSinceStart / 365);
              break;
            case 'one-time':
              // One-time cost applied once if date is after project start
              fixedCostAmount = amount;
              break;
            default:
              fixedCostAmount = amount * Math.ceil(daysSinceStart / 30.44); // Default to monthly
          }
          totalAC += fixedCostAmount;
        }
      }
    }

    // Add manual transactions (from "Manage Funds")
    // Only include expense transactions (type === '-') that occurred before or on target date
    const transactions = await Transaction.find({
      projectId,
      type: '-', // Only expenses increase AC
      date: { $lte: targetDate }, // Transaction date must be <= target date
    }).lean();

    // If periodStartDate is provided, only include transactions on or after the period start
    if (periodStartDate) {
      for (const transaction of transactions) {
        const transactionDate = normalizeDate(transaction.date);
        if (transactionDate.getTime() >= periodStartDate.getTime()) {
          totalAC += transaction.amount || 0;
        }
      }
    } else {
      // Sum all expense transactions up to target date
      for (const transaction of transactions) {
        totalAC += transaction.amount || 0;
      }
    }

    return totalAC;
  } catch (error) {
    logger.error(`Calculate AC Error: ${error.message}`, { error });
    return 0;
  }
}

/**
 * Calculate daily actual cost for all active members
 * This is called daily by the cron job
 * @param {String} projectId - Project ID
 * @param {Date} date - Date for which to calculate (defaults to today)
 * @returns {Promise<Number>} - Daily cost
 */
export async function calculateDailyActualCost(projectId, date = new Date()) {
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Set date to start of day (00:00:00)
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    let dailyCost = 0;

    // Calculate daily salary costs from active members
    const activeMembers = project.members || [];
    for (const member of activeMembers) {
      const user = await User.findById(member.userId);
      if (user && user.monthlySalary && user.monthlySalary > 0) {
        const dailyRate = calculateDailyRate(user.monthlySalary, project.workSchedule);
        dailyCost += dailyRate;
      }
    }

    // Calculate daily expenses (convert all to daily equivalent) from Expense collection
    const expenses = await Expense.find({ projectId }).lean();
    for (const expense of expenses) {
      const expenseStartDate = new Date(expense.createdAt);
      expenseStartDate.setHours(0, 0, 0, 0);
      
      if (targetDate >= expenseStartDate) {
        let dailyExpenseAmount = 0;
        switch (expense.frequency) {
          case 'daily':
            dailyExpenseAmount = expense.amount;
            break;
          case 'weekly':
            dailyExpenseAmount = expense.amount / 7;
            break;
          case 'monthly':
            dailyExpenseAmount = expense.amount / 30.44;
            break;
          case 'yearly':
            dailyExpenseAmount = expense.amount / 365;
            break;
          default:
            dailyExpenseAmount = expense.amount / 30.44; // Default to monthly
        }
        dailyCost += dailyExpenseAmount;
      }
    }

    // Add daily fixed costs from project.fixedCosts array (Settings -> Costs)
    if (project.fixedCosts && Array.isArray(project.fixedCosts) && project.fixedCosts.length > 0) {
      for (const fixedCost of project.fixedCosts) {
        const fixedCostStartDate = new Date(project.createdAt);
        fixedCostStartDate.setHours(0, 0, 0, 0);
        
        if (targetDate >= fixedCostStartDate) {
          let dailyFixedCostAmount = 0;
          switch (fixedCost.frequency) {
            case 'daily':
              dailyFixedCostAmount = fixedCost.amount;
              break;
            case 'weekly':
              dailyFixedCostAmount = fixedCost.amount / 7;
              break;
            case 'monthly':
              dailyFixedCostAmount = fixedCost.amount / 30.44;
              break;
            case 'yearly':
              dailyFixedCostAmount = fixedCost.amount / 365;
              break;
            case 'one-time':
              // One-time costs are not included in daily calculation
              // They are applied once when the project starts
              dailyFixedCostAmount = 0;
              break;
            default:
              dailyFixedCostAmount = fixedCost.amount / 30.44; // Default to monthly
          }
          dailyCost += dailyFixedCostAmount;
        }
      }
    }

    // Initialize evmSnapshots if not exists
    if (!project.evmSnapshots) {
      project.evmSnapshots = [];
    }

    // Get previous AC from latest snapshot or use cumulativeActualCost
    let previousAC = project.cumulativeActualCost || 0;
    if (project.evmSnapshots && project.evmSnapshots.length > 0) {
      const latestSnapshot = project.evmSnapshots[project.evmSnapshots.length - 1];
      if (latestSnapshot && latestSnapshot.actualCost !== undefined) {
        previousAC = latestSnapshot.actualCost;
      }
    }

    // Calculate new cumulative AC
    const newAC = previousAC + dailyCost;

    // Initialize evmSnapshots array if it doesn't exist
    if (!project.evmSnapshots) {
      project.evmSnapshots = [];
    }

    // Create or update snapshot for this date
    const snapshotIndex = project.evmSnapshots.findIndex(
      s => s.date && new Date(s.date).toDateString() === targetDate.toDateString()
    );

    // Calculate PV and EV for this date
    const pv = await calculatePV(project, targetDate);
    const ev = await calculateEV(project, targetDate);

    if (snapshotIndex >= 0) {
      // Update existing snapshot
      project.evmSnapshots[snapshotIndex] = {
        date: targetDate,
        plannedValue: pv,
        actualCost: newAC,
        earnedValue: ev,
      };
    } else {
      // Add new snapshot
      project.evmSnapshots.push({
        date: targetDate,
        plannedValue: pv,
        actualCost: newAC,
        earnedValue: ev,
      });
    }

    // Update cumulative AC
    project.cumulativeActualCost = newAC;

    await project.save();

    logger.info(`Daily AC calculated for project ${projectId}: ${dailyCost}, Total AC: ${newAC}`);
    return dailyCost;
  } catch (error) {
    logger.error(`Calculate Daily AC Error: ${error.message}`, { error });
    throw error;
  }
}

