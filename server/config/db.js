import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  try {
    // CRITICAL: MONGODB_URI must be set in .env file for MongoDB Atlas
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      const errorMsg = '❌ MONGODB_URI is not set in environment variables. Please configure server/.env file with your MongoDB Atlas connection string.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Security check: Warn if using local MongoDB instead of Atlas
    if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
      logger.warn('⚠️  WARNING: Connection string points to local MongoDB. Ensure you are using MongoDB Atlas connection string.');
    }
    
    logger.info(`Attempting to connect to MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs
    
    // MongoDB Atlas connection options
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000, // Increased timeout for Atlas (10s)
      socketTimeoutMS: 45000,
    };
    
    // Add retryWrites for MongoDB Atlas (required for replica sets)
    if (mongoUri.includes('mongodb+srv://')) {
      connectionOptions.retryWrites = true;
      connectionOptions.w = 'majority';
    }
    
    const conn = await mongoose.connect(mongoUri, connectionOptions);
    
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    logger.info(`✅ Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });
    
    return conn;
  } catch (error) {
    logger.error(`❌ MongoDB connection error: ${error.message}`);
    logger.error(`❌ Make sure MongoDB is running and accessible`);
    // Don't exit - allow server to start and handle DB errors gracefully
    throw error;
  }
};

export default connectDB;


