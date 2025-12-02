import Notification from '../models/Notification.js';
import Project from '../models/Project.js';
import logger from '../utils/logger.js';

/**
 * Check if user should receive notification based on their role permissions AND preferences
 * @param {Object} project - Project document
 * @param {String} userId - User ID
 * @param {String} notificationType - Type of notification
 * @returns {Boolean} - Whether user should receive notification
 */
export async function shouldReceiveNotification(project, userId, notificationType) {
  try {
    // Owner always receives all notifications (but can still toggle preferences)
    const isOwner = project.ownerId.toString() === userId.toString();

    // Find user's member record
    const member = project.members.find(m => 
      m.userId && (m.userId.toString() === userId.toString() || m.userId._id?.toString() === userId.toString())
    );

    if (!member) {
      return false;
    }

    // Check user notification preferences first
    const notificationSettings = member.notificationSettings || {};
    
    // Map notification types to preference fields
    let preferenceKey = null;
    switch (notificationType) {
      case 'task_assigned':
        preferenceKey = 'notifyOnTaskAssignment';
        break;
      case 'financial_risk':
      case 'budget_overrun':
        preferenceKey = 'notifyOnBudgetRisk';
        break;
      case 'role_changed':
      case 'permission_changed':
      case 'salary_changed':
        preferenceKey = 'notifyOnRoleChange';
        break;
      case 'task_overdue':
        preferenceKey = 'notifyOnTaskOverdue';
        break;
      case 'task_completed':
        preferenceKey = 'notifyOnTaskCompleted';
        break;
      case 'deadline_approaching':
        // Use task assignment preference for deadline approaching
        preferenceKey = 'notifyOnTaskAssignment';
        break;
      default:
        // Unknown notification type - allow by default for owners, deny for others
        return isOwner;
    }

    // Check role permissions FIRST for manager alerts (they must have permission to receive)
    const permissions = member.permissions || [];
    
    // For manager alerts, check permission BEFORE checking user preference
    if (notificationType === 'financial_risk' || notificationType === 'budget_overrun') {
      if (!isOwner && !permissions.includes('notify_on_financial_risk')) {
        logger.debug(`User ${userId} doesn't have notify_on_financial_risk permission`);
        return false;
      }
    }
    
    if (notificationType === 'role_changed' || notificationType === 'permission_changed' || notificationType === 'salary_changed') {
      if (!isOwner && !permissions.includes('notify_on_role_change')) {
        logger.debug(`User ${userId} doesn't have notify_on_role_change permission`);
        return false;
      }
    }
    
    if (notificationType === 'task_assigned') {
      if (!isOwner && !permissions.includes('notify_on_task_assignment')) {
        // Task assignment notifications can still be sent to assignees
        // But if user explicitly disabled it, respect that
        if (notificationSettings.notifyOnTaskAssignment === false) {
          return false;
        }
        // For now, allow task assignment notifications even without permission
        // (they're assigned to the task, so they should know)
      }
    }

    // Check user preference (default to true if not set)
    if (preferenceKey && notificationSettings[preferenceKey] === false) {
      logger.debug(`User ${userId} has disabled ${preferenceKey} notification preference`);
      return false;
    }

    // If owner, they receive all notifications (unless explicitly disabled above)
    if (isOwner) {
      return true;
    }

    // For task-related notifications, if user has permission or is assignee, allow
    switch (notificationType) {
      case 'task_overdue':
      case 'task_completed':
      case 'deadline_approaching':
        // These are sent to task assignees if preference allows
        return true;
      
      default:
        // Already checked permissions above for manager alerts
        return true;
    }
  } catch (error) {
    logger.error(`Should Receive Notification Error: ${error.message}`, { error });
    return false;
  }
}

/**
 * Create a notification
 * @param {String} recipientId - User ID who will receive notification
 * @param {String} projectId - Project ID
 * @param {String} type - Notification type
 * @param {String} message - Notification message
 * @param {Object} metadata - Additional metadata
 * @returns {Object} - Created notification
 */
export async function createNotification(recipientId, projectId, type, message, metadata = {}) {
  try {
    // Verify project exists and user should receive this notification
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Check if user should receive this notification
    const shouldReceive = await shouldReceiveNotification(project, recipientId, type);
    if (!shouldReceive) {
      logger.debug(`User ${recipientId} should not receive ${type} notification (permission check failed)`);
      return null;
    }

    const notification = await Notification.create({
      recipientId,
      projectId,
      type,
      message,
      metadata,
    });

    logger.info(`Notification created: ${type} for user ${recipientId} in project ${projectId}`);
    return notification;
  } catch (error) {
    logger.error(`Create Notification Error: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Create notifications for multiple recipients
 * @param {Array} recipientIds - Array of user IDs
 * @param {String} projectId - Project ID
 * @param {String} type - Notification type
 * @param {Function} messageGenerator - Function that takes (userId) and returns message
 * @param {Object} metadata - Additional metadata
 */
export async function createNotificationsForUsers(recipientIds, projectId, type, messageGenerator, metadata = {}) {
  try {
    const notifications = [];

    for (const recipientId of recipientIds) {
      const message = typeof messageGenerator === 'function' 
        ? messageGenerator(recipientId) 
        : messageGenerator;

      const notification = await createNotification(recipientId, projectId, type, message, metadata);
      if (notification) {
        notifications.push(notification);
      }
    }

    return notifications;
  } catch (error) {
    logger.error(`Create Notifications For Users Error: ${error.message}`, { error });
    throw error;
  }
}

