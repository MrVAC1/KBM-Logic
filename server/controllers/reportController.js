import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { calculatePV, calculateAC, calculateHourlyRate, calculateDailyRate, getEffectiveDeadline } from '../services/evmEngine.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';
import { normalizeDate } from '../utils/dateUtils.js';

/**
 * Get Financial Dashboard Values - EXACT same logic as Financial Dashboard
 * This ensures 100% data parity - single source of truth
 * CRITICAL: This function replicates the EXACT same calculation logic from financialController.getDashboardStats
 * @param {String} projectId - Project ID
 * @param {Object} project - Project document
 * @param {Date} today - Target date (today)
 * @returns {Promise<Object>} - { currentPV, currentAC }
 */
async function getFinancialDashboardValues(projectId, project, today) {
  // Use the EXACT same functions and logic as Financial Dashboard
  let currentPV = 0;
  let currentAC = 0;

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

  // Log for verification - these values MUST match Financial Dashboard
  console.log('[Report Controller] Financial Values (from shared logic):', {
    PV: currentPV,
    AC: currentAC,
    Variance: currentAC - currentPV,
    Date: today.toISOString(),
    ProjectId: projectId,
  });

  return { currentPV, currentAC };
}

/**
 * Get Investor Report data
 * GET /api/projects/:projectId/reports/investor
 * 
 * Calculates high-level metrics for investor reporting:
 * - Burn Rate: Total Actual Spent / Project Duration in Months
 * - Runway: Remaining Budget / Burn Rate (as Date)
 * - Financials: { plannedTotal, actualTotal, variance }
 * - Top Risks: 3 risks with highest risk.score
 * - Roadmap Status: % Completed Tasks vs % Time Elapsed
 * - Team Data: Members with salary/rate (only for Owner)
 */
export const getInvestorReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.dbUser._id;
    
    const project = await Project.findById(projectId);

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Check if user is Owner
    const isOwner = project.ownerId.toString() === userId.toString();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get project start date
    const projectStartDate = project.createdAt || new Date();
    projectStartDate.setHours(0, 0, 0, 0);

    // Calculate project duration in months (elapsed time)
    const monthsDiff = (today.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const projectDurationMonths = Math.max(0.1, monthsDiff); // Minimum 0.1 months to avoid division by zero

    // Calculate total planned duration using effective deadline
    let totalPlannedDurationMonths = null;
    let effectiveDeadlineDate = null;
    
    try {
      effectiveDeadlineDate = await getEffectiveDeadline(project, today);
      const deadlineDateNormalized = normalizeDate(effectiveDeadlineDate);
      const totalMonths = (deadlineDateNormalized.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      totalPlannedDurationMonths = Math.max(0.1, totalMonths);
    } catch (error) {
      logger.warn(`Error calculating total planned duration: ${error.message}`);
      // Fallback: use project.deadline if available, otherwise null
      if (project.deadline) {
        const deadlineDate = normalizeDate(project.deadline);
        const totalMonths = (deadlineDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        totalPlannedDurationMonths = Math.max(0.1, totalMonths);
        effectiveDeadlineDate = deadlineDate;
      }
    }

    // CRITICAL: Use the EXACT same function as Financial Dashboard
    // This ensures 100% data parity - single source of truth
    const { currentPV, currentAC } = await getFinancialDashboardValues(projectId, project, today);

    // Verification logging - these MUST match Financial Dashboard
    console.log('[Investor Report] Financial Data Verification:', {
      PV: currentPV,
      AC: currentAC,
      Variance: currentAC - currentPV,
      Date: today.toISOString(),
      ProjectId: projectId,
    });
    
    logger.info(`[Investor Report] Using shared financial logic - PV: ${currentPV}, AC: ${currentAC}`);

    // Calculate Burn Rate: Total Actual Spent / Project Duration in Months
    const burnRate = projectDurationMonths > 0 ? currentAC / projectDurationMonths : 0;

    // Calculate Remaining Budget
    const remainingBudget = Math.max(0, currentPV - currentAC);

    // Calculate Runway: Remaining Budget / Burn Rate
    let runway = null;
    let runwayDate = null;
    let runwayStatus = 'infinite';
    let runwayMessage = 'Infinite Runway';
    let fundsRunOutBeforeDeadline = false;

    if (burnRate > 0) {
      const runwayMonths = remainingBudget / burnRate;
      runway = runwayMonths;
      
      // Calculate runway date
      runwayDate = new Date(today);
      runwayDate.setMonth(runwayDate.getMonth() + runwayMonths);
      
      // Check if funds run out before project deadline
      if (project.deadline) {
        const deadlineDate = new Date(project.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        fundsRunOutBeforeDeadline = runwayDate.getTime() < deadlineDate.getTime();
      }
      
      // Determine runway status
      if (runwayMonths > 6) {
        runwayStatus = 'healthy'; // Green
      } else if (runwayMonths > 3) {
        runwayStatus = 'warning'; // Yellow
      } else if (runwayMonths > 0) {
        runwayStatus = 'critical'; // Red
      } else {
        // Runway is 0 or negative
        runwayStatus = 'critical';
        runway = 0;
      }

      // Format runway message with deadline context
      if (runwayMonths < 1 && runwayMonths > 0) {
        runwayMessage = 'Less than 1 month remaining';
        if (fundsRunOutBeforeDeadline && project.deadline) {
          runwayMessage += ' (before project deadline)';
        }
      } else if (runwayMonths <= 0) {
        runwayMessage = 'Funds exhausted';
      } else {
        runwayMessage = `Funds last until ${runwayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
        if (fundsRunOutBeforeDeadline && project.deadline) {
          const deadlineFormatted = new Date(project.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          runwayMessage += ` (${Math.ceil((new Date(project.deadline).getTime() - runwayDate.getTime()) / (1000 * 60 * 60 * 24))} days before deadline: ${deadlineFormatted})`;
        } else if (project.deadline && runwayDate.getTime() >= new Date(project.deadline).getTime()) {
          runwayMessage += ' (sufficient until deadline)';
        }
      }
    } else {
      // Burn Rate is 0, return "Infinite Runway"
      runway = Infinity;
      runwayStatus = 'infinite';
    }

    // Financials: Planned vs Actual
    const financials = {
      plannedTotal: Math.round(currentPV * 100) / 100,
      actualTotal: Math.round(currentAC * 100) / 100,
      variance: Math.round((currentAC - currentPV) * 100) / 100,
    };

    // Top Risks: Get 3 risks with highest risk.score
    const allTasks = await Task.find({ projectId }).lean();
    const tasksWithRisks = allTasks.filter(task => task.risk && task.risk.auto_score);
    
    // Sort by risk score (highest first) and take top 3
    const topRisks = tasksWithRisks
      .map(task => ({
        taskId: task._id,
        title: task.title || 'Untitled Task',
        riskScore: task.risk.auto_score || 0,
        probability: task.risk.probability || 0,
        impact: task.risk.impact || 0,
        description: task.description || '',
        status: task.status || 'Todo',
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 3);

    // Roadmap Status: % Completed Tasks vs % Time Elapsed
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(task => task.status === 'Done').length;
    const completedPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Calculate time elapsed percentage using Effective Deadline
    // This handles projects without a specific deadline (Agile/Ongoing projects)
    let projectEndDate = null;
    let timeElapsedPercentage = null;
    let hasValidDeadline = false;

    try {
      // Get effective deadline (Priority: project.deadline -> latest task -> default)
      projectEndDate = await getEffectiveDeadline(project, today);
      
      // Determine if deadline is valid (not default)
      // hasValidDeadline = true only if project.deadline exists OR latest task deadline exists
      hasValidDeadline = !!(project.deadline || (allTasks.length > 0 && allTasks.some(t => t.deadline)));

      // Only calculate percentage if we have a valid end date
      const totalProjectDays = Math.max(1, Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)));
      const elapsedDays = Math.max(0, Math.ceil((today.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Prevent division by zero and NaN
      if (totalProjectDays > 0 && !isNaN(totalProjectDays) && !isNaN(elapsedDays)) {
        timeElapsedPercentage = Math.min(100, Math.max(0, (elapsedDays / totalProjectDays) * 100));
      } else {
        timeElapsedPercentage = null; // Mark as invalid
        hasValidDeadline = false;
      }
    } catch (error) {
      logger.warn(`Error calculating time elapsed percentage: ${error.message}`);
      timeElapsedPercentage = null;
      hasValidDeadline = false;
      // Fallback to today + 30 days
      projectEndDate = new Date(projectStartDate);
      projectEndDate.setDate(projectEndDate.getDate() + 30);
    }

    // Determine if project is ahead of schedule (only if we have valid time elapsed data)
    let isAheadOfSchedule = null;
    if (timeElapsedPercentage !== null && !isNaN(timeElapsedPercentage)) {
      isAheadOfSchedule = completedPercentage > timeElapsedPercentage;
    }

    const roadmapStatus = {
      completedTasks: completedTasks,
      totalTasks: totalTasks,
      completedPercentage: Math.round(completedPercentage * 100) / 100,
      timeElapsedPercentage: timeElapsedPercentage !== null ? Math.round(timeElapsedPercentage * 100) / 100 : null,
      isAheadOfSchedule: isAheadOfSchedule,
      hasValidDeadline: hasValidDeadline, // Flag to indicate if deadline is valid (not default)
      effectiveDeadline: projectEndDate ? projectEndDate.toISOString() : null, // The effective deadline used for calculations (ISO string for JSON)
    };

    // Team & Financials: Get members with salary data (only for Owner)
    let teamMembers = [];
    let roleDistribution = {};

    if (isOwner) {
      // Populate members with user details including monthlySalary
      await project.populate('members.userId', 'displayName email monthlySalary');
      
      // Get role distribution
      const roleCounts = {};
      project.members.forEach(member => {
        const roles = Array.isArray(member.roles) && member.roles.length > 0 
          ? member.roles 
          : (member.roleName ? [member.roleName] : ['Guest']);
        
        roles.forEach(role => {
          roleCounts[role] = (roleCounts[role] || 0) + 1;
        });
      });
      roleDistribution = roleCounts;

      // Build team members list with financial data
      for (const member of project.members) {
        const user = member.userId;
        if (user && typeof user === 'object') {
          const monthlySalary = user.monthlySalary || 0;
          const hourlyRate = member.hourlyRate || (monthlySalary > 0 
            ? calculateHourlyRate(monthlySalary, project.workSchedule) 
            : 0);
          const dailyRate = monthlySalary > 0 
            ? calculateDailyRate(monthlySalary, project.workSchedule) 
            : 0;

          const roles = Array.isArray(member.roles) && member.roles.length > 0 
            ? member.roles 
            : (member.roleName ? [member.roleName] : ['Guest']);

          teamMembers.push({
            userId: user._id,
            displayName: user.displayName || user.email?.split('@')[0] || 'Unknown',
            email: user.email || '',
            roles: roles,
            primaryRole: roles[0] || 'Guest',
            monthlySalary: monthlySalary,
            hourlyRate: Math.round(hourlyRate * 100) / 100,
            dailyRate: Math.round(dailyRate * 100) / 100,
            joinedAt: member.joinedAt || project.createdAt,
          });
        }
      }
    }

    // Build response
    const reportData = {
      project: {
        id: project._id,
        name: project.name,
        description: project.description,
        startDate: projectStartDate,
        currentDate: today,
        deadline: project.deadline || null, // Include project deadline
      },
      burnRate: {
        monthly: Math.round(burnRate * 100) / 100,
        daily: Math.round((burnRate / 30.44) * 100) / 100,
      },
      projectDuration: {
        elapsedMonths: Math.round(projectDurationMonths * 100) / 100,
        totalPlannedMonths: totalPlannedDurationMonths ? Math.round(totalPlannedDurationMonths * 100) / 100 : null,
        deadline: project.deadline || null, // Original project deadline (may be null)
        effectiveDeadline: effectiveDeadlineDate || null, // Effective deadline used for calculations
        isDefaultDeadline: !project.deadline && effectiveDeadlineDate !== null, // True if using fallback deadline
      },
      runway: {
        months: runway === Infinity ? null : Math.round(runway * 100) / 100,
        date: runwayDate,
        status: runwayStatus,
        message: runwayMessage,
        fundsRunOutBeforeDeadline: fundsRunOutBeforeDeadline,
      },
      financials,
      topRisks,
      roadmapStatus,
      // Team data (only included if user is Owner)
      team: isOwner ? {
        roleDistribution,
        members: teamMembers,
        totalMembers: teamMembers.length,
        totalMonthlySalary: teamMembers.reduce((sum, m) => sum + m.monthlySalary, 0),
      } : null,
      isOwner,
    };

    sendSuccess(res, reportData);
  } catch (error) {
    logger.error(`Get Investor Report Error: ${error.message}`, { error });
    sendError(res, 'Failed to generate investor report', 500);
  }
};

