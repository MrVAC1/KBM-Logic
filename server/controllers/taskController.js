import Task from '../models/Task.js';
import { recalculateRisk } from '../services/riskEngine.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';
import { logDataOperation, ensureTaskInMongo } from '../services/mongoSync.js';

/**
 * Get project tasks
 * GET /api/projects/:projectId/tasks
 */
export const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await Task.find({ projectId })
      .populate('assignees', 'displayName email avatar')
      .sort({ createdAt: -1 });

    sendSuccess(res, tasks);
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

    // Ensure status defaults to 'Todo' if not provided
    const status = taskData.status || 'Todo';
    
    // Normalize assignees - ensure they're valid ObjectIds
    const assignees = Array.isArray(taskData.assignees) 
      ? taskData.assignees.filter(id => id) // Filter out null/undefined
      : [];

    const task = await Task.create({
      projectId,
      title: taskData.title,
      description: taskData.description || '',
      status: status,
      complexity: taskData.complexity || 'Med',
      assignees: assignees,
      deadline: taskData.deadline || undefined,
      risk: taskData.risk || {
        probability: 1,
        impact: 1,
        auto_score: 1,
      },
    });

    // Recalculate risk
    await recalculateRisk(task._id, projectId);

    const populatedTask = await Task.findById(task._id)
      .populate('assignees', 'displayName email avatar');

    // Log MongoDB persistence
    await logDataOperation('create', 'tasks', task._id.toString(), req.dbUser._id, {
      projectId: projectId.toString(),
      title: task.title,
      status: task.status,
    });

    sendSuccess(res, {
      ...populatedTask.toObject(),
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

    Object.assign(task, updates);
    await task.save();

    // Recalculate risk
    await recalculateRisk(task._id, task.projectId);

    const populatedTask = await Task.findById(task._id)
      .populate('assignees', 'displayName email avatar');

    // Log MongoDB persistence
    await logDataOperation('update', 'tasks', task._id.toString(), req.dbUser._id, {
      projectId: task.projectId.toString(),
      updates: Object.keys(updates),
    });

    sendSuccess(res, {
      ...populatedTask.toObject(),
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
 */
export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findByIdAndDelete(taskId);
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    // Log MongoDB persistence
    await logDataOperation('delete', 'tasks', taskId, req.dbUser._id, {
      projectId: task.projectId.toString(),
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


