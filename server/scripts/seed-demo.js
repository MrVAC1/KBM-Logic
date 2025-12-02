/**
 * Demo Projects Seeding Script
 * 
 * Creates 2 realistic demo projects for testing Financial and Team modules
 * 
 * Usage: node server/scripts/seed-demo.js
 * Or: npm run seed:demo (if added to package.json)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Project, { ALL_PERMISSIONS } from '../models/Project.js';
import Expense from '../models/Expense.js';
import Task from '../models/Task.js';

dotenv.config();

// Helper to generate a simple UID from email (for seeding purposes)
const generateUID = (email) => {
  return `seed_${Buffer.from(email).toString('base64').slice(0, 20)}`;
};

// Helper to get default permissions for a role
const getRolePermissions = (roleName) => {
  const defaultRoles = Project.getDefaultRoles();
  const roleDef = defaultRoles.find(r => r.name === roleName);
  return roleDef ? roleDef.permissions : [];
};

// Helper to create custom role permissions
const getCustomRolePermissions = (roleName) => {
  // Developer role - can view and create/edit tasks, view financial
  if (roleName === 'Developer') {
    return [
      'can_view_dashboard',
      'can_view_tasks',
      'can_view_financial',
      'can_create_tasks',
      'can_edit_tasks',
    ];
  }
  // QA role - can view tasks, view financial
  if (roleName === 'QA') {
    return [
      'can_view_dashboard',
      'can_view_tasks',
      'can_view_financial',
      'can_edit_tasks',
    ];
  }
  // Designer role - can view tasks, view financial
  if (roleName === 'Designer') {
    return [
      'can_view_dashboard',
      'can_view_tasks',
      'can_view_financial',
      'can_create_tasks',
      'can_edit_tasks',
    ];
  }
  // Manager role - can manage tasks, view financial, manage deadline, but not manage roles
  if (roleName === 'Manager') {
    return [
      'can_view_dashboard',
      'can_view_tasks',
      'can_view_risks',
      'can_view_financial',
      'can_create_tasks',
      'can_edit_tasks',
      'can_delete_tasks',
      'can_edit_budget',
      'can_manage_deadline', // Manager can manage project deadline
      'can_invite_users',
    ];
  }
  return [];
};

// Helper to get role color
const getRoleColor = (roleName) => {
  const colorMap = {
    'Developer': '#3b82f6', // Blue
    'QA': '#10b981', // Green
    'Designer': '#8b5cf6', // Purple
    'Manager': '#f59e0b', // Amber
  };
  return colorMap[roleName] || '#6b7280'; // Default gray
};

// Helper to get role hierarchy
const getRoleHierarchy = (roleName) => {
  const hierarchyMap = {
    'Manager': 10,
    'Developer': 20,
    'Designer': 30,
    'QA': 40,
  };
  return hierarchyMap[roleName] || 200; // Default 200
};

// Helper to create customRoles array from members
// This ensures that roles used in members are also defined in customRoles
const createCustomRolesFromMembers = (members) => {
  const roleSet = new Set();
  const customRoles = [];

  // Extract unique role names from members (excluding Owner and Guest)
  members.forEach(member => {
    if (member.roles && Array.isArray(member.roles)) {
      member.roles.forEach(role => {
        if (role !== 'Owner' && role !== 'Guest') {
          roleSet.add(role);
        }
      });
    } else if (member.roleName && member.roleName !== 'Owner' && member.roleName !== 'Guest') {
      roleSet.add(member.roleName);
    }
  });

  // Create customRoles for each unique role
  roleSet.forEach(roleName => {
    customRoles.push({
      name: roleName,
      color: getRoleColor(roleName),
      hierarchy: getRoleHierarchy(roleName),
      permissions: getCustomRolePermissions(roleName),
      createdAt: new Date(),
    });
  });

  return customRoles;
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
      role: 'User',
      emailVerified: true,
      monthlySalary,
    });
    console.log(`  ✅ Created user: ${email}`);
  } else {
    // Update salary if not set
    if (!user.monthlySalary || user.monthlySalary === 0) {
      user.monthlySalary = monthlySalary;
      await user.save();
    }
    console.log(`  ℹ️  User already exists: ${email}`);
  }
  return user;
};

const seedDemoProjects = async () => {
  try {
    console.log('🌱 Starting demo projects seed...');

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

    // Find or create owner user
    console.log('👤 Finding owner user...');
    let owner = await User.findOne({ email: 'owner@kbm.com' });
    
    if (!owner) {
      console.log('⚠️  Owner user not found. Creating owner@kbm.com...');
      const ownerUID = generateUID('owner@kbm.com');
      owner = await User.create({
        uid: ownerUID,
        email: 'owner@kbm.com',
        displayName: 'Project Owner',
        role: 'Admin',
        emailVerified: true,
        monthlySalary: 10000, // $10,000/month
      });
      console.log('✅ Owner user created');
    } else {
      // Update owner salary if not set
      if (!owner.monthlySalary || owner.monthlySalary === 0) {
        owner.monthlySalary = 10000;
        await owner.save();
        console.log('✅ Owner salary updated to $10,000/month');
      }
      console.log('✅ Owner user found:', owner.email);
    }

    // Calculate date 2.5 months ago for project creation
    const projectStartDate = new Date();
    projectStartDate.setMonth(projectStartDate.getMonth() - 2);
    projectStartDate.setDate(projectStartDate.getDate() - 15); // ~2.5 months ago
    projectStartDate.setHours(0, 0, 0, 0);

    // ============================================
    // PROJECT 1: AI Analytics Platform (SaaS)
    // ============================================
    console.log('\n📁 Creating Project 1: AI Analytics Platform...');

    // Create team members for Project 1
    console.log('👥 Creating team members for Project 1...');

    const dev1 = await findOrCreateUser('dev1@test.com', 'Senior Developer', 6000);
    const qa1 = await findOrCreateUser('qa1@test.com', 'QA Engineer', 3500);
    const designer1 = await findOrCreateUser('designer1@test.com', 'UI/UX Designer', 4000);

    console.log('✅ Team members ready for Project 1');

    // Create Project 1
    const project1Password = 'demo123';
    const project1PasswordHash = await bcrypt.hash(project1Password, 10);

    // Define members first
    const project1Members = [
      {
        userId: owner._id,
        roles: ['Owner'],
        roleName: 'Owner', // Legacy field
        permissions: ALL_PERMISSIONS,
        joinedAt: projectStartDate,
      },
      {
        userId: dev1._id,
        roles: ['Developer'],
        roleName: 'Developer', // Legacy field
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(projectStartDate.getTime() + 2 * 24 * 60 * 60 * 1000), // Joined 2 days after project start
      },
      {
        userId: qa1._id,
        roles: ['QA'],
        roleName: 'QA', // Legacy field
        permissions: getCustomRolePermissions('QA'),
        joinedAt: new Date(projectStartDate.getTime() + 5 * 24 * 60 * 60 * 1000), // Joined 5 days after project start
      },
      {
        userId: designer1._id,
        roles: ['Designer'],
        roleName: 'Designer', // Legacy field
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(projectStartDate.getTime() + 3 * 24 * 60 * 60 * 1000), // Joined 3 days after project start
      },
    ];

    // Create customRoles from members
    const project1CustomRoles = createCustomRolesFromMembers(project1Members);

    const project1 = await Project.create({
      name: 'AI Analytics Platform',
      description: 'A comprehensive SaaS platform for AI-powered business analytics. Features include real-time data processing, machine learning models, interactive dashboards, and automated reporting. Built with modern microservices architecture.',
      passwordHash: project1PasswordHash,
      ownerId: owner._id,
      createdAt: projectStartDate,
      workSchedule: {
        workingDaysPerWeek: 5,
        daysOffPerWeek: 2,
        hoursPerDay: 8,
      },
      fixedCosts: [
        {
          title: 'AWS Infrastructure',
          amount: 800,
          frequency: 'monthly',
          currency: 'USD',
        },
        {
          title: 'Jira Subscription',
          amount: 150,
          frequency: 'monthly',
          currency: 'USD',
        },
      ],
      customRoles: project1CustomRoles,
      members: project1Members,
    });

    // Update owner's createdProjects array
    if (!owner.createdProjects) {
      owner.createdProjects = [];
    }
    if (!owner.createdProjects.includes(project1._id)) {
      owner.createdProjects.push(project1._id);
    }
    owner.projectsCount = owner.createdProjects.length;
    await owner.save();

    console.log('✅ Project 1 created:', project1.name);
    console.log(`   Project ID: ${project1._id}`);
    console.log(`   Access Password: ${project1Password}`);

    // Create Expenses for Project 1
    console.log('💰 Creating expenses for Project 1...');
    const expenses1 = [
      {
        projectId: project1._id,
        name: 'Software License - IntelliJ IDEA',
        amount: 149,
        frequency: 'yearly',
        createdBy: owner._id,
        createdAt: new Date(projectStartDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week after start
      },
      {
        projectId: project1._id,
        name: 'Server Upgrade - Database Cluster',
        amount: 2500,
        frequency: 'monthly', // Expense model doesn't support 'one-time', using monthly
        createdBy: owner._id,
        createdAt: new Date(projectStartDate.getTime() + 20 * 24 * 60 * 60 * 1000), // 20 days after start
      },
      {
        projectId: project1._id,
        name: 'API Gateway Subscription',
        amount: 200,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(projectStartDate.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days after start
      },
      {
        projectId: project1._id,
        name: 'Monitoring Tools - Datadog',
        amount: 180,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(projectStartDate.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days after start
      },
      {
        projectId: project1._id,
        name: 'Security Audit Service',
        amount: 3500,
        frequency: 'monthly', // Expense model doesn't support 'one-time', using monthly
        createdBy: owner._id,
        createdAt: new Date(projectStartDate.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days after start
      },
      {
        projectId: project1._id,
        name: 'CI/CD Pipeline Setup',
        amount: 1200,
        frequency: 'monthly', // Expense model doesn't support 'one-time', using monthly
        createdBy: owner._id,
        createdAt: new Date(projectStartDate.getTime() + 12 * 24 * 60 * 60 * 1000), // 12 days after start
      },
    ];

    for (const expense of expenses1) {
      await Expense.create(expense);
    }
    console.log(`✅ Created ${expenses1.length} expenses for Project 1`);

    // Create some tasks for Project 1
    console.log('📋 Creating tasks for Project 1...');
    const tasks1 = [
      {
        projectId: project1._id,
        title: 'ML Model Training Pipeline',
        description: 'Build automated pipeline for training and deploying machine learning models',
        status: 'In Progress',
        priority: 'High',
        complexity: 'High',
        assignees: [dev1._id],
        startDate: new Date(projectStartDate.getTime() + 5 * 24 * 60 * 60 * 1000),
        deadline: new Date(projectStartDate.getTime() + 60 * 24 * 60 * 60 * 1000),
        estimateHours: 120,
      },
      {
        projectId: project1._id,
        title: 'Dashboard UI Components',
        description: 'Design and implement reusable dashboard components with real-time data visualization',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [designer1._id, dev1._id],
        startDate: new Date(projectStartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        deadline: new Date(projectStartDate.getTime() + 45 * 24 * 60 * 60 * 1000),
        estimateHours: 80,
      },
      {
        projectId: project1._id,
        title: 'API Endpoint Testing',
        description: 'Comprehensive testing of all API endpoints with automated test suite',
        status: 'Review',
        priority: 'Medium',
        complexity: 'Med',
        assignees: [qa1._id],
        startDate: new Date(projectStartDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        deadline: new Date(projectStartDate.getTime() + 40 * 24 * 60 * 60 * 1000),
        estimateHours: 60,
      },
      {
        projectId: project1._id,
        title: 'Database Schema Design',
        description: 'Design optimized database schema for analytics data storage',
        status: 'Done',
        priority: 'High',
        complexity: 'High',
        assignees: [dev1._id],
        startDate: new Date(projectStartDate.getTime() + 1 * 24 * 60 * 60 * 1000),
        deadline: new Date(projectStartDate.getTime() + 20 * 24 * 60 * 60 * 1000),
        estimateHours: 100,
        updatedAt: new Date(projectStartDate.getTime() + 18 * 24 * 60 * 60 * 1000), // Completed 18 days after start
      },
    ];

    for (const task of tasks1) {
      await Task.create({
        ...task,
        risk: {
          probability: Math.floor(Math.random() * 3) + 1,
          impact: Math.floor(Math.random() * 3) + 1,
          auto_score: 1,
          isAutoAdjusted: false,
        },
      });
    }
    console.log(`✅ Created ${tasks1.length} tasks for Project 1`);

    // ============================================
    // PROJECT 2: Marketing Website Redesign (Large Agency Team)
    // ============================================
    console.log('\n📁 Creating Project 2: Marketing Website Redesign (Large Team)...');

    // Create large team for Project 2 (24 members + owner = 25 total)
    console.log('👥 Creating large team for Project 2 (24 members)...');
    
    // Management Department (3 people)
    const ceo = await findOrCreateUser('ceo@agency.com', 'CEO', 8000);
    const pm2 = await findOrCreateUser('pm2@agency.com', 'Project Manager', 4500);
    const accountManager = await findOrCreateUser('account@agency.com', 'Account Manager', 3500);

    // Design Department (6 people)
    const creativeDirector = await findOrCreateUser('creative@agency.com', 'Creative Director', 5500);
    const seniorDesigner = await findOrCreateUser('senior.designer@agency.com', 'Senior Designer', 4200);
    const uiDesigner = await findOrCreateUser('ui.designer@agency.com', 'UI Designer', 3800);
    const uxDesigner = await findOrCreateUser('ux.designer@agency.com', 'UX Designer', 4000);
    const graphicDesigner = await findOrCreateUser('graphic@agency.com', 'Graphic Designer', 3200);
    const motionDesigner = await findOrCreateUser('motion@agency.com', 'Motion Designer', 4100);

    // Development Department (7 people)
    const techLead = await findOrCreateUser('techlead@agency.com', 'Tech Lead', 6500);
    const seniorDev = await findOrCreateUser('senior.dev@agency.com', 'Senior Developer', 5800);
    const midDev = await findOrCreateUser('mid.dev@agency.com', 'Mid-Level Developer', 4200);
    const juniorDev = await findOrCreateUser('junior.dev@agency.com', 'Junior Developer', 2800);
    const frontendDev = await findOrCreateUser('frontend@agency.com', 'Frontend Developer', 4500);
    const backendDev = await findOrCreateUser('backend@agency.com', 'Backend Developer', 4800);
    const devops = await findOrCreateUser('devops@agency.com', 'DevOps Engineer', 5200);

    // Marketing Department (5 people)
    const marketingManager = await findOrCreateUser('marketing@agency.com', 'Marketing Manager', 4600);
    const seoSpecialist = await findOrCreateUser('seo@agency.com', 'SEO Specialist', 3400);
    const contentWriter = await findOrCreateUser('content@agency.com', 'Content Writer', 2900);
    const socialMedia = await findOrCreateUser('social@agency.com', 'Social Media Manager', 3100);
    const analytics = await findOrCreateUser('analytics@agency.com', 'Analytics Specialist', 3600);

    // QA Department (3 people)
    const qaLead = await findOrCreateUser('qa.lead@agency.com', 'QA Lead', 4400);
    const qaEngineer = await findOrCreateUser('qa.engineer@agency.com', 'QA Engineer', 3300);
    const automationQA = await findOrCreateUser('automation@agency.com', 'Automation QA', 3800);

    console.log('✅ Team members ready for Project 2 (24 members)');

    // Create Project 2 (started 2 months ago)
    const project2StartDate = new Date();
    project2StartDate.setMonth(project2StartDate.getMonth() - 2);
    project2StartDate.setHours(0, 0, 0, 0);

    const project2Password = 'demo123';
    const project2PasswordHash = await bcrypt.hash(project2Password, 10);

    // Create all members array for Project 2
    const project2Members = [
      {
        userId: owner._id,
        roles: ['Owner'],
        roleName: 'Owner',
        permissions: ALL_PERMISSIONS,
        joinedAt: project2StartDate,
      },
      // Management
      {
        userId: ceo._id,
        roles: ['Manager'],
        roleName: 'Manager',
        permissions: getCustomRolePermissions('Manager'),
        joinedAt: new Date(project2StartDate.getTime() + 1 * 24 * 60 * 60 * 1000),
      },
      {
        userId: pm2._id,
        roles: ['Manager'],
        roleName: 'Manager',
        permissions: getCustomRolePermissions('Manager'),
        joinedAt: new Date(project2StartDate.getTime() + 1 * 24 * 60 * 60 * 1000),
      },
      {
        userId: accountManager._id,
        roles: ['Manager'],
        roleName: 'Manager',
        permissions: getCustomRolePermissions('Manager'),
        joinedAt: new Date(project2StartDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
      // Design Department
      {
        userId: creativeDirector._id,
        roles: ['Designer'],
        roleName: 'Designer',
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        userId: seniorDesigner._id,
        roles: ['Designer'],
        roleName: 'Designer',
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        userId: uiDesigner._id,
        roles: ['Designer'],
        roleName: 'Designer',
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(project2StartDate.getTime() + 4 * 24 * 60 * 60 * 1000),
      },
      {
        userId: uxDesigner._id,
        roles: ['Designer'],
        roleName: 'Designer',
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(project2StartDate.getTime() + 4 * 24 * 60 * 60 * 1000),
      },
      {
        userId: graphicDesigner._id,
        roles: ['Designer'],
        roleName: 'Designer',
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(project2StartDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId: motionDesigner._id,
        roles: ['Designer'],
        roleName: 'Designer',
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(project2StartDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      },
      // Development Department
      {
        userId: techLead._id,
        roles: ['Developer'],
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId: seniorDev._id,
        roles: ['Developer'],
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId: midDev._id,
        roles: ['Developer'],
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        userId: juniorDev._id,
        roles: ['Developer'],
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 4 * 24 * 60 * 60 * 1000),
      },
      {
        userId: frontendDev._id,
        roles: ['Developer'],
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        userId: backendDev._id,
        roles: ['Developer'],
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        userId: devops._id,
        roles: ['Developer'],
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
      // Marketing Department
      {
        userId: marketingManager._id,
        roles: ['Manager'],
        roleName: 'Manager',
        permissions: getCustomRolePermissions('Manager'),
        joinedAt: new Date(project2StartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
      },
      {
        userId: seoSpecialist._id,
        roles: ['Developer'], // Using Developer permissions for marketing tech roles
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        userId: contentWriter._id,
        roles: ['Designer'], // Using Designer permissions for content creators
        roleName: 'Designer',
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(project2StartDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        userId: socialMedia._id,
        roles: ['Designer'],
        roleName: 'Designer',
        permissions: getCustomRolePermissions('Designer'),
        joinedAt: new Date(project2StartDate.getTime() + 8 * 24 * 60 * 60 * 1000),
      },
      {
        userId: analytics._id,
        roles: ['Developer'],
        roleName: 'Developer',
        permissions: getCustomRolePermissions('Developer'),
        joinedAt: new Date(project2StartDate.getTime() + 8 * 24 * 60 * 60 * 1000),
      },
      // QA Department
      {
        userId: qaLead._id,
        roles: ['QA'],
        roleName: 'QA',
        permissions: getCustomRolePermissions('QA'),
        joinedAt: new Date(project2StartDate.getTime() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        userId: qaEngineer._id,
        roles: ['QA'],
        roleName: 'QA',
        permissions: getCustomRolePermissions('QA'),
        joinedAt: new Date(project2StartDate.getTime() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        userId: automationQA._id,
        roles: ['QA'],
        roleName: 'QA',
        permissions: getCustomRolePermissions('QA'),
        joinedAt: new Date(project2StartDate.getTime() + 11 * 24 * 60 * 60 * 1000),
      },
    ];

    // Create customRoles from members
    const project2CustomRoles = createCustomRolesFromMembers(project2Members);

    const project2 = await Project.create({
      name: 'Marketing Website Redesign',
      description: 'Complete redesign of corporate marketing website with modern UI/UX, improved SEO, and enhanced user experience. Large-scale agency project with multiple departments working on landing pages, blog section, contact forms, and marketing automation.',
      passwordHash: project2PasswordHash,
      ownerId: owner._id,
      createdAt: project2StartDate,
      workSchedule: {
        workingDaysPerWeek: 5,
        daysOffPerWeek: 2,
        hoursPerDay: 8,
      },
      fixedCosts: [
        {
          title: 'Figma Enterprise',
          amount: 50,
          frequency: 'monthly',
          currency: 'USD',
        },
        {
          title: 'Webflow Hosting',
          amount: 40,
          frequency: 'monthly',
          currency: 'USD',
        },
        {
          title: 'Adobe Creative Cloud',
          amount: 80,
          frequency: 'monthly',
          currency: 'USD',
        },
        {
          title: 'Slack Workspace',
          amount: 12,
          frequency: 'monthly',
          currency: 'USD',
        },
      ],
      customRoles: project2CustomRoles,
      members: project2Members,
      // Create departments
      departments: [
        {
          name: 'Management',
          memberIds: [ceo._id, pm2._id, accountManager._id],
          createdAt: project2StartDate,
        },
        {
          name: 'Design',
          memberIds: [creativeDirector._id, seniorDesigner._id, uiDesigner._id, uxDesigner._id, graphicDesigner._id, motionDesigner._id],
          createdAt: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
        {
          name: 'Development',
          memberIds: [techLead._id, seniorDev._id, midDev._id, juniorDev._id, frontendDev._id, backendDev._id, devops._id],
          createdAt: new Date(project2StartDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        },
        {
          name: 'Marketing',
          memberIds: [marketingManager._id, seoSpecialist._id, contentWriter._id, socialMedia._id, analytics._id],
          createdAt: new Date(project2StartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
        },
        {
          name: 'QA',
          memberIds: [qaLead._id, qaEngineer._id, automationQA._id],
          createdAt: new Date(project2StartDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    // Update owner's createdProjects array
    if (!owner.createdProjects.includes(project2._id)) {
      owner.createdProjects.push(project2._id);
    }
    owner.projectsCount = owner.createdProjects.length;
    await owner.save();

    console.log('✅ Project 2 created:', project2.name);
    console.log(`   Project ID: ${project2._id}`);
    console.log(`   Access Password: ${project2Password}`);

    // Create Expenses for Project 2 (Large number of expenses)
    console.log('💰 Creating expenses for Project 2 (25+ expenses)...');
    const expenses2 = [
      // Design & Creative Tools
      {
        projectId: project2._id,
        name: 'Stock Photography License - Shutterstock',
        amount: 299,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Adobe Stock Images',
        amount: 199,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Icon Library Subscription',
        amount: 49,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Font License - Premium Typefaces',
        amount: 150,
        frequency: 'yearly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 8 * 24 * 60 * 60 * 1000),
      },
      // Hosting & Infrastructure
      {
        projectId: project2._id,
        name: 'Domain Renewal',
        amount: 15,
        frequency: 'yearly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 8 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'SSL Certificate',
        amount: 89,
        frequency: 'yearly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'CDN Service - Cloudflare',
        amount: 20,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 12 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Backup Service - Automated',
        amount: 35,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
      // Content & Marketing
      {
        projectId: project2._id,
        name: 'Content Writing Service',
        amount: 800,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 15 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'SEO Tools Subscription - Ahrefs',
        amount: 99,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 12 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Google Analytics Premium',
        amount: 150,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 16 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Social Media Management Tool',
        amount: 79,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 18 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Email Marketing Platform',
        amount: 120,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 20 * 24 * 60 * 60 * 1000),
      },
      // Development Tools
      {
        projectId: project2._id,
        name: 'GitHub Team Plan',
        amount: 4,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'CI/CD Pipeline - GitHub Actions',
        amount: 0,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 4 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Code Quality Tools - SonarQube',
        amount: 150,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'API Testing Tool - Postman',
        amount: 12,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
      },
      // Third-party Services
      {
        projectId: project2._id,
        name: 'Payment Gateway - Stripe',
        amount: 0,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 22 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'CRM Integration - HubSpot',
        amount: 50,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 24 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Live Chat Service - Intercom',
        amount: 79,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 26 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Form Builder - Typeform',
        amount: 35,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 28 * 24 * 60 * 60 * 1000),
      },
      // Professional Services
      {
        projectId: project2._id,
        name: 'Legal Consultation',
        amount: 500,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Security Audit',
        amount: 1200,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 35 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Performance Testing Service',
        amount: 400,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 40 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Accessibility Audit',
        amount: 600,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 45 * 24 * 60 * 60 * 1000),
      },
      // Additional Tools
      {
        projectId: project2._id,
        name: 'Project Management - Asana',
        amount: 13,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Time Tracking Tool',
        amount: 8,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        name: 'Video Hosting - Vimeo Pro',
        amount: 20,
        frequency: 'monthly',
        createdBy: owner._id,
        createdAt: new Date(project2StartDate.getTime() + 50 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const expense of expenses2) {
      await Expense.create(expense);
    }
    console.log(`✅ Created ${expenses2.length} expenses for Project 2`);

    // Create many tasks for Project 2 (35+ tasks)
    console.log('📋 Creating tasks for Project 2 (35+ tasks)...');
    const tasks2 = [
      // Design Tasks (10 tasks)
      {
        projectId: project2._id,
        title: 'Brand Identity Design',
        description: 'Create comprehensive brand identity including logo, color palette, typography, and brand guidelines',
        status: 'Done',
        priority: 'High',
        complexity: 'High',
        assignees: [creativeDirector._id, seniorDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 1 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 14 * 24 * 60 * 60 * 1000),
        estimateHours: 80,
        updatedAt: new Date(project2StartDate.getTime() + 12 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        title: 'Homepage Wireframes',
        description: 'Design wireframes for homepage with user flow and information architecture',
        status: 'Done',
        priority: 'High',
        complexity: 'Med',
        assignees: [uxDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        estimateHours: 40,
        updatedAt: new Date(project2StartDate.getTime() + 9 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        title: 'Homepage Visual Design',
        description: 'Create high-fidelity visual designs for homepage with modern UI elements',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [uiDesigner._id, seniorDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 11 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        estimateHours: 60,
      },
      {
        projectId: project2._id,
        title: 'Landing Page Templates',
        description: 'Design 5 different landing page templates for various marketing campaigns',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [uiDesigner._id, graphicDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 40 * 24 * 60 * 60 * 1000),
        estimateHours: 100,
      },
      {
        projectId: project2._id,
        title: 'Mobile Responsive Designs',
        description: 'Create mobile-first responsive designs for all pages',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [uxDesigner._id, uiDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 20 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 45 * 24 * 60 * 60 * 1000),
        estimateHours: 80,
      },
      {
        projectId: project2._id,
        title: 'Icon Set Creation',
        description: 'Design custom icon set matching brand identity',
        status: 'Review',
        priority: 'Medium',
        complexity: 'Med',
        assignees: [graphicDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 8 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 25 * 24 * 60 * 60 * 1000),
        estimateHours: 50,
      },
      {
        projectId: project2._id,
        title: 'Animation Concepts',
        description: 'Design micro-interactions and animation concepts for enhanced UX',
        status: 'In Progress',
        priority: 'Medium',
        complexity: 'High',
        assignees: [motionDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 18 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 50 * 24 * 60 * 60 * 1000),
        estimateHours: 70,
      },
      {
        projectId: project2._id,
        title: 'Email Template Designs',
        description: 'Design responsive email templates for marketing campaigns',
        status: 'Todo',
        priority: 'Medium',
        complexity: 'Low',
        assignees: [graphicDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 55 * 24 * 60 * 60 * 1000),
        estimateHours: 30,
      },
      {
        projectId: project2._id,
        title: 'Social Media Graphics',
        description: 'Create social media graphics and templates for brand consistency',
        status: 'Todo',
        priority: 'Low',
        complexity: 'Low',
        assignees: [graphicDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 35 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 60 * 24 * 60 * 60 * 1000),
        estimateHours: 25,
      },
      {
        projectId: project2._id,
        title: 'Design System Documentation',
        description: 'Document design system with component library and usage guidelines',
        status: 'Review',
        priority: 'High',
        complexity: 'Med',
        assignees: [creativeDirector._id, seniorDesigner._id],
        startDate: new Date(project2StartDate.getTime() + 25 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 50 * 24 * 60 * 60 * 1000),
        estimateHours: 40,
      },
      // Development Tasks (12 tasks)
      {
        projectId: project2._id,
        title: 'Project Setup & Architecture',
        description: 'Initialize project repository, set up development environment, and define architecture',
        status: 'Done',
        priority: 'High',
        complexity: 'High',
        assignees: [techLead._id, devops._id],
        startDate: new Date(project2StartDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        estimateHours: 60,
        updatedAt: new Date(project2StartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        title: 'Homepage Implementation',
        description: 'Implement homepage with responsive design and interactive elements',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [frontendDev._id, seniorDev._id],
        startDate: new Date(project2StartDate.getTime() + 12 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 35 * 24 * 60 * 60 * 1000),
        estimateHours: 120,
      },
      {
        projectId: project2._id,
        title: 'Blog Section Development',
        description: 'Build blog section with category filters, search, and pagination',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [midDev._id, frontendDev._id],
        startDate: new Date(project2StartDate.getTime() + 20 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 50 * 24 * 60 * 60 * 1000),
        estimateHours: 100,
      },
      {
        projectId: project2._id,
        title: 'Contact Form Integration',
        description: 'Integrate contact forms with email service and CRM system',
        status: 'Done',
        priority: 'High',
        complexity: 'Low',
        assignees: [backendDev._id],
        startDate: new Date(project2StartDate.getTime() + 5 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 18 * 24 * 60 * 60 * 1000),
        estimateHours: 30,
        updatedAt: new Date(project2StartDate.getTime() + 16 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        title: 'API Development',
        description: 'Develop RESTful API endpoints for blog, forms, and content management',
        status: 'In Progress',
        priority: 'High',
        complexity: 'High',
        assignees: [backendDev._id, seniorDev._id],
        startDate: new Date(project2StartDate.getTime() + 8 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 40 * 24 * 60 * 60 * 1000),
        estimateHours: 150,
      },
      {
        projectId: project2._id,
        title: 'Database Schema Design',
        description: 'Design and implement database schema for content, users, and analytics',
        status: 'Done',
        priority: 'High',
        complexity: 'High',
        assignees: [techLead._id, backendDev._id],
        startDate: new Date(project2StartDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 12 * 24 * 60 * 60 * 1000),
        estimateHours: 80,
        updatedAt: new Date(project2StartDate.getTime() + 11 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        title: 'Authentication System',
        description: 'Implement user authentication and authorization system',
        status: 'In Progress',
        priority: 'High',
        complexity: 'High',
        assignees: [backendDev._id, seniorDev._id],
        startDate: new Date(project2StartDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 35 * 24 * 60 * 60 * 1000),
        estimateHours: 100,
      },
      {
        projectId: project2._id,
        title: 'Content Management System',
        description: 'Build CMS for managing blog posts, pages, and media',
        status: 'In Progress',
        priority: 'High',
        complexity: 'High',
        assignees: [backendDev._id, frontendDev._id, midDev._id],
        startDate: new Date(project2StartDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 55 * 24 * 60 * 60 * 1000),
        estimateHours: 200,
      },
      {
        projectId: project2._id,
        title: 'Performance Optimization',
        description: 'Optimize page load times, implement lazy loading, and code splitting',
        status: 'Review',
        priority: 'Medium',
        complexity: 'Med',
        assignees: [frontendDev._id, devops._id],
        startDate: new Date(project2StartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 50 * 24 * 60 * 60 * 1000),
        estimateHours: 60,
      },
      {
        projectId: project2._id,
        title: 'CI/CD Pipeline Setup',
        description: 'Configure continuous integration and deployment pipeline',
        status: 'Done',
        priority: 'High',
        complexity: 'Med',
        assignees: [devops._id],
        startDate: new Date(project2StartDate.getTime() + 4 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        estimateHours: 40,
        updatedAt: new Date(project2StartDate.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        title: 'Third-party Integrations',
        description: 'Integrate payment gateway, analytics, and marketing tools',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [backendDev._id, midDev._id],
        startDate: new Date(project2StartDate.getTime() + 22 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 45 * 24 * 60 * 60 * 1000),
        estimateHours: 80,
      },
      {
        projectId: project2._id,
        title: 'Mobile App Development',
        description: 'Develop companion mobile app for iOS and Android',
        status: 'Todo',
        priority: 'Medium',
        complexity: 'High',
        assignees: [frontendDev._id, midDev._id, juniorDev._id],
        startDate: new Date(project2StartDate.getTime() + 40 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 70 * 24 * 60 * 60 * 1000),
        estimateHours: 300,
      },
      // Marketing Tasks (8 tasks)
      {
        projectId: project2._id,
        title: 'SEO Strategy & Implementation',
        description: 'Develop and implement comprehensive SEO strategy',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [seoSpecialist._id, marketingManager._id],
        startDate: new Date(project2StartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 50 * 24 * 60 * 60 * 1000),
        estimateHours: 120,
      },
      {
        projectId: project2._id,
        title: 'Content Strategy',
        description: 'Develop content strategy and editorial calendar',
        status: 'Done',
        priority: 'High',
        complexity: 'Med',
        assignees: [contentWriter._id, marketingManager._id],
        startDate: new Date(project2StartDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 20 * 24 * 60 * 60 * 1000),
        estimateHours: 50,
        updatedAt: new Date(project2StartDate.getTime() + 18 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        title: 'Blog Content Creation',
        description: 'Write and publish 20+ blog posts for content marketing',
        status: 'In Progress',
        priority: 'Medium',
        complexity: 'Med',
        assignees: [contentWriter._id],
        startDate: new Date(project2StartDate.getTime() + 21 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 60 * 24 * 60 * 60 * 1000),
        estimateHours: 100,
      },
      {
        projectId: project2._id,
        title: 'Social Media Campaign',
        description: 'Plan and execute social media marketing campaign',
        status: 'In Progress',
        priority: 'Medium',
        complexity: 'Med',
        assignees: [socialMedia._id, marketingManager._id],
        startDate: new Date(project2StartDate.getTime() + 25 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 65 * 24 * 60 * 60 * 1000),
        estimateHours: 80,
      },
      {
        projectId: project2._id,
        title: 'Analytics Dashboard Setup',
        description: 'Set up analytics tracking and reporting dashboard',
        status: 'Review',
        priority: 'High',
        complexity: 'Med',
        assignees: [analytics._id],
        startDate: new Date(project2StartDate.getTime() + 8 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        estimateHours: 60,
      },
      {
        projectId: project2._id,
        title: 'Email Marketing Setup',
        description: 'Configure email marketing platform and create campaign templates',
        status: 'Todo',
        priority: 'Medium',
        complexity: 'Low',
        assignees: [marketingManager._id, contentWriter._id],
        startDate: new Date(project2StartDate.getTime() + 35 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 55 * 24 * 60 * 60 * 1000),
        estimateHours: 40,
      },
      {
        projectId: project2._id,
        title: 'Landing Page A/B Testing',
        description: 'Set up A/B testing framework for landing pages',
        status: 'Todo',
        priority: 'Medium',
        complexity: 'Med',
        assignees: [analytics._id, marketingManager._id],
        startDate: new Date(project2StartDate.getTime() + 45 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 65 * 24 * 60 * 60 * 1000),
        estimateHours: 50,
      },
      {
        projectId: project2._id,
        title: 'Marketing Automation',
        description: 'Implement marketing automation workflows and lead nurturing',
        status: 'Todo',
        priority: 'Medium',
        complexity: 'High',
        assignees: [marketingManager._id, analytics._id],
        startDate: new Date(project2StartDate.getTime() + 40 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 70 * 24 * 60 * 60 * 1000),
        estimateHours: 90,
      },
      // QA Tasks (5 tasks)
      {
        projectId: project2._id,
        title: 'Test Plan Development',
        description: 'Create comprehensive test plan covering all features and scenarios',
        status: 'Done',
        priority: 'High',
        complexity: 'Med',
        assignees: [qaLead._id],
        startDate: new Date(project2StartDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 20 * 24 * 60 * 60 * 1000),
        estimateHours: 40,
        updatedAt: new Date(project2StartDate.getTime() + 19 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project2._id,
        title: 'Manual Testing - Homepage',
        description: 'Perform comprehensive manual testing of homepage functionality',
        status: 'In Progress',
        priority: 'High',
        complexity: 'Med',
        assignees: [qaEngineer._id, qaLead._id],
        startDate: new Date(project2StartDate.getTime() + 25 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 40 * 24 * 60 * 60 * 1000),
        estimateHours: 60,
      },
      {
        projectId: project2._id,
        title: 'Automated Test Suite',
        description: 'Develop automated test suite for regression testing',
        status: 'In Progress',
        priority: 'High',
        complexity: 'High',
        assignees: [automationQA._id],
        startDate: new Date(project2StartDate.getTime() + 11 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 50 * 24 * 60 * 60 * 1000),
        estimateHours: 120,
      },
      {
        projectId: project2._id,
        title: 'Cross-browser Testing',
        description: 'Test website compatibility across all major browsers',
        status: 'Review',
        priority: 'High',
        complexity: 'Med',
        assignees: [qaEngineer._id],
        startDate: new Date(project2StartDate.getTime() + 35 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 50 * 24 * 60 * 60 * 1000),
        estimateHours: 50,
      },
      {
        projectId: project2._id,
        title: 'Performance Testing',
        description: 'Conduct load testing and performance optimization',
        status: 'Todo',
        priority: 'Medium',
        complexity: 'High',
        assignees: [automationQA._id, qaLead._id],
        startDate: new Date(project2StartDate.getTime() + 45 * 24 * 60 * 60 * 1000),
        deadline: new Date(project2StartDate.getTime() + 65 * 24 * 60 * 60 * 1000),
        estimateHours: 80,
      },
    ];

    for (const task of tasks2) {
      await Task.create({
        ...task,
        risk: {
          probability: Math.floor(Math.random() * 3) + 1,
          impact: Math.floor(Math.random() * 3) + 1,
          auto_score: 1,
          isAutoAdjusted: false,
        },
      });
    }
    console.log(`✅ Created ${tasks2.length} tasks for Project 2`);

    // Summary
    console.log('\n📊 Seeding Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 Total Users: ${await User.countDocuments()}`);
    console.log(`📁 Total Projects: ${await Project.countDocuments()}`);
    console.log(`💰 Total Expenses: ${await Expense.countDocuments()}`);
    console.log(`📋 Total Tasks: ${await Task.countDocuments()}`);
    console.log('\n🔑 Project Access:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Project 1: AI Analytics Platform');
    console.log(`  ID: ${project1._id}`);
    console.log(`  Password: ${project1Password}`);
    console.log('Project 2: Marketing Website Redesign');
    console.log(`  ID: ${project2._id}`);
    console.log(`  Password: ${project2Password}`);
    console.log('\n👥 Team Members:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Project 1 Team (4 members):');
    console.log(`  - ${dev1.displayName} (${dev1.email}) - $${dev1.monthlySalary}/mo`);
    console.log(`  - ${qa1.displayName} (${qa1.email}) - $${qa1.monthlySalary}/mo`);
    console.log(`  - ${designer1.displayName} (${designer1.email}) - $${designer1.monthlySalary}/mo`);
    console.log('Project 2 Team (25 members - Large Agency):');
    console.log('  Management (3):');
    console.log(`    - ${ceo.displayName} (${ceo.email}) - $${ceo.monthlySalary}/mo`);
    console.log(`    - ${pm2.displayName} (${pm2.email}) - $${pm2.monthlySalary}/mo`);
    console.log(`    - ${accountManager.displayName} (${accountManager.email}) - $${accountManager.monthlySalary}/mo`);
    console.log('  Design (6):');
    console.log(`    - ${creativeDirector.displayName} (${creativeDirector.email}) - $${creativeDirector.monthlySalary}/mo`);
    console.log(`    - ${seniorDesigner.displayName} (${seniorDesigner.email}) - $${seniorDesigner.monthlySalary}/mo`);
    console.log(`    - ${uiDesigner.displayName} (${uiDesigner.email}) - $${uiDesigner.monthlySalary}/mo`);
    console.log(`    - ${uxDesigner.displayName} (${uxDesigner.email}) - $${uxDesigner.monthlySalary}/mo`);
    console.log(`    - ${graphicDesigner.displayName} (${graphicDesigner.email}) - $${graphicDesigner.monthlySalary}/mo`);
    console.log(`    - ${motionDesigner.displayName} (${motionDesigner.email}) - $${motionDesigner.monthlySalary}/mo`);
    console.log('  Development (7):');
    console.log(`    - ${techLead.displayName} (${techLead.email}) - $${techLead.monthlySalary}/mo`);
    console.log(`    - ${seniorDev.displayName} (${seniorDev.email}) - $${seniorDev.monthlySalary}/mo`);
    console.log(`    - ${midDev.displayName} (${midDev.email}) - $${midDev.monthlySalary}/mo`);
    console.log(`    - ${juniorDev.displayName} (${juniorDev.email}) - $${juniorDev.monthlySalary}/mo`);
    console.log(`    - ${frontendDev.displayName} (${frontendDev.email}) - $${frontendDev.monthlySalary}/mo`);
    console.log(`    - ${backendDev.displayName} (${backendDev.email}) - $${backendDev.monthlySalary}/mo`);
    console.log(`    - ${devops.displayName} (${devops.email}) - $${devops.monthlySalary}/mo`);
    console.log('  Marketing (5):');
    console.log(`    - ${marketingManager.displayName} (${marketingManager.email}) - $${marketingManager.monthlySalary}/mo`);
    console.log(`    - ${seoSpecialist.displayName} (${seoSpecialist.email}) - $${seoSpecialist.monthlySalary}/mo`);
    console.log(`    - ${contentWriter.displayName} (${contentWriter.email}) - $${contentWriter.monthlySalary}/mo`);
    console.log(`    - ${socialMedia.displayName} (${socialMedia.email}) - $${socialMedia.monthlySalary}/mo`);
    console.log(`    - ${analytics.displayName} (${analytics.email}) - $${analytics.monthlySalary}/mo`);
    console.log('  QA (3):');
    console.log(`    - ${qaLead.displayName} (${qaLead.email}) - $${qaLead.monthlySalary}/mo`);
    console.log(`    - ${qaEngineer.displayName} (${qaEngineer.email}) - $${qaEngineer.monthlySalary}/mo`);
    console.log(`    - ${automationQA.displayName} (${automationQA.email}) - $${automationQA.monthlySalary}/mo`);
    console.log('\n📊 Project 2 Departments:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  - Management: ${project2.departments.find(d => d.name === 'Management')?.memberIds.length || 0} members`);
    console.log(`  - Design: ${project2.departments.find(d => d.name === 'Design')?.memberIds.length || 0} members`);
    console.log(`  - Development: ${project2.departments.find(d => d.name === 'Development')?.memberIds.length || 0} members`);
    console.log(`  - Marketing: ${project2.departments.find(d => d.name === 'Marketing')?.memberIds.length || 0} members`);
    console.log(`  - QA: ${project2.departments.find(d => d.name === 'QA')?.memberIds.length || 0} members`);
    console.log('\n✅ Demo projects seeding completed successfully!');
    console.log('\n⚠️  Note: These are demo users. Create Firebase accounts if needed for authentication.');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run seed
seedDemoProjects();

