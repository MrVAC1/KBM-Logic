import mongoose from 'mongoose';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Middleware to check if MongoDB is connected before processing requests
 * that require database operations
 */
export const checkDatabaseConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    logger.warn(`Database not connected. ReadyState: ${mongoose.connection.readyState}`);
    return sendError(
      res,
      'Database connection unavailable. Please check if MongoDB is running.',
      503
    );
  }
  next();
};

/**
 * Get database connection status
 */
export const getDbStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  
  return {
    readyState: mongoose.connection.readyState,
    status: states[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};

