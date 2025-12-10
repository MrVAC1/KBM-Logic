import logger from '../utils/logger.js';
import { normalizeDate } from '../utils/dateUtils.js';

function getWorkingDaySet(workSchedule) {
  const days = Array.isArray(workSchedule?.workingDays) && workSchedule.workingDays.length > 0
    ? workSchedule.workingDays
    : [1, 2, 3, 4, 5]; // Default Mon-Fri
  return new Set(days);
}

function isWorkingDay(date, workSchedule) {
  const day = normalizeDate(date).getDay(); // 0=Sun..6=Sat
  return getWorkingDaySet(workSchedule).has(day);
}

function countWorkingDays(startDate, endDate, workSchedule) {
  if (!startDate || !endDate) return 0;
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (end.getTime() < start.getTime()) return 0;

  let cursor = new Date(start);
  let workingDays = 0;
  while (cursor.getTime() <= end.getTime()) {
    if (isWorkingDay(cursor, workSchedule)) {
      workingDays += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return workingDays;
}

function resolveRoleRateForDate(project, roleName, targetDate = new Date()) {
  if (!roleName) return 0;
  const role = (project.roles || []).find(r => r.name === roleName);
  if (!role) return 0;

  const timeline = Array.isArray(role.salaryHistory) ? [...role.salaryHistory] : [];
  // Ensure the current rate is represented in the timeline
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

/**
 * Calculate working days per month dynamically based on work schedule
 * PHASE 3 FIX: No hardcoded 21 days
 * @param {Object} workSchedule - Project work schedule
 * @returns {Number} - Working days per month
 */
function calculateWorkingDaysPerMonth(workSchedule) {
  const workingDaysCount = Array.isArray(workSchedule?.workingDays) && workSchedule.workingDays.length > 0
    ? workSchedule.workingDays.length
    : 5; // Default Mon-Fri
  
  // Calculate working days per month: (workingDaysCount / 7) * average days per month
  return (workingDaysCount / 7) * 30.4375;
}

function calculateHourlyFromMonthly(monthlyRate, workSchedule) {
  const hoursPerDay = workSchedule?.hoursPerDay || 8;
  // PHASE 3 FIX: Use dynamic calculation instead of hardcoded 21
  const workingDaysPerMonth = calculateWorkingDaysPerMonth(workSchedule);
  const hoursPerMonth = hoursPerDay * workingDaysPerMonth;
  if (!monthlyRate || hoursPerMonth <= 0) return 0;
  return monthlyRate / hoursPerMonth;
}

/**
 * Calculate planned cost/value for a task based on EFFORT (estimateHours), not duration
 * PHASE 1 FIX: Use estimateHours directly. StartDate/Deadline are for timeline distribution only.
 * @param {Object} project - Project document
 * @param {Number} estimateHours - Estimated hours for the task (EFFORT)
 * @param {Array} assigneeIds - Array of assignee user IDs
 * @param {Date} startDate - Task start date (for timeline distribution only)
 * @param {Date} deadline - Task deadline (for timeline distribution only)
 * @returns {Number} - Planned cost
 */
export async function calculateTaskPlannedCost(project, estimateHours, assigneeIds, startDate, deadline) {
  try {
    // PHASE 1 FIX: Use estimateHours (EFFORT) directly, not duration calculation
    if (!estimateHours || estimateHours <= 0) {
      logger.warn(`calculateTaskPlannedCost: estimateHours is missing or zero. Returning 0.`);
      return 0;
    }

    if (!assigneeIds || assigneeIds.length === 0) {
      return 0;
    }

    const members = project.members || [];
    const hourlyRates = [];

    for (const assigneeId of assigneeIds) {
      const member = members.find(m =>
        m.userId && (m.userId.toString() === assigneeId.toString() || m.userId._id?.toString() === assigneeId.toString())
      );

      if (member) {
        const roleName = member.roleName || (Array.isArray(member.roles) ? member.roles[0] : null);
        const monthlyRate = resolveRoleRateForDate(project, roleName, startDate || deadline || new Date());
        const hourlyRate = calculateHourlyFromMonthly(monthlyRate, project.workSchedule);
        if (hourlyRate > 0) {
          hourlyRates.push(hourlyRate);
        }
      }
    }

    if (hourlyRates.length === 0) {
      return 0;
    }

    const averageHourlyRate = hourlyRates.reduce((sum, rate) => sum + rate, 0) / hourlyRates.length;
    
    // PHASE 1 FIX: PV = Effort × Rate (not Duration × Rate)
    return estimateHours * averageHourlyRate;
  } catch (error) {
    logger.error(`Calculate Task Planned Cost Error: ${error.message}`, { error });
    return 0;
  }
}

