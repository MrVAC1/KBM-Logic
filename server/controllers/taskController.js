import Task from '../models/Task.js';
import Project, { ALL_PERMISSIONS } from '../models/Project.js';
import { recalculateRisk } from '../services/riskEngine.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';
import { logDataOperation, ensureTaskInMongo } from '../services/mongoSync.js';
import { calculateTaskPlannedCost } from '../services/taskCostCalculator.js';
import { createNotification } from '../services/notificationService.js';

/**
 * Get project tasks
 * GET /api/projects/:projectId/tasks
 */
export const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await Task.find({ projectId })
      .populate({
        path: 'assignees',
        select: '_id displayName email avatar uid',
        options: { lean: true }
      })
      .lean()
      .sort({ createdAt: -1 });

    // Check if user has financial view permission
    const userPermissions = req.memberPermissions || [];
    const canViewFinancial = userPermissions.includes('can_view_financial');

    // Format tasks and ensure assignees are properly structured
    const formattedTasks = tasks.map(task => {
      const taskObj = {
        ...task,
        assignees: (task.assignees || []).filter(Boolean).map(assignee => {
          // If assignee is null/undefined, skip it
          if (!assignee || typeof assignee !== 'object') {
            return null;
          }
          
          // Return formatted assignee object
          return {
            _id: assignee._id,
            id: assignee._id,
            displayName: assignee.displayName || assignee.email?.split('@')[0] || '',
            email: assignee.email || '',
            avatar: assignee.avatar || '',
            uid: assignee.uid || '',
          };
        }).filter(Boolean) // Remove null entries
      };

      // Hide plannedCost if user doesn't have financial view permission
      if (!canViewFinancial) {
        delete taskObj.plannedCost;
      }

      return taskObj;
    });

    sendSuccess(res, formattedTasks);
  } catch (error) {
    logger.error(`Get Tasks Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch tasks', 500);
  }
};

/**
 * Create task
 * POST /api/projects/:projectId/tasks
 */
export const createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const taskData = req.body;

    // Validate estimateHours is provided and > 0
    if (taskData.estimateHours === undefined || taskData.estimateHours === null) {
      return sendError(res, 'estimateHours is required', 400);
    }

    const estimateHours = parseFloat(taskData.estimateHours);
    if (isNaN(estimateHours) || estimateHours < 0) {
      return sendError(res, 'estimateHours must be a valid non-negative number', 400);
    }

    // Ensure status defaults to 'Todo' if not provided
    const status = taskData.status || 'Todo';
    
    // Normalize assignees - ensure they're valid ObjectIds
    const assignees = Array.isArray(taskData.assignees) 
      ? taskData.assignees.filter(id => id) // Filter out null/undefined
      : [];

    // Get project to calculate plannedCost
    const project = await Project.findById(projectId);
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Calculate plannedCost based on assignees' hourly rates
    const plannedCost = await calculateTaskPlannedCost(
      project,
      estimateHours,
      assignees,
      taskData.startDate,
      taskData.deadline
    );

    const task = await Task.create({
      projectId,
      title: taskData.title,
      description: taskData.description || '',
      status: status,
      complexity: taskData.complexity || 'Med',
      assignees: assignees,
      startDate: taskData.startDate || undefined,
      deadline: taskData.deadline || undefined,
      estimateHours: estimateHours,
      plannedCost: plannedCost,
      plannedValue: plannedCost, // PV = estimateHours (effort) × role rate (PHASE 1: effort-based, not duration-based)
      risk: taskData.risk || {
        probability: 1,
        impact: 1,
        auto_score: 1,
      },
    });

    // Recalculate risk
    await recalculateRisk(task._id, projectId);

    // Create notifications for assigned users
    if (assignees && assignees.length > 0) {
      for (const assigneeId of assignees) {
        try {
          await createNotification(
            assigneeId,
            projectId,
            'task_assigned',
            `You have been assigned to task: ${taskData.title}`,
            { taskId: task._id.toString(), taskTitle: taskData.title }
          );
        } catch (error) {
          logger.warn(`Failed to create assignment notification for user ${assigneeId}: ${error.message}`);
        }
      }
    }

    const populatedTask = await Task.findById(task._id)
      .populate({
        path: 'assignees',
        select: '_id displayName email avatar uid',
        options: { lean: true }
      })
      .lean();

    // Format assignees properly
    const formattedTask = {
      ...populatedTask,
      assignees: (populatedTask?.assignees || []).filter(Boolean).map(assignee => {
        if (!assignee || typeof assignee !== 'object') {
          return null;
        }
        return {
          _id: assignee._id,
          id: assignee._id,
          displayName: assignee.displayName || assignee.email?.split('@')[0] || '',
          email: assignee.email || '',
          avatar: assignee.avatar || '',
          uid: assignee.uid || '',
        };
      }).filter(Boolean)
    };

    // Log MongoDB persistence
    await logDataOperation('create', 'tasks', task._id.toString(), req.dbUser._id, {
      projectId: projectId.toString(),
      title: task.title,
      status: task.status,
    });

    // Check if user has financial view permission
    const userPermissions = req.memberPermissions || [];
    const canViewFinancial = userPermissions.includes('can_view_financial');

    const responseTask = { ...formattedTask };
    
    // Hide plannedCost if user doesn't have financial view permission
    if (!canViewFinancial && responseTask.plannedCost !== undefined) {
      delete responseTask.plannedCost;
    }

    sendSuccess(res, {
      ...responseTask,
      _persistedToMongo: true, // Flag indicating MongoDB persistence
    }, 201);
  } catch (error) {
    logger.error(`Create Task Error: ${error.message}`, { error });
    sendError(res, 'Failed to create task', 500);
  }
};

/**
 * Update task
 * PUT /api/tasks/:taskId
 */
export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    // Store old values before update
    const oldStatus = task.status;
    const oldAssignees = [...(task.assignees || [])];

    // Get project for calculating plannedCost
    const project = await Project.findById(task.projectId);

    // If estimateHours, assignees, startDate, or deadline are being updated, recalculate plannedCost/PV
    const shouldRecalculatePlannedCost = (
      updates.estimateHours !== undefined ||
      updates.assignees !== undefined ||
      updates.startDate !== undefined ||
      updates.deadline !== undefined
    );

    if (shouldRecalculatePlannedCost) {
      const estimateHours = updates.estimateHours !== undefined 
        ? parseFloat(updates.estimateHours) 
        : task.estimateHours;
      const assignees = updates.assignees !== undefined 
        ? (Array.isArray(updates.assignees) ? updates.assignees.filter(id => id) : [])
        : task.assignees;
      const startDate = updates.startDate !== undefined ? updates.startDate : task.startDate;
      const deadline = updates.deadline !== undefined ? updates.deadline : task.deadline;

      if (project && estimateHours > 0 && assignees && assignees.length > 0) {
        const recalculated = await calculateTaskPlannedCost(project, estimateHours, assignees, startDate, deadline);
        updates.plannedCost = recalculated;
        updates.plannedValue = recalculated;
      } else {
        updates.plannedCost = 0;
        updates.plannedValue = 0;
      }
    }

    Object.assign(task, updates);
    await task.save();

    // Recalculate risk
    await recalculateRisk(task._id, task.projectId);

    // Create notification if task is marked as Done
    if (updates.status === 'Done' && oldStatus !== 'Done') {
      try {
        const assignees = task.assignees || [];
        for (const assigneeId of assignees) {
          await createNotification(
            assigneeId,
            task.projectId,
            'task_completed',
            `Task "${task.title}" has been marked as completed`,
            { taskId: task._id.toString(), taskTitle: task.title }
          );
        }
      } catch (error) {
        logger.warn(`Failed to create completion notification: ${error.message}`);
      }
    }

    // Create notification if task is overdue
    if (task.deadline && new Date() > new Date(task.deadline) && task.status !== 'Done') {
      try {
        const assignees = task.assignees || [];
        for (const assigneeId of assignees) {
          await createNotification(
            assigneeId,
            task.projectId,
            'task_overdue',
            `Task "${task.title}" is overdue`,
            { taskId: task._id.toString(), taskTitle: task.title, deadline: task.deadline }
          );
        }
      } catch (error) {
        logger.warn(`Failed to create overdue notification: ${error.message}`);
      }
    }

    // Notify new assignees if they were added
    if (updates.assignees && Array.isArray(updates.assignees)) {
      const newAssignees = updates.assignees.filter(id => 
        !oldAssignees.map(a => a.toString()).includes(id.toString())
      );
      for (const assigneeId of newAssignees) {
        try {
          await createNotification(
            assigneeId,
            task.projectId,
            'task_assigned',
            `You have been assigned to task: ${task.title}`,
            { taskId: task._id.toString(), taskTitle: task.title }
          );
        } catch (error) {
          logger.warn(`Failed to create assignment notification: ${error.message}`);
        }
      }
    }

    // Check if user has financial view permission
    const userPermissions = req.memberPermissions || [];
    const canViewFinancial = userPermissions.includes('can_view_financial');

    const populatedTask = await Task.findById(task._id)
      .populate({
        path: 'assignees',
        select: '_id displayName email avatar uid',
        options: { lean: true }
      })
      .lean();

    // Format assignees properly
    const formattedTask = {
      ...populatedTask,
      assignees: (populatedTask?.assignees || []).filter(Boolean).map(assignee => {
        if (!assignee || typeof assignee !== 'object') {
          return null;
        }
        return {
          _id: assignee._id,
          id: assignee._id,
          displayName: assignee.displayName || assignee.email?.split('@')[0] || '',
          email: assignee.email || '',
          avatar: assignee.avatar || '',
          uid: assignee.uid || '',
        };
      }).filter(Boolean)
    };

    // Hide plannedCost if user doesn't have financial view permission
    if (!canViewFinancial && formattedTask.plannedCost !== undefined) {
      delete formattedTask.plannedCost;
    }

    // Log MongoDB persistence
    await logDataOperation('update', 'tasks', task._id.toString(), req.dbUser._id, {
      projectId: task.projectId.toString(),
      updates: Object.keys(updates),
    });

    sendSuccess(res, {
      ...formattedTask,
      _persistedToMongo: true,
    });
  } catch (error) {
    logger.error(`Update Task Error: ${error.message}`, { error });
    sendError(res, 'Failed to update task', 500);
  }
};

/**
 * Delete task
 * DELETE /api/tasks/:taskId
 * 
 * Security: 
 * - Finds task to get projectId
 * - Verifies user is owner or member of the project
 * - Verifies user has can_delete_tasks permission OR is the project owner
 * - Owner always has permission
 */
export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.dbUser._id;

    // Find the task first to get projectId
    const task = await Task.findById(taskId);
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    const projectId = task.projectId;

    // Find the project
    const project = await Project.findById(projectId);
    if (!project || project.isDeleted) {
      return sendError(res, 'Project not found', 404);
    }

    // Check if user is owner
    const isOwner = project.ownerId.toString() === userId.toString();
    
    // Check if user is a member
    const member = project.members.find(
      m => m.userId.toString() === userId.toString()
    );
    
    // Verify user is owner or member
    if (!isOwner && !member) {
      logger.warn(`User ${userId} attempted to delete task ${taskId} without project membership`);
      return sendError(res, 'Access denied: Not a project member', 403);
    }

    // Verify user has can_delete_tasks permission (owners always have all permissions)
    if (!isOwner) {
      const permissions = Array.isArray(member?.permissions) ? member.permissions : [];
      
      if (!permissions.includes('can_delete_tasks')) {
        logger.warn(`User ${userId} attempted to delete task ${taskId} without can_delete_tasks permission`);
        return sendError(res, 'Access denied: Missing required permission (can_delete_tasks)', 403);
      }
    }

    // All security checks passed - delete the task
    await Task.findByIdAndDelete(taskId);

    // Log MongoDB persistence
    await logDataOperation('delete', 'tasks', taskId, userId, {
      projectId: projectId.toString(),
    });

    sendSuccess(res, { 
      message: 'Task deleted successfully',
      _persistedToMongo: true,
    });
  } catch (error) {
    logger.error(`Delete Task Error: ${error.message}`, { error });
    sendError(res, 'Failed to delete task', 500);
  }
};

/**
 * Start time tracking
 * POST /api/tasks/:taskId/start-timer
 */
export const startTimer = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.dbUser._id;

    const task = await Task.findById(taskId);
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    // Check if timer already running
    const activeLog = task.timeLogs?.find(log => !log.endTime);
    if (activeLog) {
      return sendError(res, 'Timer already running for this task', 400);
    }

    // Create new time log
    task.timeLogs = task.timeLogs || [];
    task.timeLogs.push({
      userId,
      startTime: new Date(),
    });

    await task.save();

    sendSuccess(res, {
      message: 'Timer started',
      timeLog: task.timeLogs[task.timeLogs.length - 1],
    });
  } catch (error) {
    logger.error(`Start Timer Error: ${error.message}`, { error });
    sendError(res, 'Failed to start timer', 500);
  }
};

/**
 * Stop time tracking
 * POST /api/tasks/:taskId/stop-timer
 */
export const stopTimer = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.dbUser._id;

    const task = await Task.findById(taskId);
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    // Find active log
    const activeLog = task.timeLogs?.find(log => !log.endTime && log.userId.toString() === userId.toString());
    if (!activeLog) {
      return sendError(res, 'No active timer found', 400);
    }

    // Stop timer
    activeLog.endTime = new Date();
    activeLog.duration = Math.floor((activeLog.endTime - activeLog.startTime) / 1000);

    await task.save();

    sendSuccess(res, {
      message: 'Timer stopped',
      duration: activeLog.duration,
    });
  } catch (error) {
    logger.error(`Stop Timer Error: ${error.message}`, { error });
    sendError(res, 'Failed to stop timer', 500);
  }
};


