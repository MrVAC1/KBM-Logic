import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import apiRoutes from './routes/api.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import { startDailyEVMJob } from './services/dailyEVMJob.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB (async, server will start even if DB is not ready)
(async () => {
  try {
    await connectDB();
    // Start daily EVM calculation cron job only after DB connection
    try {
      startDailyEVMJob();
    } catch (error) {
      logger.error(`Failed to start EVM cron job: ${error.message}`, { error });
    }
  } catch (error) {
    logger.error(`Failed to connect to MongoDB on startup: ${error.message}`);
    logger.warn('Server will start, but database operations will fail until MongoDB is available');
    logger.warn('To fix: Start MongoDB service or check MONGODB_URI in .env file');
  }
})();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());

// Rate Limiting - Increased limit for development/localhost
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 requests per 15 minutes in dev, 100 in production
  skip: (req) => {
    // Skip rate limiting for localhost in development
    return process.env.NODE_ENV !== 'production' && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1');
  }
});
app.use('/api/', limiter);

// Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbStatus,
    mongodb: mongoose.connection.readyState === 1 ? {
      host: mongoose.connection.host,
      name: mongoose.connection.name
    } : null
  });
});

// API Health Check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok', 
    api: 'operational',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Error Handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  // Note: EVM cron job is started after DB connection (see connectDB block above)
});


