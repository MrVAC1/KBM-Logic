import logger from '../utils/logger.js';
import { sendError } from '../utils/response.js';

const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const errorResponse = process.env.NODE_ENV === 'production'
    ? { message }
    : { message, stack: err.stack };

  sendError(res, message, statusCode, errorResponse);
};

export default errorHandler;


