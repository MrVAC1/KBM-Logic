import Task from '../models/Task.js';
import Transaction from '../models/Transaction.js';
import logger from '../utils/logger.js';

/**
 * Calculate Planned Value (S-Curve) based on tasks and fixed costs
 */
export const calculatePlannedValue = async (projectId, projectStartDate, projectEndDate, fixedCosts = []) => {
  try {
    const tasks = await Task.find({ projectId, status: { $ne: 'Done' } });
    const dayDiff = Math.ceil((projectEndDate - projectStartDate) / (1000 * 60 * 60 * 24));
    
    const plannedValueCurve = [];
    let cumulativePlanned = 0;

    // Calculate daily fixed costs
    const dailyFixedCost = fixedCosts.reduce((sum, fc) => {
      let daily = 0;
      if (fc.frequency === 'monthly') daily = fc.amount / 30;
      else if (fc.frequency === 'weekly') daily = fc.amount / 7;
      else if (fc.frequency === 'yearly') daily = fc.amount / 365;
      else if (fc.frequency === 'daily') daily = fc.amount;
      return sum + daily;
    }, 0);

    for (let i = 0; i <= dayDiff; i++) {
      const currentDate = new Date(projectStartDate);
      currentDate.setDate(projectStartDate.getDate() + i);

      let dailyTaskPlannedSpend = 0;

      tasks.forEach(task => {
        if (task.deadline && task.createdAt) {
          const tStart = new Date(task.createdAt);
          const tEnd = new Date(task.deadline);

          if (currentDate >= tStart && currentDate <= tEnd) {
            const tDurationDays = Math.max(1, (tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24));
            
            // Estimate cost based on time logs or default rate
            const estimatedHours = task.timeLogs?.reduce((sum, log) => sum + (log.duration || 0), 0) / 3600 || 8;
            const hourlyRate = 50; // Default or from member hourlyRate
            const estimatedTaskCost = estimatedHours * hourlyRate;
            
            dailyTaskPlannedSpend += estimatedTaskCost / tDurationDays;
          }
        }
      });

      cumulativePlanned += dailyFixedCost + dailyTaskPlannedSpend;

      plannedValueCurve.push({
        date: currentDate.toISOString().split('T')[0],
        plannedValue: cumulativePlanned,
      });
    }

    return plannedValueCurve;
  } catch (error) {
    logger.error(`Budget Engine Error: ${error.message}`, { error });
    throw error;
  }
};

/**
 * Calculate Actual Cost from time logs and transactions
 */
export const calculateActualCost = async (projectId) => {
  try {
    const tasks = await Task.find({ projectId });
    const transactions = await Transaction.find({ projectId });

    // Calculate from time logs
    let taskCostSum = 0;
    tasks.forEach(task => {
      task.timeLogs?.forEach(log => {
        if (log.duration) {
          const hours = log.duration / 3600;
          const hourlyRate = 50; // Should come from member hourlyRate
          taskCostSum += hours * hourlyRate;
        }
      });
    });

    // Calculate from transactions
    const transactionSum = transactions.reduce((sum, t) => {
      return sum + (t.type === '+' ? t.amount : -t.amount);
    }, 0);

    return taskCostSum + transactionSum;
  } catch (error) {
    logger.error(`Actual Cost Calculation Error: ${error.message}`, { error });
    throw error;
  }
};


