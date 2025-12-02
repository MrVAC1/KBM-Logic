import { getMemberVelocity, getProjectMembersVelocity } from '../services/velocityEngine.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Get member velocity
 * GET /api/projects/:projectId/members/:userId/velocity
 */
export const getMemberVelocityData = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { period = 'week' } = req.query; // 'week', 'month', 'year', or custom dates

    // Calculate date range based on period
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        // Use custom dates if provided
        if (req.query.startDate && req.query.endDate) {
          startDate = new Date(req.query.startDate);
          endDate = new Date(req.query.endDate);
        } else {
          startDate.setDate(startDate.getDate() - 7); // Default to week
        }
    }
    
    startDate.setHours(0, 0, 0, 0);

    const velocity = await getMemberVelocity(projectId, userId, startDate, endDate);

    sendSuccess(res, velocity);
  } catch (error) {
    logger.error(`Get Member Velocity Error: ${error.message}`, { error });
    sendError(res, 'Failed to get member velocity', 500);
  }
};

/**
 * Get all members velocity for a project
 * GET /api/projects/:projectId/members/velocity
 */
export const getProjectMembersVelocityData = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { period = 'week' } = req.query;

    // Calculate date range based on period
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        if (req.query.startDate && req.query.endDate) {
          startDate = new Date(req.query.startDate);
          endDate = new Date(req.query.endDate);
        } else {
          startDate.setDate(startDate.getDate() - 7);
        }
    }
    
    startDate.setHours(0, 0, 0, 0);

    const velocities = await getProjectMembersVelocity(projectId, startDate, endDate);

    sendSuccess(res, velocities);
  } catch (error) {
    logger.error(`Get Project Members Velocity Error: ${error.message}`, { error });
    sendError(res, 'Failed to get project members velocity', 500);
  }
};

