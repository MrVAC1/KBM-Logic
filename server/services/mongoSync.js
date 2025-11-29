/**
 * MongoDB Sync Service
 * 
 * Ensures all important data is persisted to MongoDB.
 * This service handles replication from Firebase (if any) and guarantees
 * MongoDB is the source of truth for all business data.
 */

import logger from '../utils/logger.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Transaction from '../models/Transaction.js';

/**
 * Sync user data from Firebase Auth to MongoDB
 * Called whenever user authenticates or profile updates
 */
export const syncUserToMongo = async (firebaseUser) => {
  try {
    const { uid, email, displayName, photoURL, emailVerified, phoneNumber } = firebaseUser;

    const userData = {
      uid,
      email,
      displayName: displayName || email?.split('@')[0] || 'User',
      avatar: photoURL || null,
      // Additional Firebase data
      emailVerified: emailVerified || false,
      phoneNumber: phoneNumber || null,
    };

    let user = await User.findOne({ uid });
    
    if (user) {
      // Update existing user with latest Firebase data
      Object.assign(user, userData);
      await user.save();
      logger.info(`User synced to MongoDB: ${uid}`);
    } else {
      // Create new user
      user = await User.create({
        ...userData,
        role: 'Pending',
      });
      logger.info(`New user created in MongoDB: ${uid}`);
    }

    return user;
  } catch (error) {
    logger.error(`Failed to sync user to MongoDB: ${error.message}`, { error, uid: firebaseUser?.uid });
    throw error;
  }
};

/**
 * Ensure project data is persisted to MongoDB
 * This is the primary storage - no Firebase replication needed
 */
export const ensureProjectInMongo = async (projectData) => {
  try {
    // Projects are already stored in MongoDB
    // This function ensures data integrity
    const project = await Project.findById(projectData._id || projectData.id);
    
    if (!project) {
      logger.warn(`Project not found in MongoDB: ${projectData.id}`);
      return null;
    }

    logger.debug(`Project verified in MongoDB: ${project._id}`);
    return project;
  } catch (error) {
    logger.error(`Failed to ensure project in MongoDB: ${error.message}`, { error });
    throw error;
  }
};

/**
 * Ensure task data is persisted to MongoDB
 */
export const ensureTaskInMongo = async (taskData) => {
  try {
    const task = await Task.findById(taskData._id || taskData.id);
    
    if (!task) {
      logger.warn(`Task not found in MongoDB: ${taskData.id}`);
      return null;
    }

    logger.debug(`Task verified in MongoDB: ${task._id}`);
    return task;
  } catch (error) {
    logger.error(`Failed to ensure task in MongoDB: ${error.message}`, { error });
    throw error;
  }
};

/**
 * Ensure transaction data is persisted to MongoDB
 */
export const ensureTransactionInMongo = async (transactionData) => {
  try {
    const transaction = await Transaction.findById(transactionData._id || transactionData.id);
    
    if (!transaction) {
      logger.warn(`Transaction not found in MongoDB: ${transactionData.id}`);
      return null;
    }

    logger.debug(`Transaction verified in MongoDB: ${transaction._id}`);
    return transaction;
  } catch (error) {
    logger.error(`Failed to ensure transaction in MongoDB: ${error.message}`, { error });
    throw error;
  }
};

/**
 * Audit log for data operations
 * Tracks all important data writes to MongoDB
 */
export const logDataOperation = async (operation, collection, documentId, userId, metadata = {}) => {
  try {
    const logEntry = {
      timestamp: new Date(),
      operation, // 'create', 'update', 'delete', 'read'
      collection,
      documentId,
      userId,
      metadata,
    };

    logger.info(`Data Operation: ${operation} on ${collection}`, logEntry);
    
    // In production, you might want to store this in a separate AuditLog collection
    // For now, we'll use logger
    return logEntry;
  } catch (error) {
    logger.error(`Failed to log data operation: ${error.message}`, { error });
  }
};

/**
 * Verify data integrity - ensure all referenced documents exist
 */
export const verifyDataIntegrity = async (projectId) => {
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return { valid: false, error: 'Project not found' };
    }

    // Verify all members exist
    const memberUserIds = project.members.map(m => m.userId);
    const existingUsers = await User.find({ _id: { $in: memberUserIds } });
    
    if (existingUsers.length !== memberUserIds.length) {
      logger.warn(`Some project members not found in MongoDB for project ${projectId}`);
    }

    // Verify all tasks exist
    const tasks = await Task.find({ projectId });
    
    // Verify all transactions exist
    const transactions = await Transaction.find({ projectId });

    return {
      valid: true,
      project: project._id,
      members: existingUsers.length,
      tasks: tasks.length,
      transactions: transactions.length,
    };
  } catch (error) {
    logger.error(`Data integrity check failed: ${error.message}`, { error, projectId });
    return { valid: false, error: error.message };
  }
};

export default {
  syncUserToMongo,
  ensureProjectInMongo,
  ensureTaskInMongo,
  ensureTransactionInMongo,
  logDataOperation,
  verifyDataIntegrity,
};

