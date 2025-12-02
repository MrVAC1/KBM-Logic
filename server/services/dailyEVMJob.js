import cron from 'node-cron';
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import { calculateDailyActualCost } from './evmEngine.js';
import logger from '../utils/logger.js';

/**
 * Start the daily EVM calculation cron job
 * Runs every day at 00:00 (midnight)
 */
export function startDailyEVMJob() {
  try {
    // Cron expression: '0 0 * * *' = Every day at 00:00
    cron.schedule('0 0 * * *', async () => {
      logger.info('🔄 Starting daily EVM calculation job...');
      
      try {
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
          logger.warn('⚠️ MongoDB not connected, skipping EVM calculation');
          return;
        }

        // Get all active projects
        const projects = await Project.find({ isDeleted: false });
        
        logger.info(`📊 Found ${projects.length} active projects to process`);
        
        for (const project of projects) {
          try {
            await calculateDailyActualCost(project._id);
            logger.info(`✅ Processed project: ${project.name} (${project._id})`);
          } catch (error) {
            logger.error(`❌ Failed to process project ${project._id}: ${error.message}`, { error });
          }
        }
        
        logger.info('✅ Daily EVM calculation job completed');
      } catch (error) {
        logger.error(`❌ Daily EVM job error: ${error.message}`, { error });
      }
    }, {
      scheduled: true,
      timezone: 'UTC', // Adjust timezone as needed
    });
    
    logger.info('✅ Daily EVM cron job scheduled (runs daily at 00:00 UTC)');
  } catch (error) {
    logger.error(`❌ Failed to schedule EVM cron job: ${error.message}`, { error });
  }
}

