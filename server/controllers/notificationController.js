import Notification from '../models/Notification.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Get notifications for current user
 * GET /api/projects/:projectId/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.dbUser._id;
    const { isRead, limit = 50, allProjects } = req.query;

    const query = {
      recipientId: userId,
    };

    // If projectId is provided and allProjects is not true, filter by project
    if (projectId && allProjects !== 'true') {
      query.projectId = projectId;
    }

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const notifications = await Notification.find(query)
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    sendSuccess(res, notifications);
  } catch (error) {
    logger.error(`Get Notifications Error: ${error.message}`, { error });
    sendError(res, 'Failed to get notifications', 500);
  }
};

/**
 * Get all notifications for current user (across all projects)
 * GET /api/notifications
 */
export const getAllNotifications = async (req, res) => {
  try {
    const userId = req.dbUser._id;
    const { isRead, limit = 50 } = req.query;

    const query = {
      recipientId: userId,
    };

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const notifications = await Notification.find(query)
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    sendSuccess(res, notifications);
  } catch (error) {
    logger.error(`Get All Notifications Error: ${error.message}`, { error });
    sendError(res, 'Failed to get notifications', 500);
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.dbUser._id;
    const { projectId } = req.query;

    const query = {
      recipientId: userId,
      isRead: false,
    };

    if (projectId) {
      query.projectId = projectId;
    }

    const count = await Notification.countDocuments(query);

    sendSuccess(res, { count });
  } catch (error) {
    logger.error(`Get Unread Count Error: ${error.message}`, { error });
    sendError(res, 'Failed to get unread count', 500);
  }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:notificationId/read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.dbUser._id;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return sendError(res, 'Notification not found', 404);
    }

    // Verify notification belongs to user
    if (notification.recipientId.toString() !== userId.toString()) {
      return sendError(res, 'Unauthorized', 403);
    }

    notification.isRead = true;
    await notification.save();

    sendSuccess(res, notification);
  } catch (error) {
    logger.error(`Mark Notification As Read Error: ${error.message}`, { error });
    sendError(res, 'Failed to mark notification as read', 500);
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.dbUser._id;
    const { projectId } = req.body;

    const query = {
      recipientId: userId,
      isRead: false,
    };

    if (projectId) {
      query.projectId = projectId;
    }

    const result = await Notification.updateMany(query, { isRead: true });

    sendSuccess(res, { 
      updatedCount: result.modifiedCount,
      message: `Marked ${result.modifiedCount} notifications as read`
    });
  } catch (error) {
    logger.error(`Mark All As Read Error: ${error.message}`, { error });
    sendError(res, 'Failed to mark all notifications as read', 500);
  }
};

