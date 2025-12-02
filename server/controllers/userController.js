import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';
import { createNotification } from '../services/notificationService.js';

/**
 * Update user salary
 * PUT /api/users/:userId/salary
 * 
 * Requires: can_manage_salaries permission in the project context
 * Only accessible by project owners or users with can_manage_salaries permission
 */
export const updateUserSalary = async (req, res) => {
  try {
    const { userId } = req.params;
    const { monthlySalary } = req.body;

    // Validate input
    if (monthlySalary === undefined || monthlySalary === null) {
      return sendError(res, 'Monthly salary is required', 400);
    }

    const salaryValue = parseFloat(monthlySalary);
    
    // Validate salary value
    if (isNaN(salaryValue)) {
      return sendError(res, 'Monthly salary must be a valid number', 400);
    }

    if (salaryValue < 0) {
      return sendError(res, 'Monthly salary cannot be negative', 400);
    }

    // Find user by ID
    const user = await User.findById(userId);
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Get old salary for comparison
    const oldSalary = user.monthlySalary || 0;
    
    // Update salary
    user.monthlySalary = salaryValue;
    await user.save();

    logger.info(`User salary updated: ${userId} -> ${salaryValue}`);

    // Create notification if salary changed (get projectId from req.params)
    const { projectId } = req.params;
    if (projectId && salaryValue !== oldSalary) {
      try {
        await createNotification(
          userId,
          projectId,
          'salary_changed',
          `Your monthly salary has been updated to $${salaryValue.toLocaleString()}`,
          { oldSalary, newSalary: salaryValue }
        );
      } catch (error) {
        logger.warn(`Failed to create salary change notification: ${error.message}`);
      }
    }

    return sendSuccess(res, {
      id: user._id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      monthlySalary: user.monthlySalary,
    });
  } catch (error) {
    logger.error(`Update User Salary Error: ${error.message}`, { error });
    sendError(res, 'Failed to update user salary', 500);
  }
};

/**
 * Get user details (including salary for authorized users)
 * GET /api/users/:userId
 */
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-__v');

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Only include salary if user has permission to view it
    // For now, include it - can be filtered later if needed
    return sendSuccess(res, {
      id: user._id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role,
      monthlySalary: user.monthlySalary,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    logger.error(`Get User Details Error: ${error.message}`, { error });
    sendError(res, 'Failed to get user details', 500);
  }
};

