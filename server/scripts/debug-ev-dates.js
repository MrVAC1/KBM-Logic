/**
 * Diagnostic Script - EV Date Integrity Check
 * 
 * Verifies that task completion dates (updatedAt) are correctly stored in the database
 * and not overwritten by Mongoose defaults.
 * 
 * Usage: node server/scripts/debug-ev-dates.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

import Project from '../models/Project.js';
import Task from '../models/Task.js';

const debugEVDates = async () => {
  try {
    console.log('🔍 Starting EV Date Integrity Diagnostic...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in .env');
    }

    const connectionOptions = mongoUri.includes('mongodb+srv://') ? {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    } : {};

    await mongoose.connect(mongoUri, connectionOptions);
    console.log('✅ Connected to MongoDB\n');

    // Find the project
    const project = await Project.findOne({ 
      name: 'SaaS Platform 2.0 (Ideal State)'
    });

    if (!project) {
      console.error('❌ Project "SaaS Platform 2.0 (Ideal State)" not found!');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found project: ${project.name} (${project._id})\n`);

    // Fetch all completed tasks
    const completedTasks = await Task.find({
      projectId: project._id,
      status: 'Done'
    }).sort({ updatedAt: 1 }).lean(); // Sort by updatedAt ascending

    console.log(`📊 Found ${completedTasks.length} completed tasks\n`);

    if (completedTasks.length === 0) {
      console.log('⚠️  No completed tasks found. Cannot diagnose EV issue.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Analyze dates
    let tasksWithTodayDate = 0;
    let tasksWithHistoricalDate = 0;
    const dateDistribution = {};

    completedTasks.forEach(task => {
      const updatedAt = task.updatedAt ? new Date(task.updatedAt) : null;
      const createdAt = task.createdAt ? new Date(task.createdAt) : null;
      
      if (updatedAt) {
        const updatedAtStr = updatedAt.toISOString().split('T')[0];
        
        // Check if updatedAt is today
        if (updatedAtStr === todayStr) {
          tasksWithTodayDate++;
        } else {
          tasksWithHistoricalDate++;
        }

        // Track date distribution
        const monthKey = updatedAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        dateDistribution[monthKey] = (dateDistribution[monthKey] || 0) + 1;
      }
    });

    // Print summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📈 DATE DISTRIBUTION ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Completed Tasks: ${completedTasks.length}`);
    console.log(`Tasks with updatedAt = Today (${todayStr}): ${tasksWithTodayDate}`);
    console.log(`Tasks with updatedAt = Historical: ${tasksWithHistoricalDate}\n`);

    if (tasksWithTodayDate > 0) {
      console.log('⚠️  WARNING: Some tasks have updatedAt set to today!');
      console.log('   This indicates Mongoose may have overwritten historical dates.\n');
    }

    console.log('📅 Date Distribution by Month:');
    Object.entries(dateDistribution)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .forEach(([month, count]) => {
        console.log(`   ${month}: ${count} tasks`);
      });
    console.log('');

    // Print sample of 10 random tasks (or all if less than 10)
    const sampleSize = Math.min(10, completedTasks.length);
    const sampleTasks = [];
    
    if (completedTasks.length <= 10) {
      sampleTasks.push(...completedTasks);
    } else {
      // Get random sample
      const indices = new Set();
      while (indices.size < sampleSize) {
        indices.add(Math.floor(Math.random() * completedTasks.length));
      }
      Array.from(indices).forEach(idx => {
        sampleTasks.push(completedTasks[idx]);
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 SAMPLE TASKS (${sampleSize} of ${completedTasks.length})`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Print table header
    console.log('Title'.padEnd(40) + ' | ' + 
                'updatedAt'.padEnd(20) + ' | ' + 
                'createdAt'.padEnd(20) + ' | ' +
                'Days Ago');
    console.log('-'.repeat(120));

    sampleTasks.forEach(task => {
      const updatedAt = task.updatedAt ? new Date(task.updatedAt) : null;
      const createdAt = task.createdAt ? new Date(task.createdAt) : null;
      
      const updatedAtStr = updatedAt ? updatedAt.toISOString().split('T')[0] : 'N/A';
      const createdAtStr = createdAt ? createdAt.toISOString().split('T')[0] : 'N/A';
      
      let daysAgo = 'N/A';
      if (updatedAt) {
        const diffMs = today.getTime() - updatedAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        daysAgo = diffDays.toString();
      }

      const title = (task.title || 'Untitled').substring(0, 40);
      
      console.log(
        title.padEnd(40) + ' | ' +
        updatedAtStr.padEnd(20) + ' | ' +
        createdAtStr.padEnd(20) + ' | ' +
        daysAgo
      );
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (tasksWithTodayDate === completedTasks.length) {
      console.log('❌ CRITICAL: ALL tasks have updatedAt = Today!');
      console.log('   Root Cause: Mongoose is overwriting updatedAt during creation.');
      console.log('   Solution: Use { timestamps: false } or explicitly set updatedAt after creation.\n');
    } else if (tasksWithTodayDate > completedTasks.length * 0.5) {
      console.log('⚠️  WARNING: More than 50% of tasks have updatedAt = Today!');
      console.log('   This suggests partial overwriting of historical dates.\n');
    } else if (tasksWithHistoricalDate > 0) {
      console.log('✅ GOOD: Tasks have historical updatedAt dates.');
      console.log('   If EV is still 0, the issue may be in calculateEV() logic.\n');
    }

    // Check for tasks with missing updatedAt
    const tasksWithoutUpdatedAt = completedTasks.filter(t => !t.updatedAt);
    if (tasksWithoutUpdatedAt.length > 0) {
      console.log(`⚠️  WARNING: ${tasksWithoutUpdatedAt.length} tasks are missing updatedAt field!`);
      console.log('   These tasks will not contribute to EV calculation.\n');
    }

    // Check project start date vs earliest task
    const earliestTask = completedTasks[0];
    if (earliestTask && earliestTask.updatedAt) {
      const earliestDate = new Date(earliestTask.updatedAt);
      const projectStart = new Date(project.createdAt);
      
      console.log('📅 Timeline Check:');
      console.log(`   Project Start: ${projectStart.toISOString().split('T')[0]}`);
      console.log(`   Earliest Task Completion: ${earliestDate.toISOString().split('T')[0]}`);
      
      if (earliestDate < projectStart) {
        console.log('   ⚠️  Some tasks completed before project start (may be intentional).');
      } else if (earliestDate.getTime() === projectStart.getTime()) {
        console.log('   ✅ Tasks start from project creation date.');
      } else {
        const daysDiff = Math.floor((earliestDate.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   ℹ️  First task completed ${daysDiff} days after project start.`);
      }
      console.log('');
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the diagnostic
debugEVDates();

