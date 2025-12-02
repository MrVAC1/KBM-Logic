/**
 * Scenario Seeding Script
 * 
 * Creates TWO projects named "Marketing Website Redesign" with opposite financial health:
 * - Scenario A: Critical/Red (Over Budget, High Burn Rate)
 * - Scenario B: Healthy/Green (Under Budget, Low Burn Rate)
 * 
 * Usage: node server/scripts/seed-scenarios.js
 * Or: npm run seed:scenarios (if added to package.json)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Project, { ALL_PERMISSIONS } from '../models/Project.js';
import Expense from '../models/Expense.js';
import Task from '../models/Task.js';
import Transaction from '../models/Transaction.js';

dotenv.config();

// Helper to generate a simple UID from email (for seeding purposes)
const generateUID = (email) => {
  return `seed_${Buffer.from(email).toString('base64').slice(0, 20)}`;
};

// Helper to find or create user
const findOrCreateUser = async (email, displayName, monthlySalary) => {
  let user = await User.findOne({ email });
  if (!user) {
    const uid = generateUID(email);
    user = await User.create({
      uid,
      email,
      displayName,
      monthlySalary,
      emailVerified: true,
    });
    console.log(`✅ Created user: ${email} (${displayName})`);
  } else {
    // Update salary if provided
    if (monthlySalary && user.monthlySalary !== monthlySalary) {
      user.monthlySalary = monthlySalary;
      await user.save();
      console.log(`✅ Updated user salary: ${email} -> $${monthlySalary}/month`);
    }
    console.log(`✅ Found existing user: ${email}`);
  }
  return user;
};

// Helper to get role permissions
const getRolePermissions = (roleName) => {
  const defaultRoles = Project.getDefaultRoles();
  const roleDef = defaultRoles.find(r => r.name === roleName);
  return roleDef ? roleDef.permissions : [];
};

// Helper to get role color
const getRoleColor = (roleName) => {
  const colorMap = {
    'Developer': '#3b82f6',
    'QA': '#10b981',
    'Designer': '#8b5cf6',
    'Manager': '#f59e0b',
  };
  return colorMap[roleName] || '#6b7280';
};

// Helper to get role hierarchy
const getRoleHierarchy = (roleName) => {
  const hierarchyMap = {
    'Manager': 10,
    'Developer': 20,
    'Designer': 30,
    'QA': 40,
  };
  return hierarchyMap[roleName] || 50;
};

const seedScenarios = async () => {
  try {
    console.log('🌱 Starting Scenario Seeding...');

    // Connect to database
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in .env file');
      console.error('   Please set MONGODB_URI in server/.env file with your MongoDB Atlas connection string');
      process.exit(1);
    }
    
    // Security check: Warn if using local MongoDB
    if (MONGODB_URI.includes('localhost') || MONGODB_URI.includes('127.0.0.1')) {
      console.warn('⚠️  WARNING: Connection string points to local MongoDB, not Atlas!');
      console.warn('   Please update MONGODB_URI in .env file to use Atlas connection string.');
    }
    
    const connectionOptions = MONGODB_URI.includes('mongodb+srv://') ? {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    } : {};
    
    await mongoose.connect(MONGODB_URI, connectionOptions);
    console.log('✅ Connected to MongoDB');

    // Find or create owner
    const owner = await findOrCreateUser('owner@kbm.com', 'Project Owner', 10000);
    console.log(`✅ Owner ready: ${owner.email}\n`);

    // ============================================
    // SCENARIO A: CRITICAL/RED (Over Budget)
    // ============================================
    console.log('🔴 Creating Scenario A: Marketing Website Redesign (Critical/Red)...');

    // Delete existing project if it exists
    const existingProjectA = await Project.findOne({ name: 'Marketing Website Redesign (Critical)' });
    if (existingProjectA) {
      await Task.deleteMany({ projectId: existingProjectA._id });
      await Expense.deleteMany({ projectId: existingProjectA._id });
      await Transaction.deleteMany({ projectId: existingProjectA._id });
      await Project.deleteOne({ _id: existingProjectA._id });
      console.log('🗑️  Deleted existing Scenario A project');
    }

    // Create 15 team members with high salaries (High Burn Rate)
    const teamMembersA = [];
    const salariesA = [8000, 7500, 7000, 6500, 6000, 5500, 5000, 4500, 4000, 3500, 3000, 2500, 2000, 1500, 1000];
    for (let i = 0; i < 15; i++) {
      const member = await findOrCreateUser(
        `member${i + 1}@critical.com`,
        `Team Member ${i + 1}`,
        salariesA[i]
      );
      teamMembersA.push(member);
    }

    // Create Project A with LOW budget
    const projectA = await Project.create({
      name: 'Marketing Website Redesign (Critical)',
      description: 'Marketing website redesign project - CRITICAL scenario with low budget and high burn rate',
      ownerId: owner._id,
      members: teamMembersA.map((member, index) => ({
        userId: member._id,
        roles: index < 3 ? ['Manager'] : index < 8 ? ['Developer'] : index < 12 ? ['Designer'] : ['QA'],
        joinedAt: new Date(),
      })),
      workSchedule: {
        workingDaysPerWeek: 5,
        daysOffPerWeek: 2,
        hoursPerDay: 8,
      },
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      fixedCosts: [
        {
          name: 'High Server Costs',
          amount: 5000,
          frequency: 'monthly',
        },
        {
          name: 'Premium Software Licenses',
          amount: 2000,
          frequency: 'monthly',
        },
        {
          name: 'Marketing Tools',
          amount: 1000,
          frequency: 'monthly',
        },
      ],
    });

    // Create custom roles for project A
    const customRolesA = [
      {
        name: 'Manager',
        permissions: getRolePermissions('Manager'),
        color: getRoleColor('Manager'),
        hierarchy: getRoleHierarchy('Manager'),
      },
      {
        name: 'Developer',
        permissions: getRolePermissions('Developer'),
        color: getRoleColor('Developer'),
        hierarchy: getRoleHierarchy('Developer'),
      },
      {
        name: 'Designer',
        permissions: getRolePermissions('Designer'),
        color: getRoleColor('Designer'),
        hierarchy: getRoleHierarchy('Designer'),
      },
      {
        name: 'QA',
        permissions: getRolePermissions('QA'),
        color: getRoleColor('QA'),
        hierarchy: getRoleHierarchy('QA'),
      },
    ];
    projectA.customRoles = customRolesA;
    await projectA.save();

    // Create some tasks with estimates
    const tasksA = [];
    for (let i = 0; i < 10; i++) {
      const task = await Task.create({
        projectId: projectA._id,
        title: `Task ${i + 1}: Feature Development`,
        description: `Task description for feature ${i + 1}`,
        status: i < 3 ? 'Done' : i < 6 ? 'In Progress' : 'Todo',
        priority: i % 3 === 0 ? 'High' : 'Medium',
        complexity: i % 2 === 0 ? 'High' : 'Med',
        estimateHours: 20 + (i * 5),
        assignees: [teamMembersA[i % teamMembersA.length]._id],
        startDate: new Date(Date.now() - (10 - i) * 7 * 24 * 60 * 60 * 1000),
        deadline: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
      });
      tasksA.push(task);
    }

    // Create HIGH recurring expenses
    await Expense.create({
      projectId: projectA._id,
      name: 'High Server Infrastructure',
      amount: 5000,
      frequency: 'monthly',
      category: 'Infrastructure',
    });

    await Expense.create({
      projectId: projectA._id,
      name: 'Premium Development Tools',
      amount: 2000,
      frequency: 'monthly',
      category: 'Tools',
    });

    // Create CRITICAL transaction: $15,000 expense 1 month ago
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    await Transaction.create({
      projectId: projectA._id,
      amount: 15000,
      type: '-', // Expense
      source: 'Emergency Server Fix',
      date: oneMonthAgo,
      description: 'Emergency server infrastructure fix due to critical downtime',
      authorId: owner._id,
    });

    console.log('✅ Scenario A created successfully!');
    console.log(`   Project ID: ${projectA._id}`);
    console.log(`   Team Members: ${teamMembersA.length}`);
    console.log(`   Tasks: ${tasksA.length}`);
    console.log(`   Fixed Costs: $8,000/month`);
    console.log(`   Critical Transaction: -$15,000 (1 month ago)\n`);

    // ============================================
    // SCENARIO B: HEALTHY/GREEN (Under Budget)
    // ============================================
    console.log('🟢 Creating Scenario B: Marketing Website Redesign (Healthy/Green)...');

    // Delete existing project if it exists
    const existingProjectB = await Project.findOne({ name: 'Marketing Website Redesign (Healthy)' });
    if (existingProjectB) {
      await Task.deleteMany({ projectId: existingProjectB._id });
      await Expense.deleteMany({ projectId: existingProjectB._id });
      await Transaction.deleteMany({ projectId: existingProjectB._id });
      await Project.deleteOne({ _id: existingProjectB._id });
      console.log('🗑️  Deleted existing Scenario B project');
    }

    // Create 3 team members with moderate salaries (Low Burn Rate)
    const teamMembersB = [];
    const salariesB = [6000, 5000, 4000];
    for (let i = 0; i < 3; i++) {
      const member = await findOrCreateUser(
        `member${i + 1}@healthy.com`,
        `Team Member ${i + 1}`,
        salariesB[i]
      );
      teamMembersB.push(member);
    }

    // Create Project B with HIGH budget
    const projectB = await Project.create({
      name: 'Marketing Website Redesign (Healthy)',
      description: 'Marketing website redesign project - HEALTHY scenario with high budget and low burn rate',
      ownerId: owner._id,
      members: teamMembersB.map((member, index) => ({
        userId: member._id,
        roles: index === 0 ? ['Manager'] : index === 1 ? ['Developer'] : ['Designer'],
        joinedAt: new Date(),
      })),
      workSchedule: {
        workingDaysPerWeek: 5,
        daysOffPerWeek: 2,
        hoursPerDay: 8,
      },
      deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
      fixedCosts: [
        {
          name: 'Basic Server Costs',
          amount: 500,
          frequency: 'monthly',
        },
        {
          name: 'Standard Software Licenses',
          amount: 200,
          frequency: 'monthly',
        },
      ],
    });

    // Create custom roles for project B
    const customRolesB = [
      {
        name: 'Manager',
        permissions: getRolePermissions('Manager'),
        color: getRoleColor('Manager'),
        hierarchy: getRoleHierarchy('Manager'),
      },
      {
        name: 'Developer',
        permissions: getRolePermissions('Developer'),
        color: getRoleColor('Developer'),
        hierarchy: getRoleHierarchy('Developer'),
      },
      {
        name: 'Designer',
        permissions: getRolePermissions('Designer'),
        color: getRoleColor('Designer'),
        hierarchy: getRoleHierarchy('Designer'),
      },
    ];
    projectB.customRoles = customRolesB;
    await projectB.save();

    // Create some tasks with estimates
    const tasksB = [];
    for (let i = 0; i < 8; i++) {
      const task = await Task.create({
        projectId: projectB._id,
        title: `Task ${i + 1}: Feature Development`,
        description: `Task description for feature ${i + 1}`,
        status: i < 4 ? 'Done' : 'In Progress',
        priority: 'Medium',
        complexity: 'Med',
        estimateHours: 15 + (i * 3),
        assignees: [teamMembersB[i % teamMembersB.length]._id],
        startDate: new Date(Date.now() - (8 - i) * 10 * 24 * 60 * 60 * 1000),
        deadline: new Date(Date.now() + (i + 1) * 15 * 24 * 60 * 60 * 1000),
      });
      tasksB.push(task);
    }

    // Create LOW recurring expenses
    await Expense.create({
      projectId: projectB._id,
      name: 'Basic Server Infrastructure',
      amount: 500,
      frequency: 'monthly',
      category: 'Infrastructure',
    });

    // Create HEALTHY transaction: $50,000 income 2 months ago
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    await Transaction.create({
      projectId: projectB._id,
      amount: 50000,
      type: '+', // Income
      source: 'Client Upfront Payment',
      date: twoMonthsAgo,
      description: 'Client upfront payment for project milestone',
      authorId: owner._id,
    });

    console.log('✅ Scenario B created successfully!');
    console.log(`   Project ID: ${projectB._id}`);
    console.log(`   Team Members: ${teamMembersB.length}`);
    console.log(`   Tasks: ${tasksB.length}`);
    console.log(`   Fixed Costs: $700/month`);
    console.log(`   Healthy Transaction: +$50,000 (2 months ago)\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Scenario Seeding Completed Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Summary:');
    console.log('   Scenario A (Critical/Red):');
    console.log('     - Low budget, high burn rate');
    console.log('     - 15 team members');
    console.log('     - $8,000/month fixed costs');
    console.log('     - $15,000 emergency expense transaction');
    console.log('     - Expected: Over Budget (AC > PV)');
    console.log('\n   Scenario B (Healthy/Green):');
    console.log('     - High budget, low burn rate');
    console.log('     - 3 team members');
    console.log('     - $700/month fixed costs');
    console.log('     - $50,000 income transaction');
    console.log('     - Expected: Under Budget (AC < PV + Income)');
    console.log('\n🔍 Verify in Financial Dashboard:');
    console.log('   - Scenario A should show RED/Over Budget');
    console.log('   - Scenario B should show GREEN/Under Budget');
    console.log('   - Transaction Log should show the manual transactions');

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Scenario Seeding Error:', error);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedScenarios();

