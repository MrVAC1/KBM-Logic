/**
 * Earned Value (EV) Diagnostic Script
 * 
 * Diagnoses why completed tasks are not contributing to EV calculation
 * 
 * Usage: node server/scripts/debug-ev.js
 * Or: npm run debug:ev (if added to package.json)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { calculateEV, calculateHourlyRate } from '../services/evmEngine.js';

const { Types: { ObjectId } } = mongoose;

dotenv.config();

// Helper to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Recreate the EV calculation logic for analysis
const analyzeTaskForEV = async (task, project, targetDate) => {
  const analysis = {
    taskId: task._id.toString(),
    title: task.title || 'Untitled',
    status: task.status,
    estimateHours: task.estimateHours || 0,
    assignees: [],
    assigneesWithSalary: 0,
    totalHourlyRate: 0,
    taskBudget: 0,
    updatedAt: task.updatedAt ? new Date(task.updatedAt) : null,
    completedAt: task.updatedAt ? new Date(task.updatedAt) : null,
    isCompleted: false,
    isIncludedInEV: false,
    reasonsIgnored: [],
  };

  // Check 1: Status must be 'Done'
  const statusCheck = task.status === 'Done';
  analysis.isCompleted = statusCheck;
  
  if (!statusCheck) {
    analysis.reasonsIgnored.push(`Status is "${task.status}" (expected "Done")`);
  }

  // Check 2: Task must have estimateHours > 0
  if (!task.estimateHours || task.estimateHours === 0) {
    analysis.reasonsIgnored.push('estimateHours is 0 or missing');
  }

  // Check 3: Task must have assignees with salary
  if (!task.assignees || task.assignees.length === 0) {
    analysis.reasonsIgnored.push('No assignees');
  } else {
    // Populate assignees if they're ObjectIds (matching calculateEV logic)
    let assignees = task.assignees;
    
    // Check if assignees are already populated (have monthlySalary field)
    const firstAssignee = task.assignees[0];
    if (firstAssignee && typeof firstAssignee === 'object') {
      if (firstAssignee.monthlySalary !== undefined) {
        // Already populated by .populate('assignees', 'monthlySalary')
        assignees = task.assignees;
      } else if (firstAssignee._id || ObjectId.isValid(firstAssignee)) {
        // Need to populate - they're ObjectIds
        assignees = await User.find({ _id: { $in: task.assignees } }).select('monthlySalary email').lean();
      }
    }

    let totalHourlyRate = 0;
    let assigneesWithSalary = 0;

    for (const assignee of assignees) {
      const user = assignee;
      const monthlySalary = user?.monthlySalary || 0;
      
      analysis.assignees.push({
        userId: user._id?.toString() || 'Unknown',
        email: user.email || 'Unknown',
        monthlySalary: monthlySalary,
        hasSalary: monthlySalary > 0,
      });

      if (monthlySalary > 0) {
        const hourlyRate = calculateHourlyRate(monthlySalary, project.workSchedule);
        totalHourlyRate += hourlyRate;
        assigneesWithSalary++;
      }
    }

    analysis.assigneesWithSalary = assigneesWithSalary;
    analysis.totalHourlyRate = totalHourlyRate;

    if (assigneesWithSalary === 0) {
      analysis.reasonsIgnored.push('No assignees with monthlySalary > 0');
    } else {
      // Calculate task budget
      const averageHourlyRate = totalHourlyRate / assigneesWithSalary;
      analysis.taskBudget = (task.estimateHours || 0) * averageHourlyRate;
    }
  }

  // Check 4: Task must be completed before or on target date
  if (task.updatedAt) {
    const updatedAtDate = new Date(task.updatedAt);
    const targetDateObj = new Date(targetDate);
    if (updatedAtDate.getTime() > targetDateObj.getTime()) {
      analysis.reasonsIgnored.push(`Completed after target date (${targetDateObj.toISOString().split('T')[0]})`);
    }
  }

  // Final check: Is this task included in EV?
  analysis.isIncludedInEV = 
    statusCheck &&
    (task.estimateHours && task.estimateHours > 0) &&
    analysis.assigneesWithSalary > 0 &&
    (!task.updatedAt || new Date(task.updatedAt).getTime() <= new Date(targetDate).getTime());

  return analysis;
};

// Main diagnostic function
const debugEV = async () => {
  try {
    console.log('🔍 Starting Earned Value (EV) Diagnostic...\n');

    // Connect to database
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbm-logic-v4';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find target project
    const projectName = 'Marketing Website Redesign';
    const project = await Project.findOne({
      name: projectName,
      isDeleted: { $ne: true },
    });

    if (!project) {
      console.error(`❌ Project "${projectName}" not found!`);
      console.log('\n📋 Available projects:');
      const allProjects = await Project.find({ isDeleted: { $ne: true } }).select('name').limit(10);
      allProjects.forEach(p => console.log(`   - ${p.name}`));
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ Found project: ${project.name} (ID: ${project._id})\n`);
    console.log('='.repeat(80));
    console.log('='.repeat(80));
    console.log();

    // Get all tasks for this project
    const allTasks = await Task.find({ projectId: project._id }).lean();
    console.log(`📋 Total tasks in project: ${allTasks.length}\n`);

    if (allTasks.length === 0) {
      console.log('⚠️  No tasks found in this project. Cannot diagnose EV calculation.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Analyze task statuses
    const statusCounts = {};
    allTasks.forEach(task => {
      const status = task.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('📊 Task Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - "${status}": ${count} task(s)`);
    });
    console.log();

    // Filter tasks that might be "completed"
    const possibleCompletedStatuses = ['Done', 'done', 'Completed', 'completed', 'Finished', 'finished'];
    const completedTasks = allTasks.filter(task => {
      const status = task.status || '';
      return possibleCompletedStatuses.includes(status);
    });

    console.log(`✅ Found ${completedTasks.length} task(s) with "completed-like" status\n`);

    if (completedTasks.length === 0) {
      console.log('⚠️  No tasks found with completed status. EV will be 0.');
      console.log('\n💡 Tip: Check if tasks are marked as "Done" (case-sensitive) in the Kanban board.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Get project work schedule
    const workSchedule = project.workSchedule || {
      workingDaysPerWeek: 5,
      daysOffPerWeek: 2,
      hoursPerDay: 8,
    };

    // Target date for EV calculation (today)
    const targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);

    console.log('🔬 Analyzing Completed Tasks:\n');
    console.log('='.repeat(80));

    let totalEV = 0;
    const taskAnalyses = [];

    for (const task of completedTasks) {
      const analysis = await analyzeTaskForEV(task, project, targetDate);
      taskAnalyses.push(analysis);

      console.log(`\n📝 Task: "${analysis.title}"`);
      console.log(`   ID: ${analysis.taskId}`);
      console.log(`   Status: "${analysis.status}"`);
      console.log(`   Estimate Hours: ${analysis.estimateHours}`);
      console.log(`   Updated At: ${analysis.updatedAt ? analysis.updatedAt.toISOString() : 'N/A'}`);
      console.log(`   Assignees: ${analysis.assignees.length}`);
      
      if (analysis.assignees.length > 0) {
        console.log(`   Assignees Details:`);
        analysis.assignees.forEach((assignee, idx) => {
          console.log(`      ${idx + 1}. ${assignee.email} - Salary: ${assignee.hasSalary ? formatCurrency(assignee.monthlySalary) : 'N/A'}`);
        });
      }

      console.log(`   Assignees with Salary: ${analysis.assigneesWithSalary}`);
      console.log(`   Total Hourly Rate: ${formatCurrency(analysis.totalHourlyRate)}`);
      console.log(`   Task Budget: ${formatCurrency(analysis.taskBudget)}`);

      if (analysis.isIncludedInEV) {
        console.log(`   ✅ INCLUDED in EV calculation`);
        totalEV += analysis.taskBudget;
      } else {
        console.log(`   ❌ IGNORED by EV Engine`);
        if (analysis.reasonsIgnored.length > 0) {
          console.log(`   Reasons:`);
          analysis.reasonsIgnored.forEach(reason => {
            console.log(`      - ${reason}`);
          });
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:\n');

    const includedTasks = taskAnalyses.filter(a => a.isIncludedInEV);
    const ignoredTasks = taskAnalyses.filter(a => !a.isIncludedInEV);

    console.log(`   Total Completed Tasks: ${completedTasks.length}`);
    console.log(`   Included in EV: ${includedTasks.length}`);
    console.log(`   Ignored: ${ignoredTasks.length}`);
    console.log(`   Calculated EV: ${formatCurrency(totalEV)}`);

    // Calculate actual EV using the engine
    console.log('\n🔧 Running calculateEV() from evmEngine.js...');
    const actualEV = await calculateEV(project, targetDate);
    console.log(`   Engine EV Result: ${formatCurrency(actualEV)}`);

    if (Math.abs(totalEV - actualEV) < 0.01) {
      console.log(`   ✅ Manual calculation matches engine result!`);
    } else {
      console.log(`   ⚠️  Mismatch detected! Difference: ${formatCurrency(Math.abs(totalEV - actualEV))}`);
      console.log(`   💡 This might indicate additional filtering logic in calculateEV.`);
    }

    // Detailed breakdown of ignored tasks
    if (ignoredTasks.length > 0) {
      console.log('\n❌ IGNORED TASKS BREAKDOWN:\n');
      ignoredTasks.forEach((analysis, idx) => {
        console.log(`${idx + 1}. "${analysis.title}" (Status: "${analysis.status}")`);
        if (analysis.reasonsIgnored.length > 0) {
          analysis.reasonsIgnored.forEach(reason => {
            console.log(`   → ${reason}`);
          });
        }
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:\n');
    
    const statusMismatches = ignoredTasks.filter(a => a.reasonsIgnored.some(r => r.includes('Status')));
    if (statusMismatches.length > 0) {
      console.log(`   ⚠️  ${statusMismatches.length} task(s) have incorrect status:`);
      statusMismatches.forEach(a => {
        console.log(`      - "${a.title}": "${a.status}" (should be "Done")`);
      });
      console.log(`   → Fix: Update task status to exactly "Done" (case-sensitive)`);
    }

    const zeroHours = ignoredTasks.filter(a => a.reasonsIgnored.some(r => r.includes('estimateHours')));
    if (zeroHours.length > 0) {
      console.log(`   ⚠️  ${zeroHours.length} task(s) have zero estimateHours:`);
      zeroHours.forEach(a => {
        console.log(`      - "${a.title}"`);
      });
      console.log(`   → Fix: Set estimateHours > 0 for these tasks`);
    }

    const noAssignees = ignoredTasks.filter(a => a.reasonsIgnored.some(r => r.includes('assignees')));
    if (noAssignees.length > 0) {
      console.log(`   ⚠️  ${noAssignees.length} task(s) have no assignees or assignees without salary:`);
      noAssignees.forEach(a => {
        console.log(`      - "${a.title}"`);
      });
      console.log(`   → Fix: Assign users with monthlySalary > 0 to these tasks`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnostic complete');
    console.log('='.repeat(80));

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Diagnostic error:', error);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run diagnostic
debugEV();

