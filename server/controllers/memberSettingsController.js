import Project, { ALL_PERMISSIONS } from '../models/Project.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Get user permissions from project
 */
function getUserPermissions(project, userId) {
  // Owner has all permissions
  if (project.ownerId.toString() === userId.toString()) {
    return ALL_PERMISSIONS;
  }

  // Find member
  const member = project.members.find(m =>
    m.userId && (m.userId.toString() === userId.toString() || m.userId._id?.toString() === userId.toString())
  );

  if (!member) {
    return [];
  }

  return member.permissions || [];
}

/**
 * Update current user's notification settings for a project
 * PUT /api/projects/:projectId/members/me/notifications
 */
export const updateMyNotificationSettings = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.dbUser._id;
    const { notificationSettings } = req.body;

    if (!notificationSettings || typeof notificationSettings !== 'object') {
      return sendError(res, 'Notification settings object is required', 400);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Find member
    const memberIndex = project.members.findIndex(m =>
      m.userId && (m.userId.toString() === userId.toString() || m.userId._id?.toString() === userId.toString())
    );

    if (memberIndex === -1) {
      return sendError(res, 'Member not found in project', 404);
    }

    // Get user permissions to validate manager alert settings
    const userPermissions = getUserPermissions(project, userId);
    const isOwner = project.ownerId.toString() === userId.toString();

    // Update notification settings
    if (!project.members[memberIndex].notificationSettings) {
      project.members[memberIndex].notificationSettings = {};
    }

    // Update each setting if provided, with permission validation
    if ('notifyOnTaskAssignment' in notificationSettings) {
      project.members[memberIndex].notificationSettings.notifyOnTaskAssignment = 
        Boolean(notificationSettings.notifyOnTaskAssignment);
    }
    
    if ('notifyOnBudgetRisk' in notificationSettings) {
      const requestedValue = Boolean(notificationSettings.notifyOnBudgetRisk);
      // Only allow enabling if user has permission or is owner
      if (requestedValue && !isOwner && !userPermissions.includes('notify_on_financial_risk')) {
        return sendError(res, 'You do not have permission to enable financial risk notifications. Your role must include "Financial Risk Notifications" permission.', 403);
      }
      project.members[memberIndex].notificationSettings.notifyOnBudgetRisk = requestedValue;
    }
    
    if ('notifyOnRoleChange' in notificationSettings) {
      const requestedValue = Boolean(notificationSettings.notifyOnRoleChange);
      // Only allow enabling if user has permission or is owner
      if (requestedValue && !isOwner && !userPermissions.includes('notify_on_role_change')) {
        return sendError(res, 'You do not have permission to enable role change notifications. Your role must include "Role Change Notifications" permission.', 403);
      }
      project.members[memberIndex].notificationSettings.notifyOnRoleChange = requestedValue;
    }
    
    if ('notifyOnTaskOverdue' in notificationSettings) {
      project.members[memberIndex].notificationSettings.notifyOnTaskOverdue = 
        Boolean(notificationSettings.notifyOnTaskOverdue);
    }
    if ('notifyOnTaskCompleted' in notificationSettings) {
      project.members[memberIndex].notificationSettings.notifyOnTaskCompleted = 
        Boolean(notificationSettings.notifyOnTaskCompleted);
    }

    await project.save();

    logger.info(`Notification settings updated for user ${userId} in project ${projectId}`);

    sendSuccess(res, {
      message: 'Notification settings updated successfully',
      notificationSettings: project.members[memberIndex].notificationSettings,
    });
  } catch (error) {
    logger.error(`Update Notification Settings Error: ${error.message}`, { error });
    sendError(res, 'Failed to update notification settings', 500);
  }
};

/**
 * Get current user's notification settings for a project
 * GET /api/projects/:projectId/members/me/notifications
 */
export const getMyNotificationSettings = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.dbUser._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Find member
    const member = project.members.find(m =>
      m.userId && (m.userId.toString() === userId.toString() || m.userId._id?.toString() === userId.toString())
    );

    if (!member) {
      return sendError(res, 'Member not found in project', 404);
    }

    // Get user permissions to set defaults correctly
    const userPermissions = getUserPermissions(project, userId);
    const isOwner = project.ownerId.toString() === userId.toString();

    // Return notification settings with defaults based on permissions
    const defaultSettings = member.notificationSettings || {};
    const notificationSettings = {
      notifyOnTaskAssignment: defaultSettings.notifyOnTaskAssignment ?? true,
      notifyOnBudgetRisk: isOwner || userPermissions.includes('notify_on_financial_risk')
        ? (defaultSettings.notifyOnBudgetRisk ?? true)
        : false, // Auto-disable if no permission
      notifyOnRoleChange: isOwner || userPermissions.includes('notify_on_role_change')
        ? (defaultSettings.notifyOnRoleChange ?? true)
        : false, // Auto-disable if no permission
      notifyOnTaskOverdue: defaultSettings.notifyOnTaskOverdue ?? true,
      notifyOnTaskCompleted: defaultSettings.notifyOnTaskCompleted ?? true,
    };

    sendSuccess(res, { notificationSettings });
  } catch (error) {
    logger.error(`Get Notification Settings Error: ${error.message}`, { error });
    sendError(res, 'Failed to get notification settings', 500);
  }
};

