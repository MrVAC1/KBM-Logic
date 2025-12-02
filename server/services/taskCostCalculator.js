import Project from '../models/Project.js';
import User from '../models/User.js';
import { calculateHourlyRate } from './evmEngine.js';
import logger from '../utils/logger.js';

/**
 * Calculate planned cost for a task based on estimateHours and assignee hourly rates
 * @param {Object} project - Project document
 * @param {Number} estimateHours - Estimated hours for the task
 * @param {Array} assigneeIds - Array of assignee user IDs
 * @returns {Number} - Planned cost
 */
export async function calculateTaskPlannedCost(project, estimateHours, assigneeIds) {
  try {
    if (!estimateHours || estimateHours <= 0 || !assigneeIds || assigneeIds.length === 0) {
      return 0;
    }

    // Get project members with hourlyRate or calculate from monthlySalary
    const members = project.members || [];
    let totalHourlyRate = 0;
    let validAssigneesCount = 0;

    for (const assigneeId of assigneeIds) {
      // Find member in project
      const member = members.find(m => 
        m.userId && (m.userId.toString() === assigneeId.toString() || m.userId._id?.toString() === assigneeId.toString())
      );

      if (member) {
        // Check if member has hourlyRate directly
        if (member.hourlyRate && member.hourlyRate > 0) {
          totalHourlyRate += member.hourlyRate;
          validAssigneesCount++;
        } else {
          // Calculate hourlyRate from user's monthlySalary
          const user = await User.findById(member.userId);
          if (user && user.monthlySalary && user.monthlySalary > 0) {
            const hourlyRate = calculateHourlyRate(user.monthlySalary, project.workSchedule);
            totalHourlyRate += hourlyRate;
            validAssigneesCount++;
          }
        }
      }
    }

    if (validAssigneesCount === 0) {
      return 0;
    }

    // Calculate average hourly rate if multiple assignees
    const averageHourlyRate = totalHourlyRate / validAssigneesCount;
    
    // Planned cost = estimateHours * average hourly rate
    return estimateHours * averageHourlyRate;
  } catch (error) {
    logger.error(`Calculate Task Planned Cost Error: ${error.message}`, { error });
    return 0;
  }
}

