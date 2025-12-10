import Task from '../models/Task.js';
import Project from '../models/Project.js';
import logger from '../utils/logger.js';

/**
 * Get member velocity for a specific time period
 * Velocity = Delivered Hours (tasks completed) / Capacity (work hours)
 * @param {String} projectId - Project ID
 * @param {String} userId - User ID
 * @param {Date} startDate - Start of time period
 * @param {Date} endDate - End of time period
 * @returns {Object} - Velocity data
 */
export async function getMemberVelocity(projectId, userId, startDate, endDate) {
  try {
    // Get tasks moved to "Done" by this user in the period
    const completedTasks = await Task.find({
      projectId,
      status: 'Done',
      assignees: userId,
      updatedAt: {
        $gte: startDate,
        $lte: endDate,
      },
    }).lean();

    // Sum of estimate hours of completed tasks
    const deliveredHours = completedTasks.reduce((sum, task) => {
      return sum + (task.estimateHours || 0);
    }, 0);

    // Get project work schedule to calculate capacity
    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new Error('Project not found');
    }

    const workSchedule = project.workSchedule || {
      workingDays: [1, 2, 3, 4, 5],
      hoursPerDay: 8,
    };

    // Calculate working hours per week based on configured working days
    const workingDaysPerWeek = Array.isArray(workSchedule.workingDays) && workSchedule.workingDays.length > 0
      ? workSchedule.workingDays.length
      : 5;
    const hoursPerWeek = workingDaysPerWeek * (workSchedule.hoursPerDay || 8);

    // Calculate capacity for the period (in weeks)
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const weeksInPeriod = daysDiff / 7;
    const capacity = hoursPerWeek * weeksInPeriod;

    // Calculate velocity ratio (percentage)
    const velocityRatio = capacity > 0 ? (deliveredHours / capacity) * 100 : 0;

    // Flag if underperforming (less than 50% of capacity)
    const isUnderperforming = velocityRatio < 50;

    return {
      userId,
      projectId,
      period: {
        start: startDate,
        end: endDate,
      },
      deliveredHours: Math.round(deliveredHours * 100) / 100,
      capacity: Math.round(capacity * 100) / 100,
      velocityRatio: Math.round(velocityRatio * 100) / 100,
      isUnderperforming,
      status: isUnderperforming ? 'Low Velocity' : 'Normal',
      completedTasksCount: completedTasks.length,
    };
  } catch (error) {
    logger.error(`Get Member Velocity Error: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Get velocity for all members in a project
 * @param {String} projectId - Project ID
 * @param {Date} startDate - Start of time period
 * @param {Date} endDate - End of time period
 * @returns {Array} - Array of velocity data for each member
 */
export async function getProjectMembersVelocity(projectId, startDate, endDate) {
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const members = project.members || [];
    const velocities = [];

    for (const member of members) {
      try {
        const velocity = await getMemberVelocity(
          projectId,
          member.userId,
          startDate,
          endDate
        );
        velocities.push(velocity);
      } catch (error) {
        logger.warn(`Failed to get velocity for member ${member.userId}: ${error.message}`);
      }
    }

    return velocities;
  } catch (error) {
    logger.error(`Get Project Members Velocity Error: ${error.message}`, { error });
    throw error;
  }
}

