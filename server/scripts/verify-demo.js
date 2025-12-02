/**
 * Demo Projects Verification Script
 * 
 * Verifies that demo projects were seeded correctly and financial calculations are accurate
 * 
 * Usage: node server/scripts/verify-demo.js
 * Or: npm run verify:demo (if added to package.json)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Project from '../models/Project.js';
import Expense from '../models/Expense.js';
import { calculateAC, calculateDailyRate } from '../services/evmEngine.js';
import { normalizeDate } from '../utils/dateUtils.js';

dotenv.config();

// Helper to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper to calculate months elapsed
const calculateMonthsElapsed = (startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const monthsElapsed = diffDays / 30.44; // Average days per month
  return Math.max(0, monthsElapsed);
};

// Helper to calculate fixed cost total for a period
const calculateFixedCostTotal = (fixedCosts, monthsElapsed) => {
  if (!fixedCosts || fixedCosts.length === 0) {
    return 0;
  }

  let total = 0;
  for (const cost of fixedCosts) {
    if (!cost.amount || cost.amount === 0) {
      continue;
    }

    let costForPeriod = 0;
    switch (cost.frequency) {
      case 'daily':
        costForPeriod = cost.amount * (monthsElapsed * 30.44);
        break;
      case 'weekly':
        costForPeriod = cost.amount * (monthsElapsed * 4.33);
        break;
      case 'monthly':
        costForPeriod = cost.amount * monthsElapsed;
        break;
      case 'yearly':
        costForPeriod = cost.amount * (monthsElapsed / 12);
        break;
      case 'one-time':
        costForPeriod = cost.amount; // One-time costs apply once
        break;
      default:
        costForPeriod = cost.amount * monthsElapsed; // Default to monthly
    }
    total += costForPeriod;
  }

  return total;
};

// Helper to calculate expense total
const calculateExpenseTotal = (expenses) => {
  if (!expenses || expenses.length === 0) {
    return 0;
  }

  let total = 0;
  const today = normalizeDate(new Date());

  for (const expense of expenses) {
    if (!expense.amount || expense.amount === 0) {
      continue;
    }

    const expenseDate = normalizeDate(expense.createdAt);
    const monthsSinceExpense = calculateMonthsElapsed(expenseDate, today);

    let expenseAmount = 0;
    switch (expense.frequency) {
      case 'daily':
        expenseAmount = expense.amount * (monthsSinceExpense * 30.44);
        break;
      case 'weekly':
        expenseAmount = expense.amount * (monthsSinceExpense * 4.33);
        break;
      case 'monthly':
        expenseAmount = expense.amount * monthsSinceExpense;
        break;
      case 'yearly':
        expenseAmount = expense.amount * (monthsSinceExpense / 12);
        break;
      default:
        expenseAmount = expense.amount * monthsSinceExpense; // Default to monthly
    }
    total += expenseAmount;
  }

  return total;
};

// Helper to calculate manual AC (matching calculateAC logic exactly)
const calculateManualAC = async (project, today) => {
  const projectStartDate = normalizeDate(project.createdAt);
  const targetDate = normalizeDate(today);

  // 1. Calculate salary costs (using daily rate * days, matching calculateAC)
  let salaryCosts = 0;
  
  // Populate members with user details to get monthlySalary
  await project.populate('members.userId', 'monthlySalary');
  
  for (const member of project.members) {
    const user = member.userId;
    if (!user || !user.monthlySalary || user.monthlySalary === 0) {
      continue;
    }

    // Calculate daily rate (matching calculateAC logic)
    const dailyRate = calculateDailyRate(user.monthlySalary, project.workSchedule);
    
    // Calculate days from project start to target date (matching calculateAC)
    const daysSinceStart = Math.max(0, Math.ceil((targetDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)));
    salaryCosts += dailyRate * daysSinceStart;
  }

  // 2. Calculate expenses from Expense collection (matching calculateAC logic)
  let expensesTotal = 0;
  const expenses = await Expense.find({ projectId: project._id }).lean();
  
  for (const expense of expenses) {
    if (!expense.amount || expense.amount === 0) {
      continue;
    }

    const expenseStartDate = normalizeDate(expense.createdAt || projectStartDate);
    if (targetDate.getTime() >= expenseStartDate.getTime()) {
      const daysSinceExpenseStart = Math.max(0, Math.ceil((targetDate.getTime() - expenseStartDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      let expenseCost = 0;
      switch (expense.frequency) {
        case 'daily':
          expenseCost = expense.amount * daysSinceExpenseStart;
          break;
        case 'weekly':
          expenseCost = expense.amount * Math.ceil(daysSinceExpenseStart / 7);
          break;
        case 'monthly':
          expenseCost = expense.amount * Math.ceil(daysSinceExpenseStart / 30.44);
          break;
        case 'yearly':
          expenseCost = expense.amount * Math.ceil(daysSinceExpenseStart / 365);
          break;
        default:
          expenseCost = expense.amount * Math.ceil(daysSinceExpenseStart / 30.44); // Default to monthly
      }
      expensesTotal += expenseCost;
    }
  }

  // 3. Calculate fixed costs (matching calculateAC logic)
  let fixedCostsTotal = 0;
  if (project.fixedCosts && Array.isArray(project.fixedCosts) && project.fixedCosts.length > 0) {
    for (const fixedCost of project.fixedCosts) {
      if (!fixedCost || typeof fixedCost !== 'object') {
        continue;
      }
      
      const amount = typeof fixedCost.amount === 'number' ? fixedCost.amount : 0;
      if (amount <= 0) {
        continue;
      }
      
      const fixedCostStartDate = normalizeDate(projectStartDate);
      if (targetDate.getTime() >= fixedCostStartDate.getTime()) {
        const daysSinceStart = Math.max(0, Math.ceil((targetDate.getTime() - fixedCostStartDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        let fixedCostAmount = 0;
        const frequency = fixedCost.frequency || 'monthly';
        
        switch (frequency) {
          case 'daily':
            fixedCostAmount = amount * daysSinceStart;
            break;
          case 'weekly':
            fixedCostAmount = amount * Math.ceil(daysSinceStart / 7);
            break;
          case 'monthly':
            fixedCostAmount = amount * Math.ceil(daysSinceStart / 30.44);
            break;
          case 'yearly':
            fixedCostAmount = amount * Math.ceil(daysSinceStart / 365);
            break;
          case 'one-time':
            fixedCostAmount = amount;
            break;
          default:
            fixedCostAmount = amount * Math.ceil(daysSinceStart / 30.44); // Default to monthly
        }
        fixedCostsTotal += fixedCostAmount;
      }
    }
  }

  // Manual AC = Salaries + Fixed Costs + Expenses (matching calculateAC)
  const manualAC = salaryCosts + fixedCostsTotal + expensesTotal;
  const monthsElapsed = calculateMonthsElapsed(projectStartDate, today);

  return {
    manualAC,
    breakdown: {
      salaryCosts,
      fixedCostsTotal,
      expensesTotal,
      monthsElapsed,
    },
  };
};

// Main verification function
const verifyDemoProjects = async () => {
  try {
    console.log('🔍 Starting Demo Projects Verification...\n');

    // Connect to database
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbm-logic-v4';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find owner user
    const owner = await User.findOne({ email: 'owner@kbm.com' });
    if (!owner) {
      console.error('❌ Owner user (owner@kbm.com) not found!');
      await mongoose.connection.close();
      process.exit(1);
    }
    console.log(`✅ Owner found: ${owner.email} (ID: ${owner._id})\n`);

    // Find demo projects
    const projectNames = ['AI Analytics Platform', 'Marketing Website Redesign'];
    const projects = await Project.find({
      name: { $in: projectNames },
      isDeleted: { $ne: true },
    });

    if (projects.length === 0) {
      console.error('❌ No demo projects found!');
      console.error('   Expected projects: AI Analytics Platform, Marketing Website Redesign');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ Found ${projects.length} demo project(s)\n`);
    console.log('='.repeat(80));
    console.log('='.repeat(80));
    console.log();

    const today = new Date();

    // Verify each project
    for (const project of projects) {
      console.log(`=== PROJECT: ${project.name} ===\n`);

      // 1. Project Identification
      console.log('📋 Project Identification:');
      const isOwnerCorrect = project.ownerId.toString() === owner._id.toString();
      if (isOwnerCorrect) {
        console.log(`   [PASS] Owner: owner@kbm.com`);
      } else {
        console.log(`   [FAIL] Owner mismatch! Expected: ${owner._id}, Got: ${project.ownerId}`);
      }
      console.log(`   [INFO] Project ID: ${project._id}`);
      console.log(`   [INFO] Created: ${project.createdAt.toISOString().split('T')[0]}`);
      console.log();

      // 2. Team & Salary Audit
      console.log('👥 Team & Salary Audit:');
      
      // Populate members with user details
      await project.populate('members.userId', 'displayName email monthlySalary');
      
      const memberCount = project.members?.length || 0;
      console.log(`   [INFO] Team Size: ${memberCount} members`);
      console.log();

      let totalMonthlySalaries = 0;
      const membersList = [];

      for (const member of project.members || []) {
        const user = member.userId;
        if (!user) {
          continue;
        }

        const roles = member.roles && member.roles.length > 0 
          ? member.roles.join(', ') 
          : (member.roleName || 'Unknown');
        
        const monthlySalary = user.monthlySalary || 0;
        totalMonthlySalaries += monthlySalary;

        const displayName = user.displayName || user.email?.split('@')[0] || 'Unknown';
        membersList.push({
          name: displayName,
          email: user.email,
          roles,
          salary: monthlySalary,
          joinedAt: member.joinedAt || project.createdAt,
        });

        console.log(`      - ${displayName} (${roles}): ${formatCurrency(monthlySalary)}/mo`);
      }

      console.log();
      console.log(`   [INFO] Total Monthly Team Cost: ${formatCurrency(totalMonthlySalaries)}`);
      console.log();

      // 3. Financial Structure Audit
      console.log('💰 Financial Structure Audit:');
      
      // Fixed Costs
      const fixedCosts = project.fixedCosts || [];
      console.log(`   [INFO] Fixed Costs (${fixedCosts.length} items):`);
      let totalFixedCostsMonthly = 0;
      
      for (const cost of fixedCosts) {
        const frequency = cost.frequency || 'monthly';
        const amount = cost.amount || 0;
        totalFixedCostsMonthly += amount;
        console.log(`      - ${cost.title}: ${formatCurrency(amount)}/${frequency}`);
      }
      
      console.log(`   [INFO] Total Monthly Fixed Costs: ${formatCurrency(totalFixedCostsMonthly)}`);
      console.log();

      // Expenses
      const expenses = await Expense.find({ projectId: project._id }).lean();
      console.log(`   [INFO] Expenses (${expenses.length} items):`);
      let totalExpensesOneTime = 0;
      
      for (const expense of expenses) {
        const amount = expense.amount || 0;
        const frequency = expense.frequency || 'monthly';
        const createdAt = expense.createdAt ? new Date(expense.createdAt).toISOString().split('T')[0] : 'Unknown';
        
        // For one-time expenses, add to total
        if (frequency === 'monthly' && expense.createdAt) {
          // This is a recurring expense, but we'll count it as one-time for simplicity
          totalExpensesOneTime += amount;
        } else {
          totalExpensesOneTime += amount;
        }
        
        console.log(`      - ${expense.name}: ${formatCurrency(amount)}/${frequency} (${createdAt})`);
      }
      
      console.log(`   [INFO] Total Expenses (one-time equivalent): ${formatCurrency(totalExpensesOneTime)}`);
      console.log();

      // 4. Deep Logic Verification
      console.log('🧪 Actual Cost (AC) Verification:');
      
      // Calculate months elapsed
      const projectStartDate = normalizeDate(project.createdAt);
      const monthsElapsed = calculateMonthsElapsed(projectStartDate, today);
      console.log(`   [INFO] Months Elapsed: ${monthsElapsed.toFixed(2)}`);
      console.log();

      // System's calculated AC
      let systemAC = 0;
      try {
        systemAC = await calculateAC(project, today);
        console.log(`   [INFO] System Calculated AC: ${formatCurrency(systemAC)}`);
      } catch (error) {
        console.error(`   [ERROR] Failed to calculate system AC: ${error.message}`);
        console.error(`   [ERROR] Stack: ${error.stack}`);
      }
      console.log();

      // Manual calculation
      const manualResult = await calculateManualAC(project, today);
      const manualAC = manualResult.manualAC;
      const breakdown = manualResult.breakdown;

      console.log(`   [INFO] Manual Calculation Breakdown:`);
      console.log(`      - Salary Costs: ${formatCurrency(breakdown.salaryCosts)}`);
      console.log(`      - Fixed Costs: ${formatCurrency(breakdown.fixedCostsTotal)}`);
      console.log(`      - Expenses: ${formatCurrency(breakdown.expensesTotal)}`);
      console.log(`      - Total Manual AC: ${formatCurrency(manualAC)}`);
      console.log();

      // Comparison
      const difference = Math.abs(systemAC - manualAC);
      const tolerance = 1; // $1 tolerance for rounding differences
      const isMatch = difference <= tolerance;

      if (isMatch) {
        console.log(`   [PASS] AC Verification: System and Manual calculations match!`);
        if (difference > 0) {
          console.log(`   [INFO] Difference: ${formatCurrency(difference)} (within tolerance)`);
        }
      } else {
        console.log(`   [FAIL] AC Verification: Mismatch detected!`);
        console.log(`   [INFO] Difference: ${formatCurrency(difference)}`);
        console.log(`   [INFO] System AC: ${formatCurrency(systemAC)}`);
        console.log(`   [INFO] Manual AC: ${formatCurrency(manualAC)}`);
      }
      console.log();

      // Burn Rate Calculation
      console.log('📊 Burn Rate Analysis:');
      const monthlyBurnRate = totalMonthlySalaries + totalFixedCostsMonthly;
      console.log(`   [INFO] Monthly Burn Rate: ${formatCurrency(monthlyBurnRate)}`);
      console.log(`      - Salaries: ${formatCurrency(totalMonthlySalaries)}`);
      console.log(`      - Fixed Costs: ${formatCurrency(totalFixedCostsMonthly)}`);
      
      if (monthsElapsed > 0) {
        const averageBurnRate = systemAC / monthsElapsed;
        console.log(`   [INFO] Average Burn Rate (from AC): ${formatCurrency(averageBurnRate)}/month`);
      }
      console.log();

      // Departments Check
      if (project.departments && project.departments.length > 0) {
        console.log('🏢 Departments:');
        console.log(`   [INFO] Number of Departments: ${project.departments.length}`);
        for (const dept of project.departments) {
          const memberCount = dept.memberIds?.length || 0;
          console.log(`      - ${dept.name}: ${memberCount} members`);
        }
        console.log();
      }

      // Custom Roles Check
      if (project.customRoles && project.customRoles.length > 0) {
        console.log('🎭 Custom Roles:');
        console.log(`   [INFO] Number of Custom Roles: ${project.customRoles.length}`);
        for (const role of project.customRoles) {
          const permissionCount = role.permissions?.length || 0;
          console.log(`      - ${role.name}: ${permissionCount} permissions`);
        }
        console.log();
      }

      console.log('='.repeat(80));
      console.log();
    }

    // Summary
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Verified ${projects.length} project(s)`);
    console.log(`✅ All checks completed`);
    console.log('='.repeat(80));

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification error:', error);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run verification
verifyDemoProjects();

