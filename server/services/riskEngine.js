import Task from '../models/Task.js';
// Note: calculateActualCost from budgetEngine.js is deprecated
// This import is kept for backward compatibility but the function is not actively used
// The risk calculation does not currently use actual cost values
import logger from '../utils/logger.js';

/**
 * Auto-update risk score based on budget and deadline
 */
export const recalculateRisk = async (taskId, projectId) => {
  try {
    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found');

    if (!task.risk) {
      task.risk = {
        probability: 1,
        impact: 1,
        auto_score: 1,
        isAutoAdjusted: false,
      };
    }

    let autoAdjustReason = null;
    let newProbability = task.risk.probability;
    let newImpact = task.risk.impact;

    // Check deadline (if deadline < 2 days, increase probability)
    if (task.deadline) {
      const daysUntilDeadline = (new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 2 && task.status !== 'Done') {
        newProbability = Math.min(5, newProbability + 1);
        autoAdjustReason = 'Deadline approaching (< 2 days)';
      }
    }

    // Check budget (if actual > 100% of planned, increase probability)
    try {
      const actualCost = await calculateActualCost(projectId);
      // This would need project budget - simplified for now
      // If we had project budget, we'd check: if (actualCost > projectBudget) { ... }
    } catch (error) {
      logger.warn(`Risk Engine: Could not check budget: ${error.message}`);
    }

    // Calculate auto_score
    const autoScore = newProbability * newImpact;

    // Update task
    task.risk.probability = newProbability;
    task.risk.impact = newImpact;
    task.risk.auto_score = autoScore;
    task.risk.isAutoAdjusted = !!autoAdjustReason;
    task.risk.autoAdjustReason = autoAdjustReason;

    await task.save();
    return task.risk;
  } catch (error) {
    logger.error(`Risk Recalculation Error: ${error.message}`, { error });
    throw error;
  }
};


