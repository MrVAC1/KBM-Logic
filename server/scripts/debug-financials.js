/**
 * Financial Engine Diagnostic Script
 * 
 * Debugs EV and AC calculations for Enterprise projects
 * 
 * Usage: node server/scripts/debug-financials.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { calculatePV, calculateAC, calculateEV, calculateBAC, countWorkingDaysInclusive, isWorkingDay } from '../services/evmEngine.js';
import { normalizeDate } from '../utils/dateUtils.js';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Helper function to calculate working days per month
function calculateWorkingDaysPerMonthLocal(workSchedule) {
  const workingDaysCount = Array.isArray(workSchedule?.workingDays) && workSchedule.workingDays.length > 0
    ? workSchedule.workingDays.length
    : 5; // Default Mon-Fri
  
  return (workingDaysCount / 7) * 30.4375;
}

// Helper function to resolve member role name
function resolveMemberRoleName(member) {
  if (!member) return null;
  if (member.roleName) return member.roleName;
  if (Array.isArray(member.roles) && member.roles.length > 0) return member.roles[0];
  return null;
}

// Helper function to resolve role rate for date
function resolveRoleRateForDate(project, roleName, targetDate = new Date()) {
  if (!roleName) return 0;
  const role = (project.roles || []).find(r => r.name === roleName);
  if (!role) return 0;

  const timeline = Array.isArray(role.salaryHistory) ? [...role.salaryHistory] : [];
  if (role.currentRate !== undefined) {
    timeline.push({
      rate: role.currentRate,
      effectiveDate: role.currentRateEffectiveDate || role.updatedAt || role.createdAt || new Date(),
    });
  }

  const sorted = timeline
    .filter(entry => entry && entry.rate !== undefined)
    .sort((a, b) => new Date(a.effectiveDate || 0) - new Date(b.effectiveDate || 0));

  let rate = role.currentRate || 0;
  const normalizedTarget = normalizeDate(targetDate);
  for (const entry of sorted) {
    const entryDate = normalizeDate(entry.effectiveDate || new Date(0));
    if (entryDate.getTime() <= normalizedTarget.getTime()) {
      rate = entry.rate;
    }
  }

  return rate || 0;
}

// Helper function to calculate hourly rate from monthly
function roleMonthlyRateToHourly(monthlyRate, workSchedule) {
  if (!monthlyRate || monthlyRate <= 0) return 0;
  const hoursPerDay = workSchedule?.hoursPerDay || 8;
  const workingDaysPerMonth = calculateWorkingDaysPerMonthLocal(workSchedule);
  const hoursPerMonth = hoursPerDay * workingDaysPerMonth;
  return hoursPerMonth > 0 ? monthlyRate / hoursPerMonth : 0;
}

async function debugFinancials() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    const connectionOptions = {
      serverSelectionTimeoutMS: 5000,
    };
    
    await mongoose.connect(MONGODB_URI, connectionOptions);
    console.log('✅ Connected to MongoDB\n');

    // Find owner
    const owner = await User.findOne({ email: 'owner@kbm.com' });
    if (!owner) {
      console.error('❌ Owner user (owner@kbm.com) not found');
      await mongoose.connection.close();
      process.exit(1);
    }
    console.log(`✅ Found owner: ${owner.email} (${owner._id})\n`);

    // Find Enterprise projects (owned by owner@kbm.com)
    const projects = await Project.find({ 
      ownerId: owner._id,
      isDeleted: { $ne: true }
    }).lean();

    if (projects.length === 0) {
      console.error('❌ No projects found for owner@kbm.com');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📊 Found ${projects.length} project(s) for owner@kbm.com\n`);

    for (const project of projects) {
      console.log('='.repeat(80));
      console.log(`📁 PROJECT: ${project.name}`);
      console.log(`   ID: ${project._id}`);
      console.log(`   Created: ${project.createdAt}`);
      console.log(`   Deadline: ${project.deadline || 'Not set'}`);
      console.log('='.repeat(80));
      console.log();

      // ============================================
      // DEBUG EV (Why is it 0?)
      // ============================================
      console.log('🔍 DEBUGGING EV (Earned Value)...\n');

      // Find tasks with different status variations
      const tasksDone = await Task.find({ 
        projectId: project._id,
        status: 'Done'
      }).lean();

      const tasksDoneLower = await Task.find({ 
        projectId: project._id,
        status: 'done'
      }).lean();

      const tasksDoneMixed = await Task.find({ 
        projectId: project._id,
        $or: [
          { status: 'Done' },
          { status: 'done' },
          { status: 'DONE' }
        ]
      }).lean();

      console.log(`   Tasks with status 'Done': ${tasksDone.length}`);
      console.log(`   Tasks with status 'done': ${tasksDoneLower.length}`);
      console.log(`   Tasks with any Done variation: ${tasksDoneMixed.length}\n`);

      if (tasksDoneMixed.length === 0) {
        console.log('   ⚠️  NO COMPLETED TASKS FOUND! This explains why EV = 0.\n');
        
        // Show task status distribution
        const allTasks = await Task.find({ projectId: project._id }).lean();
        const statusCounts = {};
        allTasks.forEach(task => {
          statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
        });
        console.log('   Task Status Distribution:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`     ${status}: ${count}`);
        });
        console.log();
      } else {
        // Pick first completed task for detailed analysis
        const sampleTask = tasksDoneMixed[0];
        console.log(`   📋 Analyzing Sample Task:`);
        console.log(`      Title: "${sampleTask.title}"`);
        console.log(`      ID: ${sampleTask._id}`);
        console.log(`      Status: "${sampleTask.status}" (exact string)`);
        console.log(`      estimateHours: ${sampleTask.estimateHours || 'MISSING'}`);
        console.log(`      assignees: ${JSON.stringify(sampleTask.assignees || [])}`);
        console.log(`      updatedAt: ${sampleTask.updatedAt}`);
        console.log();

        // Check assignees
        if (!sampleTask.assignees || sampleTask.assignees.length === 0) {
          console.log('   ⚠️  TASK HAS NO ASSIGNEES! This will cause EV = 0.\n');
        } else {
          console.log('   👥 Assignee Analysis:');
          const projectPopulated = await Project.findById(project._id).lean();
          
          for (const assigneeId of sampleTask.assignees) {
            const member = (projectPopulated.members || []).find(m => 
              m.userId && m.userId.toString() === assigneeId.toString()
            );
            
            if (!member) {
              console.log(`      ❌ Assignee ${assigneeId} NOT FOUND in project.members`);
            } else {
              const roleName = resolveMemberRoleName(member);
              console.log(`      ✅ Assignee ${assigneeId}:`);
              console.log(`         roleName: ${roleName || 'MISSING'}`);
              
              if (roleName) {
                const monthlyRate = resolveRoleRateForDate(projectPopulated, roleName, sampleTask.updatedAt || new Date());
                const workSchedule = projectPopulated.workSchedule || { workingDays: [1,2,3,4,5], hoursPerDay: 8 };
                const hourlyRate = roleMonthlyRateToHourly(monthlyRate, workSchedule);
                
                console.log(`         monthlyRate: $${monthlyRate}`);
                console.log(`         hourlyRate: $${hourlyRate.toFixed(2)}`);
                
                if (monthlyRate === 0) {
                  console.log(`         ⚠️  ROLE HAS NO RATE! This will cause EV = 0.`);
                }
                if (hourlyRate === 0) {
                  console.log(`         ⚠️  HOURLY RATE IS 0! This will cause EV = 0.`);
                }
              } else {
                console.log(`         ⚠️  NO ROLE ASSIGNED! This will cause EV = 0.`);
              }
            }
          }
          console.log();

          // Calculate Expected EV manually
          if (sampleTask.estimateHours && sampleTask.estimateHours > 0 && sampleTask.assignees && sampleTask.assignees.length > 0) {
            const projectPopulated = await Project.findById(project._id).lean();
            const hourlyRates = [];
            
            for (const assigneeId of sampleTask.assignees) {
              const member = (projectPopulated.members || []).find(m => 
                m.userId && m.userId.toString() === assigneeId.toString()
              );
              if (member) {
                const roleName = resolveMemberRoleName(member);
                if (roleName) {
                  const monthlyRate = resolveRoleRateForDate(projectPopulated, roleName, sampleTask.updatedAt || new Date());
                  const workSchedule = projectPopulated.workSchedule || { workingDays: [1,2,3,4,5], hoursPerDay: 8 };
                  const hourlyRate = roleMonthlyRateToHourly(monthlyRate, workSchedule);
                  if (hourlyRate > 0) {
                    hourlyRates.push(hourlyRate);
                  }
                }
              }
            }
            
            if (hourlyRates.length > 0) {
              const avgHourlyRate = hourlyRates.reduce((sum, rate) => sum + rate, 0) / hourlyRates.length;
              const expectedEV = sampleTask.estimateHours * avgHourlyRate;
              
              console.log('   🧮 Manual EV Calculation:');
              console.log(`      estimateHours: ${sampleTask.estimateHours}`);
              console.log(`      avgHourlyRate: $${avgHourlyRate.toFixed(2)}`);
              console.log(`      Expected EV: $${expectedEV.toFixed(2)}`);
              console.log();
            } else {
              console.log('   ⚠️  NO VALID HOURLY RATES FOUND! Expected EV = 0.\n');
            }
          } else {
            console.log('   ⚠️  TASK MISSING estimateHours OR ASSIGNEES! Expected EV = 0.\n');
          }
        }

        // Get system-calculated EV
        const systemEV = await calculateEV(project, new Date());
        console.log(`   💻 System-Calculated EV: $${systemEV.toFixed(2)}`);
        console.log();
      }

      // ============================================
      // DEBUG AC (Is 1M correct?)
      // ============================================
      console.log('🔍 DEBUGGING AC (Actual Cost)...\n');

      const projectStartDate = normalizeDate(project.createdAt || new Date());
      const today = normalizeDate(new Date());
      const daysSinceStart = Math.ceil((today.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`   Project Start Date: ${projectStartDate.toISOString()}`);
      console.log(`   Today: ${today.toISOString()}`);
      console.log(`   Days Since Start: ${daysSinceStart}`);
      console.log();

      // Get work schedule
      const workSchedule = project.workSchedule || { workingDays: [1,2,3,4,5], hoursPerDay: 8 };
      const workingDaysPerMonth = calculateWorkingDaysPerMonthLocal(workSchedule);
      const workingDaysSinceStart = countWorkingDaysInclusive(projectStartDate, today, workSchedule);
      
      console.log(`   Work Schedule: ${JSON.stringify(workSchedule)}`);
      console.log(`   Working Days Per Month: ${workingDaysPerMonth.toFixed(2)}`);
      console.log(`   Working Days Since Start: ${workingDaysSinceStart}`);
      console.log();

      // Calculate theoretical daily burn rate
      const members = project.members || [];
      console.log(`   Total Members: ${members.length}`);
      console.log();

      let totalMonthlyRates = 0;
      let memberDetails = [];

      for (const member of members) {
        const roleName = resolveMemberRoleName(member);
        if (roleName) {
          const monthlyRate = resolveRoleRateForDate(project, roleName, today);
          totalMonthlyRates += monthlyRate;
          
          memberDetails.push({
            roleName,
            monthlyRate,
            joinedAt: member.joinedAt || projectStartDate
          });
        }
      }

      console.log('   👥 Member Breakdown:');
      memberDetails.forEach((member, idx) => {
        const dailyRate = member.monthlyRate / workingDaysPerMonth;
        console.log(`      ${idx + 1}. ${member.roleName}: $${member.monthlyRate.toLocaleString()}/mo = $${dailyRate.toFixed(2)}/day`);
      });
      console.log();

      const theoreticalDailyBurn = totalMonthlyRates / workingDaysPerMonth;
      console.log(`   💰 Theoretical Daily Burn Rate: $${theoreticalDailyBurn.toFixed(2)}/day`);
      console.log(`      (Sum of all monthly rates: $${totalMonthlyRates.toLocaleString()})`);
      console.log(`      (Divided by ${workingDaysPerMonth.toFixed(2)} working days/month)`);
      console.log();

      // Sanity check
      if (theoreticalDailyBurn > 50000) {
        console.log('   ⚠️  WARNING: Daily burn rate > $50,000! This suggests a calculation bug.');
        console.log('      Check if monthly rates are being applied daily instead of monthly.\n');
      } else if (theoreticalDailyBurn > 10000) {
        console.log('   ⚠️  WARNING: Daily burn rate > $10,000! This is very high but might be correct for a large team.\n');
      } else {
        console.log('   ✅ Daily burn rate looks reasonable.\n');
      }

      // Calculate estimated total AC
      const estimatedTotalAC = theoreticalDailyBurn * workingDaysSinceStart;
      console.log(`   📊 Estimated Total AC: $${estimatedTotalAC.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      console.log(`      (Daily Burn: $${theoreticalDailyBurn.toFixed(2)} × ${workingDaysSinceStart} working days)`);
      console.log();

      // Get system-calculated AC
      const systemAC = await calculateAC(project, today);
      console.log(`   💻 System-Calculated AC: $${systemAC.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      console.log();

      // Compare
      const difference = Math.abs(systemAC - estimatedTotalAC);
      const percentDiff = estimatedTotalAC > 0 ? (difference / estimatedTotalAC) * 100 : 0;
      
      console.log(`   📈 Comparison:`);
      console.log(`      Difference: $${difference.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      console.log(`      Percent Difference: ${percentDiff.toFixed(2)}%`);
      
      if (percentDiff > 50) {
        console.log(`      ⚠️  LARGE DIFFERENCE! System AC differs significantly from theoretical estimate.`);
        console.log(`         This could be due to:`);
        console.log(`         - Expenses and transactions not included in theoretical calculation`);
        console.log(`         - Fixed costs not included in theoretical calculation`);
        console.log(`         - Member join dates (members who joined later)`);
        console.log(`         - Rate changes over time (salaryHistory)`);
      } else if (percentDiff > 20) {
        console.log(`      ⚠️  Moderate difference. Check for expenses, fixed costs, or rate changes.`);
      } else {
        console.log(`      ✅ AC calculation looks reasonable.`);
      }
      console.log();

      // Get BAC for reference
      const bac = await calculateBAC(project);
      console.log(`   📋 Budget at Completion (BAC): $${bac.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      console.log();
    }

    console.log('✅ Diagnostic complete!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the diagnostic
debugFinancials();

