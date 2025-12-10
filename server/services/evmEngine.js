import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Expense from '../models/Expense.js';
import Transaction from '../models/Transaction.js';
import logger from '../utils/logger.js';
import { normalizeDate, getEndOfDay } from '../utils/dateUtils.js';

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
// PHASE 3: Removed hardcoded WORKING_DAYS_PER_MONTH - now calculated dynamically

function getWorkingDaySet(workSchedule) {
  const days = Array.isArray(workSchedule?.workingDays) && workSchedule.workingDays.length > 0
    ? workSchedule.workingDays
    : DEFAULT_WORKING_DAYS;
  return new Set(days);
}

export function isWorkingDay(date, workSchedule) {
  const dayOfWeek = normalizeDate(date).getDay(); // 0=Sun..6=Sat
  return getWorkingDaySet(workSchedule).has(dayOfWeek);
}

export function countWorkingDaysInclusive(startDate, endDate, workSchedule) {
  if (!startDate || !endDate) return 0;
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (end.getTime() < start.getTime()) return 0;

  let current = new Date(start);
  let workingDays = 0;
  const workingDaySet = getWorkingDaySet(workSchedule);

  while (current.getTime() <= end.getTime()) {
    if (workingDaySet.has(current.getDay())) {
      workingDays += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

/**
 * Calculate working days per month dynamically based on work schedule
 * PHASE 3 FIX: No hardcoded 21 days - calculates based on project settings
 * @param {Object} workSchedule - Project work schedule
 * @returns {Number} - Working days per month
 */
function calculateWorkingDaysPerMonth(workSchedule) {
  const workingDaysCount = Array.isArray(workSchedule?.workingDays) && workSchedule.workingDays.length > 0
    ? workSchedule.workingDays.length
    : 5; // Default Mon-Fri
  
  // Calculate working days per month: (workingDaysCount / 7) * average days per month
  // Average days per month = 365.25 / 12 = 30.4375
  return (workingDaysCount / 7) * 30.4375;
}

function roleMonthlyRateToHourly(monthlyRate, workSchedule) {
  if (!monthlyRate || monthlyRate <= 0) return 0;
  const hoursPerDay = workSchedule?.hoursPerDay || 8;
  const workingDaysPerMonth = calculateWorkingDaysPerMonth(workSchedule);
  const hoursPerMonth = hoursPerDay * workingDaysPerMonth;
  return hoursPerMonth > 0 ? monthlyRate / hoursPerMonth : 0;
}

function resolveMemberRoleName(member) {
  if (!member) return null;
  if (member.roleName) return member.roleName;
  if (Array.isArray(member.roles) && member.roles.length > 0) return member.roles[0];
  return null;
}

export function resolveRoleRateForDate(project, roleName, targetDate = new Date()) {
  if (!roleName) return 0;
  const role = (project.roles || []).find(r => r.name === roleName);
  if (!role) return 0;

  const timeline = Array.isArray(role.salaryHistory) ? [...role.salaryHistory] : [];
  if (role.currentRate !== undefined) {
    timeline.push({
      rate: role.currentRate,
      effectiveDate: role.currentRateEffectiveDate || role.updatedAt || role.createdAt || new Date(),
    });
  }

  const sorted = timeline
    .filter(entry => entry && entry.rate !== undefined)
    .sort((a, b) => new Date(a.effectiveDate || 0) - new Date(b.effectiveDate || 0));

  let rate = role.currentRate || 0;
  const normalizedTarget = normalizeDate(targetDate);
  for (const entry of sorted) {
    const entryDate = normalizeDate(entry.effectiveDate || new Date(0));
    if (entryDate.getTime() <= normalizedTarget.getTime()) {
      rate = entry.rate;
    }
  }

  return rate || 0;
}

function averageHourlyRoleRate(project, assigneeIds, referenceDate) {
  if (!assigneeIds || assigneeIds.length === 0) return 0;
  const members = project.members || [];
  const hourlyRates = [];

  for (const assigneeId of assigneeIds) {
    const member = members.find(m =>
      m.userId && (m.userId.toString() === assigneeId.toString() || m.userId._id?.toString() === assigneeId.toString())
    );
    const roleName = resolveMemberRoleName(member);
    if (!roleName) continue;

    const monthlyRate = resolveRoleRateForDate(project, roleName, referenceDate);
    const hourlyRate = roleMonthlyRateToHourly(monthlyRate, project.workSchedule);
    if (hourlyRate > 0) {
      hourlyRates.push(hourlyRate);
    }
  }

  if (hourlyRates.length === 0) return 0;
  return hourlyRates.reduce((sum, rate) => sum + rate, 0) / hourlyRates.length;
}

/**
 * Calculate task budget based on EFFORT (estimateHours), not duration
 * StartDate and Deadline are used ONLY for timeline distribution, not for calculating total PV
 * @param {Object} project - Project document
 * @param {Object} task - Task document
 * @param {Date} referenceDate - Reference date for rate resolution
 * @returns {Object} - { plannedValue, effortHours, avgHourlyRate, startDate, deadline }
 */
function calculateTaskBudget(project, task, referenceDate = new Date()) {
  // PHASE 1 FIX: Use estimateHours (EFFORT) directly, not duration
  const effortHours = task.estimateHours || 0;
  
  if (effortHours <= 0) {
    // If estimateHours is missing or 0, return 0 PV (do NOT fallback to duration)
    const taskId = task._id ? task._id.toString() : 'unknown';
    logger.warn(`Task ${taskId} has missing or zero estimateHours. PV will be 0.`);
    return {
      plannedValue: 0,
      effortHours: 0,
      avgHourlyRate: 0,
      startDate: task.startDate ? normalizeDate(task.startDate) : null,
      deadline: task.deadline ? normalizeDate(task.deadline) : null,
    };
  }

  const startDate = task.startDate ? normalizeDate(task.startDate) : null;
  const deadline = task.deadline ? normalizeDate(task.deadline) : null;

  // Get average hourly rate for assignees
  const avgHourlyRate = averageHourlyRoleRate(project, task.assignees || [], referenceDate || deadline || startDate || new Date());
  
  // PHASE 1 FIX: PV = Effort × Rate (not Duration × Rate)
  const plannedValue = effortHours * avgHourlyRate;

  return {
    plannedValue,
    effortHours, // Renamed from durationHours to reflect it's effort-based
    avgHourlyRate,
    startDate,
    deadline,
  };
}

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

  // PHASE 3 FIX: Use dynamic calculation instead of hardcoded value
  const workingDaysPerMonth = calculateWorkingDaysPerMonth(workSchedule);
  return workingDaysPerMonth > 0 ? monthlySalary / workingDaysPerMonth : 0;
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

  const workingDaysCount = Array.isArray(workSchedule?.workingDays) && workSchedule.workingDays.length > 0
    ? workSchedule.workingDays.length
    : 5;
  const hoursPerDay = (workSchedule && typeof workSchedule.hoursPerDay === 'number')
    ? workSchedule.hoursPerDay
    : 8;

  // Approximate working hours per month
  const workingHoursPerMonth = (workingDaysCount / 7) * 30.44 * hoursPerDay;
  return workingHoursPerMonth > 0 ? monthlySalary / workingHoursPerMonth : 0;
}

/**
 * Calculate Budget at Completion (BAC) - Total PV of all tasks
 * PHASE 2: BAC represents the total cost baseline (sum of all task PVs)
 * @param {Object} project - Project document
 * @returns {Promise<Number>} - Budget at Completion
 */
export async function calculateBAC(project) {
  try {
    if (!project) {
      logger.warn('calculateBAC: project is null or undefined');
      return 0;
    }
    
    const projectId = project._id || project.id;
    if (!projectId) {
      logger.warn('calculateBAC: projectId is missing');
      return 0;
    }
    
    const tasks = await Task.find({ projectId }).lean();
    
    let totalBAC = 0;
    for (const task of tasks) {
      try {
        const budget = calculateTaskBudget(project, task, new Date());
        totalBAC += budget.plannedValue || 0;
      } catch (taskError) {
        logger.warn(`Error calculating budget for task ${task._id}: ${taskError.message}`);
        // Continue with other tasks
      }
    }
    
    return totalBAC;
  } catch (error) {
    logger.error(`Calculate BAC Error: ${error.message}`, { error, projectId: project?._id || project?.id });
    return 0;
  }
}

/**
 * Calculate Planned Value (PV) for a specific date
 * PV represents the budgeted cost of work scheduled to be completed by a given date
 * PHASE 1 FIX: Uses EFFORT (estimateHours) for total, distributes linearly across timeline
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
    const tasks = await Task.find({ projectId }).lean();

    let totalPV = 0;

    // Get project deadline for fallback
    const projectStartDate = normalizeDate(project.createdAt || new Date());
    const projectDeadline = project.deadline ? normalizeDate(project.deadline) : null;
    
    // Get effective deadline for tasks without deadlines
    const effectiveDeadline = await getEffectiveDeadline(project, date);
    
    // If startDate is provided, normalize it for comparison
    const periodStartDate = startDate ? normalizeDate(startDate) : null;

    for (const task of tasks) {
      const budget = calculateTaskBudget(project, task, date);
      const targetDate = getEndOfDay(date);

      const taskDeadline = task.deadline ? normalizeDate(task.deadline) : (projectDeadline || effectiveDeadline);
      const taskStartDate = task.startDate ? normalizeDate(task.startDate) : projectStartDate;

      // If periodStartDate is provided, adjust taskStartDate to the period window
      const adjustedStart = (periodStartDate && taskStartDate.getTime() < periodStartDate.getTime())
        ? periodStartDate
        : taskStartDate;

      // Skip if task finishes before period starts
      if (periodStartDate && taskDeadline.getTime() < periodStartDate.getTime()) {
        continue;
      }

      // Skip if target date is before task starts
      if (targetDate.getTime() < adjustedStart.getTime()) {
        continue;
      }

      // PHASE 1 FIX: Use StartDate/Deadline ONLY for timeline distribution
      // The total PV is already effort-based (estimateHours × Rate)
      // We distribute this total linearly across the timeline
      const totalWorkingDays = Math.max(1, countWorkingDaysInclusive(adjustedStart, taskDeadline, project.workSchedule));
      const workedDaysUntilTarget = countWorkingDaysInclusive(adjustedStart, targetDate < taskDeadline ? targetDate : taskDeadline, project.workSchedule);
      const completionRatio = Math.min(1, workedDaysUntilTarget / totalWorkingDays);

      // Distribute the effort-based PV across the timeline
      totalPV += budget.plannedValue * completionRatio;
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
    const completedTasks = await Task.find(queryFilter).lean();

    let totalEV = 0;

    for (const task of completedTasks) {
      const budget = calculateTaskBudget(project, task, task.updatedAt || date);
      const taskEV = budget.plannedValue;
      
      // Debug logging for zero EV cases
      if (taskEV === 0) {
        const effectiveRate = budget.avgHourlyRate || 0;
        logger.warn(`[EVM Warning] Task "${task.title}" (ID: ${task._id}) has 0 EV. Reason: Estimate=${task.estimateHours || 0}, Rate=${effectiveRate}, PlannedValue=${taskEV}`);
      }
      
      totalEV += taskEV;
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

    // Get all active members with role-based rates (schedule-aware)
    const activeMembers = project.members || [];
    const normalizedTargetDay = normalizeDate(targetDate);

    for (const member of activeMembers) {
      const roleName = resolveMemberRoleName(member);
      if (!roleName) {
        continue;
      }

      const role = (project.roles || []).find(r => r.name === roleName);
      if (!role) {
        continue;
      }

      const memberStartDate = normalizeDate(member.joinedAt || projectStartDate);
      const effectiveStartDate = periodStartDate && periodStartDate.getTime() > memberStartDate.getTime()
        ? periodStartDate
        : memberStartDate;

      if (effectiveStartDate.getTime() > normalizedTargetDay.getTime()) {
        continue;
      }

      const timeline = Array.isArray(role.salaryHistory) ? [...role.salaryHistory] : [];
      if (role.currentRate !== undefined) {
        timeline.push({
          rate: role.currentRate,
          effectiveDate: role.currentRateEffectiveDate || role.updatedAt || role.createdAt || new Date(),
        });
      }

      const sortedTimeline = timeline
        .filter(entry => entry && entry.rate !== undefined)
        .sort((a, b) => new Date(a.effectiveDate || 0) - new Date(b.effectiveDate || 0));

      for (let i = 0; i < sortedTimeline.length; i++) {
        const entry = sortedTimeline[i];
        const entryStart = normalizeDate(entry.effectiveDate || projectStartDate);
        const nextEntry = sortedTimeline[i + 1];
        // End date is the day before the next entry starts, or the target date
        const entryEnd = nextEntry
          ? normalizeDate(nextEntry.effectiveDate || normalizedTargetDay)
          : normalizedTargetDay;
        const inclusiveEnd = entryEnd.getTime() > normalizedTargetDay.getTime()
          ? normalizedTargetDay
          : new Date(entryEnd.getTime() - 1);

        const windowStart = entryStart.getTime() < effectiveStartDate.getTime()
          ? effectiveStartDate
          : entryStart;

        if (windowStart.getTime() > normalizedTargetDay.getTime() || inclusiveEnd.getTime() < windowStart.getTime()) {
          continue;
        }

        const workingDays = countWorkingDaysInclusive(windowStart, inclusiveEnd, project.workSchedule);
        // PHASE 3 FIX: Use dynamic calculation instead of hardcoded WORKING_DAYS_PER_MONTH
        const workingDaysPerMonth = calculateWorkingDaysPerMonth(project.workSchedule);
        const dailyRate = (entry.rate || 0) / workingDaysPerMonth;
        totalAC += workingDays * dailyRate;
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
      $or: [
        { effectiveDate: { $lte: targetDate } },
        { effectiveDate: { $exists: false }, date: { $lte: targetDate } },
      ],
    }).lean();

    // If periodStartDate is provided, only include transactions on or after the period start
    if (periodStartDate) {
      for (const transaction of transactions) {
        const transactionDate = normalizeDate(transaction.effectiveDate || transaction.date);
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
    const isWorkDayFlag = isWorkingDay(targetDate, project.workSchedule);

    // Calculate daily salary costs from active members (only on working days)
    if (isWorkDayFlag) {
      const activeMembers = project.members || [];
      for (const member of activeMembers) {
        const roleName = resolveMemberRoleName(member);
        if (!roleName) continue;
        const monthlyRate = resolveRoleRateForDate(project, roleName, targetDate);
        // PHASE 3 FIX: Use dynamic calculation instead of hardcoded WORKING_DAYS_PER_MONTH
        const workingDaysPerMonth = calculateWorkingDaysPerMonth(project.workSchedule);
        const dailyRate = monthlyRate / workingDaysPerMonth;
        if (dailyRate > 0) {
          dailyCost += dailyRate;
        }
      }
    }

    // Daily expenses (frequency-based) from Expense collection
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
              dailyFixedCostAmount = 0;
              break;
            default:
              dailyFixedCostAmount = fixedCost.amount / 30.44; // Default to monthly
          }
          dailyCost += dailyFixedCostAmount;
        }
      }
    }

    // Add negative transactions effective on this date
    const dayStart = normalizeDate(targetDate);
    const dayEnd = getEndOfDay(targetDate);
    const dayTransactions = await Transaction.find({
      projectId,
      type: '-',
      $or: [
        { effectiveDate: { $gte: dayStart, $lte: dayEnd } },
        { effectiveDate: { $exists: false }, date: { $gte: dayStart, $lte: dayEnd } },
      ],
    }).lean();
    for (const txn of dayTransactions) {
      dailyCost += txn.amount || 0;
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

/**
 * Calculate Project Funds (Cash) - Income minus Non-Salary Expenses
 * PHASE 2: Separates Cash Flow from Budget (BAC)
 * @param {String} projectId - Project ID
 * @returns {Promise<Number>} - Available project funds
 */
export async function calculateProjectFunds(projectId) {
  try {
    // Ensure projectId is valid
    if (!projectId) {
      logger.warn('calculateProjectFunds: projectId is missing');
      return 0;
    }

    // Get all income transactions (type === '+')
    const incomeTransactions = await Transaction.find({
      projectId: projectId,
      type: '+',
    }).lean();
    
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Get all non-salary expense transactions (type === '-')
    // Note: Salary expenses are already in AC, so we only count manual expense transactions
    const expenseTransactions = await Transaction.find({
      projectId: projectId,
      type: '-',
    }).lean();
    
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Funds = Income - Manual Expenses (non-salary)
    return totalIncome - totalExpenses;
  } catch (error) {
    logger.error(`Calculate Project Funds Error: ${error.message}`, { error, projectId });
    return 0;
  }
}

/**
 * Regenerate EVM snapshots starting from a specific date (inclusive)
 * Used when historical data changes (e.g., retroactive transactions)
 * @param {String} projectId - Project ID
 * @param {Date} startDate - Date to start regeneration from
 */
export async function regenerateSnapshotsFromDate(projectId, startDate = new Date()) {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const start = normalizeDate(startDate);
  const today = normalizeDate(new Date());

  // Keep snapshots before the start date to preserve history
  const preservedSnapshots = (project.evmSnapshots || []).filter(s => {
    try {
      const snapshotDate = normalizeDate(s.date);
      return snapshotDate.getTime() < start.getTime();
    } catch (error) {
      return false;
    }
  });

  const baselineAC = preservedSnapshots.length > 0
    ? preservedSnapshots[preservedSnapshots.length - 1].actualCost || 0
    : 0;

  project.evmSnapshots = preservedSnapshots;
  project.cumulativeActualCost = baselineAC;
  await project.save();

  // Recompute snapshots from start date through today
  const cursor = new Date(start);
  while (cursor.getTime() <= today.getTime()) {
    await calculateDailyActualCost(projectId, new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
}
