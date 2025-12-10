/**
 * Database Seeding Script - KBM Logic v3.0 Realistic Demo Projects
 * 
 * Creates two realistic demo projects with proper role integrity:
 * - 🟢 Project 1: "NeoBank Mobile App" (Profitable, 10 months, high-performing team)
 * - 🔴 Project 2: "Legacy ERP Migration" (Failing, 12 months, bloated team)
 * 
 * Usage: node server/scripts/seed-demo-v3.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';
import Project, { ALL_PERMISSIONS } from '../models/Project.js';
import Task from '../models/Task.js';
import Transaction from '../models/Transaction.js';
import { calculateTaskPlannedCost } from '../services/taskCostCalculator.js';

// ============================================
// ROLE DEFINITIONS (Source of Truth)
// ============================================

/**
 * Project Alpha (NeoBank) - High-performing team roles
 * Each role includes: name, currentRate, color, and permissions
 */
const ALPHA_ROLES = [
  { 
    name: "Solutions Architect", 
    currentRate: 8000,
    color: '#3b82f6', // Blue
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_view_financial', 'can_create_tasks', 'can_edit_tasks', 'can_view_risks']
  },
  { 
    name: "Senior Backend Dev", 
    currentRate: 6000,
    color: '#22c55e', // Green
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "Frontend Lead", 
    currentRate: 5500,
    color: '#a855f7', // Purple
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "UI/UX Designer", 
    currentRate: 4000,
    color: '#f97316', // Orange
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "QA Engineer", 
    currentRate: 3000,
    color: '#eab308', // Yellow
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_edit_tasks']
  },
  { 
    name: "DevOps Engineer", 
    currentRate: 5000,
    color: '#3b82f6', // Blue
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "Product Manager", 
    currentRate: 6000,
    color: '#ef4444', // Red
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_view_financial', 'can_create_tasks', 'can_edit_tasks', 'can_view_risks']
  },
];

/**
 * Project Omega (Legacy ERP) - Expensive, bloated team roles
 * Each role includes: name, currentRate, color, and permissions
 */
const OMEGA_ROLES = [
  { 
    name: "External Consultant", 
    currentRate: 12000,
    color: '#ef4444', // Red
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_view_financial', 'can_create_tasks', 'can_edit_tasks', 'can_view_risks']
  },
  { 
    name: "System Architect", 
    currentRate: 9500,
    color: '#3b82f6', // Blue
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_view_financial', 'can_create_tasks', 'can_edit_tasks', 'can_view_risks']
  },
  { 
    name: "Legacy Code Expert", 
    currentRate: 7000,
    color: '#f97316', // Orange
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "Database Admin", 
    currentRate: 6000,
    color: '#22c55e', // Green
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "Junior Dev", 
    currentRate: 1500,
    color: '#6b7280', // Gray
    permissions: ['can_view_dashboard', 'can_view_tasks']
  },
  { 
    name: "DevOps Engineer", 
    currentRate: 6500,
    color: '#a855f7', // Purple
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "QA Lead", 
    currentRate: 4500,
    color: '#eab308', // Yellow
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "Project Manager", 
    currentRate: 6000,
    color: '#ef4444', // Red
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_view_financial', 'can_create_tasks', 'can_edit_tasks', 'can_view_risks']
  },
];

// Helper to generate a simple UID from email (for seeding purposes)
const generateUID = (email) => {
  return `seed_${Buffer.from(email).toString('base64').slice(0, 20)}`;
};

// Helper to get date N months ago
const monthsAgo = (months) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Helper to get date N days ago
const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Helper to get random date between two dates
const randomDateBetween = (startDate, endDate) => {
  const start = startDate.getTime();
  const end = endDate.getTime();
  const random = Math.random() * (end - start) + start;
  const date = new Date(random);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Helper to get random integer between min and max (inclusive)
const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Helper to get random task duration in days (3-20 days)
const randomTaskDuration = () => {
  return randomInt(3, 20);
};

/**
 * Convert role definitions to project.roles format (for financial compensation)
 * @param {Array} rolesConfig - Array of { name, currentRate, color, permissions }
 * @param {Date} effectiveDate - Effective date for salary history
 * @returns {Array} - Formatted roles array for project.roles
 */
const formatRolesForProject = (rolesConfig, effectiveDate) => {
  return rolesConfig.map(role => ({
    name: role.name,
    currentRate: role.currentRate,
    salaryHistory: [{ rate: role.currentRate, effectiveDate: effectiveDate }],
  }));
};

/**
 * Convert role definitions to project.customRoles format (for Roles tab UI)
 * @param {Array} rolesConfig - Array of { name, currentRate, color, permissions }
 * @param {Date} createdAt - Creation date
 * @returns {Array} - Formatted customRoles array
 */
const formatCustomRolesForProject = (rolesConfig, createdAt) => {
  return rolesConfig.map(role => ({
    name: role.name,
    color: role.color || '#6b7280',
    hierarchy: 200, // Default hierarchy for custom roles
    permissions: role.permissions || [],
    createdAt: createdAt,
  }));
};

const seedDemoProjects = async () => {
  try {
    console.log('🌱 Starting KBM Logic v3.0 Realistic Demo Projects Seed...\n');

    // Connect to database
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in .env file');
      console.error('   Please set MONGODB_URI in server/.env file');
      process.exit(1);
    }
    
    const connectionOptions = MONGODB_URI.includes('mongodb+srv://') ? {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    } : {};
    
    await mongoose.connect(MONGODB_URI, connectionOptions);
    console.log('✅ Connected to MongoDB\n');

    // Find owner@kbm.com (REQUIRED - do not create)
    console.log('🔍 Looking up owner@kbm.com...');
    const owner = await User.findOne({ email: 'owner@kbm.com' });
    if (!owner) {
      console.error('❌ ERROR: owner@kbm.com not found in database!');
      console.error('   Please ensure this user exists before running the seed script.');
      await mongoose.connection.close();
      process.exit(1);
    }
    console.log(`   ✅ Found owner: ${owner.displayName || owner.email} (ID: ${owner._id})\n`);

    // Clean up existing demo projects (by name)
    console.log('🗑️  Cleaning up existing demo projects...');
    const deletedNeoBank = await Project.deleteMany({ name: 'NeoBank Mobile App' });
    const deletedERP = await Project.deleteMany({ name: 'Legacy ERP Migration' });
    console.log(`   Deleted ${deletedNeoBank.deletedCount} NeoBank instances`);
    console.log(`   Deleted ${deletedERP.deletedCount} Legacy ERP instances\n`);

    // Create/Upsert Team Pool (20-25 users)
    console.log('👥 Creating team pool (20-25 users)...');
    
    const userTemplates = [
      // Backend Team
      { email: 'alex.backend@demo.com', displayName: 'Alex Backend', role: 'User' },
      { email: 'sarah.backend@demo.com', displayName: 'Sarah Backend', role: 'User' },
      { email: 'mike.backend@demo.com', displayName: 'Mike Backend', role: 'User' },
      { email: 'emma.backend@demo.com', displayName: 'Emma Backend', role: 'User' },
      // Frontend Team
      { email: 'james.frontend@demo.com', displayName: 'James Frontend', role: 'User' },
      { email: 'lisa.frontend@demo.com', displayName: 'Lisa Frontend', role: 'User' },
      { email: 'david.frontend@demo.com', displayName: 'David Frontend', role: 'User' },
      // DevOps Team
      { email: 'chris.devops@demo.com', displayName: 'Chris DevOps', role: 'User' },
      { email: 'patricia.devops@demo.com', displayName: 'Patricia DevOps', role: 'User' },
      // QA Team
      { email: 'robert.qa@demo.com', displayName: 'Robert QA', role: 'User' },
      { email: 'jennifer.qa@demo.com', displayName: 'Jennifer QA', role: 'User' },
      { email: 'william.qa@demo.com', displayName: 'William QA', role: 'User' },
      // Design Team
      { email: 'amanda.designer@demo.com', displayName: 'Amanda Designer', role: 'User' },
      { email: 'ryan.designer@demo.com', displayName: 'Ryan Designer', role: 'User' },
      // Management
      { email: 'michelle.pm@demo.com', displayName: 'Michelle PM', role: 'User' },
      { email: 'thomas.pm@demo.com', displayName: 'Thomas PM', role: 'User' },
      // Specialists
      { email: 'daniel.architect@demo.com', displayName: 'Daniel Architect', role: 'User' },
      { email: 'laura.architect@demo.com', displayName: 'Laura Architect', role: 'User' },
      { email: 'kevin.consultant@demo.com', displayName: 'Kevin Consultant', role: 'User' },
      { email: 'nancy.consultant@demo.com', displayName: 'Nancy Consultant', role: 'User' },
      // Additional specialists
      { email: 'steven.senior@demo.com', displayName: 'Steven Senior', role: 'User' },
      { email: 'karen.senior@demo.com', displayName: 'Karen Senior', role: 'User' },
      { email: 'john.junior@demo.com', displayName: 'John Junior', role: 'User' },
      { email: 'jane.junior@demo.com', displayName: 'Jane Junior', role: 'User' },
    ];

    const users = {};
    for (const userInfo of userTemplates) {
      const uid = generateUID(userInfo.email);
      let user = await User.findOne({ email: userInfo.email });
      
      if (!user) {
        user = await User.create({
          uid,
          email: userInfo.email,
          displayName: userInfo.displayName,
          role: userInfo.role,
          emailVerified: true,
        });
        console.log(`   ✅ Created: ${userInfo.displayName}`);
      } else {
        user.displayName = userInfo.displayName;
        user.role = userInfo.role;
        await user.save();
        console.log(`   ♻️  Updated: ${userInfo.displayName}`);
      }
      
      // Store user by a simple key
      const key = userInfo.email.split('@')[0].replace(/\./g, '_');
      users[key] = user;
    }
    console.log(`✅ Team pool ready (${Object.keys(users).length} users)\n`);

    // ============================================
    // PROJECT 1 - NeoBank Mobile App 🟢
    // ============================================
    console.log('🟢 Creating Project 1: "NeoBank Mobile App"...');
    
    const neobankPassword = 'neobank123';
    const neobankPasswordHash = await bcrypt.hash(neobankPassword, 10);
    
    const neobankStartDate = monthsAgo(8); // Started 8 months ago
    const neobankDeadline = monthsAgo(-2); // Deadline in 2 months (10 months total)
    
    // Format ALPHA_ROLES for project.roles array (financial compensation)
    const neobankRoles = [
      { name: 'Owner', currentRate: 0, salaryHistory: [{ rate: 0, effectiveDate: neobankStartDate }] },
      { name: 'Guest', currentRate: 0, salaryHistory: [{ rate: 0, effectiveDate: neobankStartDate }] },
      ...formatRolesForProject(ALPHA_ROLES, neobankStartDate),
    ];

    // Format ALPHA_ROLES for project.customRoles array (Roles tab UI)
    const neobankCustomRoles = formatCustomRolesForProject(ALPHA_ROLES, neobankStartDate);

    // Assign members with roles from ALPHA_ROLES
    const neobankMembers = [
      {
        userId: owner._id,
        roles: ['Owner', 'Solutions Architect'], // Owner also has functional role
        roleName: 'Owner',
        permissions: ALL_PERMISSIONS,
      },
      // Solutions Architects (2)
      { userId: users.daniel_architect._id, roles: ['Solutions Architect'], roleName: 'Solutions Architect' },
      { userId: users.laura_architect._id, roles: ['Solutions Architect'], roleName: 'Solutions Architect' },
      // Senior Backend Devs (3)
      { userId: users.alex_backend._id, roles: ['Senior Backend Dev'], roleName: 'Senior Backend Dev' },
      { userId: users.sarah_backend._id, roles: ['Senior Backend Dev'], roleName: 'Senior Backend Dev' },
      { userId: users.mike_backend._id, roles: ['Senior Backend Dev'], roleName: 'Senior Backend Dev' },
      // Frontend Leads (2)
      { userId: users.james_frontend._id, roles: ['Frontend Lead'], roleName: 'Frontend Lead' },
      { userId: users.lisa_frontend._id, roles: ['Frontend Lead'], roleName: 'Frontend Lead' },
      // Frontend Dev (1)
      { userId: users.david_frontend._id, roles: ['Frontend Lead'], roleName: 'Frontend Lead' },
      // UI/UX Designers (2)
      { userId: users.amanda_designer._id, roles: ['UI/UX Designer'], roleName: 'UI/UX Designer' },
      { userId: users.ryan_designer._id, roles: ['UI/UX Designer'], roleName: 'UI/UX Designer' },
      // QA Engineers (2)
      { userId: users.robert_qa._id, roles: ['QA Engineer'], roleName: 'QA Engineer' },
      { userId: users.jennifer_qa._id, roles: ['QA Engineer'], roleName: 'QA Engineer' },
      // DevOps Engineer (1)
      { userId: users.chris_devops._id, roles: ['DevOps Engineer'], roleName: 'DevOps Engineer' },
      // Product Manager (1)
      { userId: users.michelle_pm._id, roles: ['Product Manager'], roleName: 'Product Manager' },
    ];

    const neobankProject = await Project.create({
      name: 'NeoBank Mobile App',
      description: 'A successful high-budget fintech launch. Modern mobile banking application with biometric authentication, real-time transactions, and seamless payment integration. High-performing team delivering on time and within budget.',
      passwordHash: neobankPasswordHash,
      ownerId: owner._id,
      workSchedule: {
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        hoursPerDay: 8,
      },
      roles: neobankRoles, // CRITICAL: Populate project.roles array (financial compensation)
      customRoles: neobankCustomRoles, // CRITICAL: Populate project.customRoles array (Roles tab UI)
      members: neobankMembers,
      deadline: neobankDeadline,
      createdAt: neobankStartDate,
    });

    // Update owner's createdProjects
    owner.createdProjects = owner.createdProjects || [];
    if (!owner.createdProjects.includes(neobankProject._id)) {
      owner.createdProjects.push(neobankProject._id);
      owner.projectsCount = owner.createdProjects.length;
      await owner.save();
    }

    console.log(`   ✅ Project created (ID: ${neobankProject._id})`);
    console.log(`   📅 Timeline: ${neobankStartDate.toLocaleDateString()} → ${neobankDeadline.toLocaleDateString()} (10 months)`);
    console.log(`   👥 Team: ${neobankProject.members.length} members`);
    console.log(`   💼 Roles: ${ALPHA_ROLES.length} roles defined in project.roles and project.customRoles`);

    // Create Seed Funding (Day 1 - 8 months ago)
    await Transaction.create({
      projectId: neobankProject._id,
      amount: 500000,
      type: '+',
      source: 'Seed Funding Round',
      date: neobankStartDate,
      effectiveDate: neobankStartDate,
      authorId: owner._id,
      description: 'Initial seed funding for NeoBank Mobile App development',
    });
    console.log(`   💰 Seed Funding: $500,000 (${neobankStartDate.toLocaleDateString()})`);

    // Create Series A Tranche (Month 4 - 4 months ago)
    const seriesADate = new Date(neobankStartDate);
    seriesADate.setMonth(seriesADate.getMonth() + 4);
    await Transaction.create({
      projectId: neobankProject._id,
      amount: 200000,
      type: '+',
      source: 'Series A Tranche',
      date: seriesADate,
      effectiveDate: seriesADate,
      authorId: owner._id,
      description: 'Series A funding tranche for scaling development',
    });
    console.log(`   💰 Series A Tranche: $200,000 (${seriesADate.toLocaleDateString()})`);

    // Create realistic tasks with semantic names (distributed over 8 months)
    console.log('   📋 Creating realistic tasks...');
    const neobankTasks = [];
    const neobankTaskTitles = [
      'Implement Biometric Authentication',
      'Stripe Payment API Integration',
      'Design Dark Mode Theme',
      'Kubernetes Cluster Setup',
      'Real-time Transaction Processing',
      'Mobile App Push Notifications',
      'Bank Account Linking Service',
      'Fraud Detection Algorithm',
      'User Onboarding Flow',
      'Transaction History Dashboard',
      'Card Management Module',
      'Bill Payment Feature',
      'Investment Portfolio View',
      'Budget Tracking Tool',
      'Savings Goals Feature',
      'Multi-currency Support',
      'ATM Locator Integration',
      'Credit Score Display',
      'Loan Application Form',
      'Insurance Marketplace',
      'Peer-to-Peer Transfers',
      'QR Code Payment System',
      'Voice Command Interface',
      'Accessibility Compliance',
      'Performance Optimization',
      'Security Audit & Penetration Testing',
      'App Store Submission',
      'Play Store Submission',
      'Beta Testing Program',
      'Production Deployment',
      'Monitoring & Analytics Setup',
      'Customer Support Integration',
      'Documentation & User Guides',
      'Marketing Landing Page',
      'Social Media Integration',
      'Referral Program System',
      'Loyalty Points Engine',
      'Cashback Calculation',
      'Interest Rate Calculator',
      'Mortgage Calculator',
      'Tax Reporting Tool',
      'Expense Categorization',
      'Receipt Scanning Feature',
      'Financial Insights Dashboard',
      'Spending Alerts System',
      'Budget Notifications',
      'Goal Progress Tracking',
      'Achievement Badges',
      'Social Sharing Features',
      'Data Export Functionality',
    ];

    // Reload project to ensure members are populated
    const neobankProjectReloaded = await Project.findById(neobankProject._id);
    const neobankAssignees = neobankProjectReloaded.members
      .filter(m => m.roles && Array.isArray(m.roles) && m.roles[0] !== 'Owner')
      .map(m => m.userId.toString ? m.userId.toString() : m.userId);

    const neobankTaskCount = 50; // ~50 tasks
    const neobankDoneCount = Math.floor(neobankTaskCount * 0.85); // 85% Done
    const neobankInProgressCount = neobankTaskCount - neobankDoneCount; // 15% In Progress

    for (let i = 0; i < neobankTaskCount; i++) {
      // Distribute tasks linearly over 8 months
      const taskDate = randomDateBetween(neobankStartDate, new Date());
      const duration = randomTaskDuration();
      const deadline = new Date(taskDate);
      deadline.setDate(deadline.getDate() + duration);
      
      // Determine status: first 85% are Done, rest are In Progress
      const status = i < neobankDoneCount ? 'Done' : 'In Progress';
      
      // Random assignees (1-3 per task)
      const assigneeCount = randomInt(1, 3);
      const shuffled = [...neobankAssignees].sort(() => Math.random() - 0.5);
      const assignees = shuffled.slice(0, assigneeCount);
      
      // Random estimateHours (8-60 hours)
      const estimateHours = randomInt(8, 60);
      
      // Calculate plannedCost using the service
      const plannedCost = await calculateTaskPlannedCost(
        neobankProjectReloaded,
        estimateHours,
        assignees,
        taskDate,
        deadline
      );

      const task = await Task.create({
        projectId: neobankProject._id,
        title: neobankTaskTitles[i % neobankTaskTitles.length],
        description: `Task for NeoBank Mobile App: ${neobankTaskTitles[i % neobankTaskTitles.length]}`,
        status: status,
        priority: i % 5 === 0 ? 'Critical' : i % 3 === 0 ? 'High' : 'Medium',
        complexity: i % 4 === 0 ? 'High' : i % 2 === 0 ? 'Med' : 'Low',
        assignees: assignees,
        startDate: taskDate,
        deadline: deadline,
        estimateHours: estimateHours,
        plannedCost: plannedCost,
        plannedValue: plannedCost,
        risk: {
          probability: randomInt(1, 2), // Low risk (successful project)
          impact: randomInt(1, 2),
          auto_score: 1,
          isAutoAdjusted: false,
        },
        createdAt: new Date(), // Audit timestamp
      });
      neobankTasks.push(task);
    }
    console.log(`   ✅ Created ${neobankTasks.length} tasks (${neobankDoneCount} Done, ${neobankInProgressCount} In Progress)`);
    console.log('✅ NeoBank Mobile App complete!\n');

    // ============================================
    // PROJECT 2 - Legacy ERP Migration 🔴
    // ============================================
    console.log('🔴 Creating Project 2: "Legacy ERP Migration"...');
    
    const erpPassword = 'erp123';
    const erpPasswordHash = await bcrypt.hash(erpPassword, 10);
    
    const erpStartDate = monthsAgo(10); // Started 10 months ago
    const erpDeadline = monthsAgo(1); // Deadline was 1 month ago (OVERDUE!)
    
    // Format OMEGA_ROLES for project.roles array (financial compensation)
    const erpRoles = [
      { name: 'Owner', currentRate: 0, salaryHistory: [{ rate: 0, effectiveDate: erpStartDate }] },
      { name: 'Guest', currentRate: 0, salaryHistory: [{ rate: 0, effectiveDate: erpStartDate }] },
      ...formatRolesForProject(OMEGA_ROLES, erpStartDate),
    ];

    // Format OMEGA_ROLES for project.customRoles array (Roles tab UI)
    const erpCustomRoles = formatCustomRolesForProject(OMEGA_ROLES, erpStartDate);

    // Assign members with roles from OMEGA_ROLES
    const erpMembers = [
      {
        userId: owner._id,
        roles: ['Owner', 'System Architect'], // Owner also has functional role
        roleName: 'Owner',
        permissions: ALL_PERMISSIONS,
      },
      // System Architects (2 - expensive!)
      { userId: users.daniel_architect._id, roles: ['System Architect'], roleName: 'System Architect' },
      { userId: users.laura_architect._id, roles: ['System Architect'], roleName: 'System Architect' },
      // Legacy Code Experts (2 - very expensive!)
      { userId: users.kevin_consultant._id, roles: ['Legacy Code Expert'], roleName: 'Legacy Code Expert' },
      { userId: users.nancy_consultant._id, roles: ['Legacy Code Expert'], roleName: 'Legacy Code Expert' },
      // External Consultants (2 - extremely expensive!)
      { userId: users.steven_senior._id, roles: ['External Consultant'], roleName: 'External Consultant' },
      { userId: users.karen_senior._id, roles: ['External Consultant'], roleName: 'External Consultant' },
      // Database Admins (2 - expensive!)
      { userId: users.alex_backend._id, roles: ['Database Admin'], roleName: 'Database Admin' },
      { userId: users.sarah_backend._id, roles: ['Database Admin'], roleName: 'Database Admin' },
      // Junior Devs (2 - cheap but many)
      { userId: users.john_junior._id, roles: ['Junior Dev'], roleName: 'Junior Dev' },
      { userId: users.jane_junior._id, roles: ['Junior Dev'], roleName: 'Junior Dev' },
      // DevOps Engineers (2)
      { userId: users.chris_devops._id, roles: ['DevOps Engineer'], roleName: 'DevOps Engineer' },
      { userId: users.patricia_devops._id, roles: ['DevOps Engineer'], roleName: 'DevOps Engineer' },
      // QA Leads (2)
      { userId: users.robert_qa._id, roles: ['QA Lead'], roleName: 'QA Lead' },
      { userId: users.jennifer_qa._id, roles: ['QA Lead'], roleName: 'QA Lead' },
      // Project Managers (2)
      { userId: users.michelle_pm._id, roles: ['Project Manager'], roleName: 'Project Manager' },
      { userId: users.thomas_pm._id, roles: ['Project Manager'], roleName: 'Project Manager' },
    ];

    const erpProject = await Project.create({
      name: 'Legacy ERP Migration',
      description: 'A disastrous attempt to update an old enterprise system. Bloated team with expensive consultants, frequent emergency expenses, and severely overdue deadlines. Demonstrates critical financial metrics and project failure scenarios.',
      passwordHash: erpPasswordHash,
      ownerId: owner._id,
      workSchedule: {
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        hoursPerDay: 8,
      },
      roles: erpRoles, // CRITICAL: Populate project.roles array (financial compensation)
      customRoles: erpCustomRoles, // CRITICAL: Populate project.customRoles array (Roles tab UI)
      members: erpMembers,
      deadline: erpDeadline,
      createdAt: erpStartDate,
    });

    // Update owner's createdProjects
    if (!owner.createdProjects.includes(erpProject._id)) {
      owner.createdProjects.push(erpProject._id);
      owner.projectsCount = owner.createdProjects.length;
      await owner.save();
    }

    console.log(`   ✅ Project created (ID: ${erpProject._id})`);
    console.log(`   📅 Timeline: ${erpStartDate.toLocaleDateString()} → ${erpDeadline.toLocaleDateString()} (OVERDUE by 1 month!)`);
    console.log(`   👥 Team: ${erpProject.members.length} members (bloated, expensive)`);
    console.log(`   💼 Roles: ${OMEGA_ROLES.length} roles defined in project.roles and project.customRoles`);

    // Create Fixed Budget (Day 1 - 10 months ago)
    await Transaction.create({
      projectId: erpProject._id,
      amount: 250000,
      type: '+',
      source: 'Fixed Budget Allocation',
      date: erpStartDate,
      effectiveDate: erpStartDate,
      authorId: owner._id,
      description: 'Fixed budget allocation for Legacy ERP Migration - NO EXTRA FUNDING',
    });
    console.log(`   💰 Fixed Budget: $250,000 (${erpStartDate.toLocaleDateString()}) - NO EXTRA FUNDING`);

    // Create frequent, expensive "Emergency" expenses
    console.log('   💸 Creating emergency expenses...');
    const erpExpenses = [
      { amount: 15000, source: 'Data Recovery Service', description: 'Emergency data recovery after system crash', date: randomDateBetween(erpStartDate, monthsAgo(7)) },
      { amount: 8000, source: 'External Audit', description: 'Required external security audit', date: randomDateBetween(monthsAgo(9), monthsAgo(6)) },
      { amount: 12000, source: 'Critical Hotfix Deployment', description: 'Emergency deployment of critical security patches', date: randomDateBetween(monthsAgo(8), monthsAgo(5)) },
      { amount: 6500, source: 'Legacy System Support', description: 'Extended support for legacy system during migration', date: randomDateBetween(monthsAgo(7), monthsAgo(4)) },
      { amount: 9500, source: 'Database Migration Rollback', description: 'Cost of rolling back failed database migration', date: randomDateBetween(monthsAgo(6), monthsAgo(3)) },
    ];

    for (const expense of erpExpenses) {
      await Transaction.create({
        projectId: erpProject._id,
        amount: expense.amount,
        type: '-',
        source: expense.source,
        date: expense.date,
        effectiveDate: expense.date,
        authorId: owner._id,
        description: expense.description,
      });
    }
    const totalErpExpenses = erpExpenses.reduce((sum, e) => sum + e.amount, 0);
    console.log(`   ✅ Created ${erpExpenses.length} emergency expenses (total: $${totalErpExpenses.toLocaleString()})`);

    // Create realistic stress-inducing tasks (distributed over 10 months)
    console.log('   📋 Creating stress-inducing tasks...');
    const erpTasks = [];
    const erpTaskTitles = [
      'Fix Critical Memory Leak',
      'Database Rollback Procedure',
      'Urgent Hotfix #404',
      'Refactor Spaghetti Code',
      'Resolve Data Corruption Issue',
      'Emergency Security Patch',
      'Fix Broken Integration',
      'Recover Lost Transaction Data',
      'Fix Performance Degradation',
      'Resolve Deadlock Issues',
      'Fix Race Condition Bug',
      'Emergency Database Backup',
      'Fix Authentication Bypass',
      'Resolve Data Migration Failure',
      'Fix Critical SQL Injection',
      'Emergency System Restart',
      'Fix Broken API Endpoints',
      'Resolve Session Timeout Issues',
      'Fix Memory Overflow',
      'Emergency Code Review',
      'Fix Broken Report Generation',
      'Resolve Data Sync Issues',
      'Fix Critical Bug #789',
      'Emergency Documentation Update',
      'Fix Broken Workflow',
      'Resolve Integration Timeout',
      'Fix Data Validation Errors',
      'Emergency Performance Tuning',
      'Fix Broken Export Function',
      'Resolve Concurrent Access Issues',
      'Fix Critical Error Handling',
      'Emergency System Maintenance',
      'Fix Broken Search Functionality',
      'Resolve Data Integrity Issues',
      'Fix Critical UI Freeze',
      'Emergency Database Optimization',
      'Fix Broken Notification System',
      'Resolve Cache Invalidation',
      'Fix Critical Logging Issue',
      'Emergency System Monitoring',
    ];

    // Reload project to ensure members are populated
    const erpProjectReloaded = await Project.findById(erpProject._id);
    const erpAssignees = erpProjectReloaded.members
      .filter(m => m.roles && Array.isArray(m.roles) && m.roles[0] !== 'Owner')
      .map(m => m.userId.toString ? m.userId.toString() : m.userId);

    const erpTaskCount = 40; // ~40 tasks
    const erpDoneCount = Math.floor(erpTaskCount * 0.4); // 40% Done
    const erpStuckCount = erpTaskCount - erpDoneCount; // 60% stuck

    for (let i = 0; i < erpTaskCount; i++) {
      // Distribute tasks over 10 months
      const taskDate = randomDateBetween(erpStartDate, new Date());
      const duration = randomTaskDuration();
      const deadline = new Date(taskDate);
      deadline.setDate(deadline.getDate() + duration);
      
      // Determine status: first 40% are Done, rest are stuck (70% In Progress, 30% Todo)
      let status;
      if (i < erpDoneCount) {
        status = 'Done';
      } else {
        status = (i - erpDoneCount) % 10 < 7 ? 'In Progress' : 'Todo';
      }
      
      // Random assignees (1-3 per task)
      const assigneeCount = randomInt(1, 3);
      const shuffled = [...erpAssignees].sort(() => Math.random() - 0.5);
      const assignees = shuffled.slice(0, assigneeCount);
      
      // Random estimateHours (16-120 hours - larger, more complex tasks)
      const estimateHours = randomInt(16, 120);
      
      // Calculate plannedCost using the service
      const plannedCost = await calculateTaskPlannedCost(
        erpProjectReloaded,
        estimateHours,
        assignees,
        taskDate,
        deadline
      );

      const task = await Task.create({
        projectId: erpProject._id,
        title: erpTaskTitles[i % erpTaskTitles.length],
        description: `Critical task for Legacy ERP Migration: ${erpTaskTitles[i % erpTaskTitles.length]}`,
        status: status,
        priority: 'Critical', // All critical (disaster project)
        complexity: i % 3 === 0 ? 'High' : 'Med',
        assignees: assignees,
        startDate: taskDate,
        deadline: deadline,
        estimateHours: estimateHours,
        plannedCost: plannedCost,
        plannedValue: plannedCost,
        risk: {
          probability: randomInt(4, 5), // High risk
          impact: randomInt(4, 5), // Critical impact
          auto_score: 20, // High risk score
          isAutoAdjusted: false,
        },
        createdAt: new Date(), // Audit timestamp
      });
      erpTasks.push(task);
    }
    
    const erpInProgressCount = erpTasks.filter(t => t.status === 'In Progress').length;
    const erpTodoCount = erpTasks.filter(t => t.status === 'Todo').length;
    console.log(`   ✅ Created ${erpTasks.length} tasks (${erpDoneCount} Done, ${erpInProgressCount} In Progress, ${erpTodoCount} Todo)`);
    console.log('✅ Legacy ERP Migration complete!\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 REALISTIC DEMO PROJECTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🟢 Project 1: "NeoBank Mobile App"`);
    console.log(`   ID: ${neobankProject._id}`);
    console.log(`   Password: ${neobankPassword}`);
    console.log(`   Timeline: 10 months (${neobankStartDate.toLocaleDateString()} → ${neobankDeadline.toLocaleDateString()})`);
    console.log(`   Team: ${neobankProject.members.length} high-performing specialists`);
    console.log(`   Roles: ${ALPHA_ROLES.length} roles properly defined in project.roles and project.customRoles`);
    console.log(`   Income: $500,000 seed + $200,000 Series A = $700,000 total`);
    console.log(`   Tasks: ${neobankTasks.length} (${neobankDoneCount} Done, ${neobankInProgressCount} In Progress)`);
    console.log(`   Status: ✅ Healthy & Profitable\n`);
    
    console.log(`🔴 Project 2: "Legacy ERP Migration"`);
    console.log(`   ID: ${erpProject._id}`);
    console.log(`   Password: ${erpPassword}`);
    console.log(`   Timeline: 12 months (${erpStartDate.toLocaleDateString()} → ${erpDeadline.toLocaleDateString()} - OVERDUE!)`);
    console.log(`   Team: ${erpProject.members.length} members (bloated, expensive)`);
    console.log(`   Roles: ${OMEGA_ROLES.length} roles properly defined in project.roles and project.customRoles`);
    console.log(`   Income: $250,000 (fixed, no extra funding)`);
    console.log(`   Expenses: $${totalErpExpenses.toLocaleString()}`);
    console.log(`   Tasks: ${erpTasks.length} (${erpDoneCount} Done, ${erpInProgressCount} In Progress, ${erpTodoCount} Todo)`);
    console.log(`   Status: ❌ Critical - Over Budget & Behind Schedule\n`);
    
    console.log(`👥 Total Users: ${Object.keys(users).length + 1} (including owner@kbm.com)`);
    console.log('✅ Realistic demo projects seeded successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed function
seedDemoProjects();
