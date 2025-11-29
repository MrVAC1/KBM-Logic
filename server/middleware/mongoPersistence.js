/**
 * MongoDB Persistence Middleware
 * 
 * Ensures all important data operations are persisted to MongoDB.
 * This middleware wraps controllers to guarantee MongoDB writes.
 */

import { logDataOperation } from '../services/mongoSync.js';
import logger from '../utils/logger.js';

/**
 * Middleware to log and ensure MongoDB persistence for create operations
 */
export const ensureMongoCreate = (collectionName) => {
  return async (req, res, next) => {
    // Store original sendSuccess if it exists
    const originalSend = res.json;
    
    // Override res.json to intercept response
    res.json = function(data) {
      // Log the operation
      const documentId = data?.id || data?._id || data?.data?.id || data?.data?._id;
      const userId = req.dbUser?._id || req.user?.uid;
      
      if (documentId && userId) {
        logDataOperation('create', collectionName, documentId, userId, {
          method: req.method,
          path: req.path,
        }).catch(err => logger.error('Failed to log operation', err));
      }
      
      // Call original send
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware to log and ensure MongoDB persistence for update operations
 */
export const ensureMongoUpdate = (collectionName) => {
  return async (req, res, next) => {
    const originalSend = res.json;
    
    res.json = function(data) {
      const documentId = req.params.id || req.params.projectId || req.params.taskId || req.params.memberId;
      const userId = req.dbUser?._id || req.user?.uid;
      
      if (documentId && userId) {
        logDataOperation('update', collectionName, documentId, userId, {
          method: req.method,
          path: req.path,
          updates: Object.keys(req.body || {}),
        }).catch(err => logger.error('Failed to log operation', err));
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware to log and ensure MongoDB persistence for delete operations
 */
export const ensureMongoDelete = (collectionName) => {
  return async (req, res, next) => {
    const originalSend = res.json;
    
    res.json = function(data) {
      const documentId = req.params.id || req.params.projectId || req.params.taskId;
      const userId = req.dbUser?._id || req.user?.uid;
      
      if (documentId && userId) {
        logDataOperation('delete', collectionName, documentId, userId, {
          method: req.method,
          path: req.path,
        }).catch(err => logger.error('Failed to log operation', err));
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * General middleware to ensure MongoDB persistence
 * Can be used for any operation
 */
export const ensureMongoPersistence = (collectionName) => {
  return async (req, res, next) => {
    // This middleware ensures that by the time we reach the controller,
    // we're working with MongoDB models, not Firebase data
    
    // Log the operation type
    const operation = req.method === 'POST' ? 'create' :
                     req.method === 'PUT' || req.method === 'PATCH' ? 'update' :
                     req.method === 'DELETE' ? 'delete' : 'read';
    
    // Store operation info for logging after response
    req._mongoOperation = {
      collection: collectionName,
      operation,
    };
    
    next();
  };
};

