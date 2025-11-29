/**
 * Database Seeding Script
 * 
 * Populates MongoDB with demo "Big Tech" style project data
 * 
 * Usage: npm run seed
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Project from './models/Project.js';
import Task from './models/Task.js';
import Transaction from './models/Transaction.js';

dotenv.config();

// Helper to generate a simple UID from email (for seeding purposes)
const generateUID = (email) => {
  return `seed_${Buffer.from(email).toString('base64').slice(0, 20)}`;
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seed...');

    // Connect to database directly
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbm-logic-v4';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Transaction.deleteMany({});
    console.log('✅ Existing data cleared');

    // Create Users
    console.log('👥 Creating users...');
    
    const ownerUID = generateUID('owner@kbm.com');
    const pmUID = generateUID('pm@kbm.com');
    const devUID = generateUID('dev@kbm.com');

    const owner = await User.create({
      uid: ownerUID,
      email: 'owner@kbm.com',
      displayName: 'Project Owner',
      role: 'Admin',
      emailVerified: true,
    });

    const pm = await User.create({
      uid: pmUID,
      email: 'pm@kbm.com',
      displayName: 'Project Manager',
      role: 'User',
      emailVerified: true,
    });

    const dev = await User.create({
      uid: devUID,
      email: 'dev@kbm.com',
      displayName: 'Senior Developer',
      role: 'User',
      emailVerified: true,
    });

    console.log('✅ Users created:', { owner: owner.email, pm: pm.email, dev: dev.email });

    // Create Project
    console.log('📁 Creating project...');
    
    const projectPassword = '123456';
    const passwordHash = await bcrypt.hash(projectPassword, 10);

    const defaultRoles = Project.getDefaultRoles();
    const ownerRole = defaultRoles.find(r => r.name === 'Owner');
    const pmRole = defaultRoles.find(r => r.name === 'PM');
    const devRole = defaultRoles.find(r => r.name === 'Developer');

    const project = await Project.create({
      name: 'E-Commerce Platform Redesign',
      description: 'Complete redesign of the e-commerce platform with modern UI/UX, improved performance, and enhanced security features. Migration from legacy system to microservices architecture.',
      passwordHash,
      ownerId: owner._id,
      fixedCosts: [
        {
          title: 'Server Hosting',
          amount: 200,
          frequency: 'monthly',
          currency: 'USD',
        },
        {
          title: 'PM Salary',
          amount: 3000,
          frequency: 'monthly',
          currency: 'USD',
        },
      ],
      // No roles array - role data is inline in members
      members: [
        {
          userId: owner._id,
          roleName: 'Owner',
          permissions: ownerRole.permissions, // All permissions
          hourlyRate: 0,
        },
        {
          userId: pm._id,
          roleName: 'PM',
          permissions: pmRole.permissions,
          hourlyRate: 50,
        },
        {
          userId: dev._id,
          roleName: 'Developer',
          permissions: devRole.permissions,
          hourlyRate: 75,
        },
      ],
    });

    // Update owner's createdProjects array
    owner.createdProjects = [project._id];
    owner.projectsCount = 1;
    await owner.save();

    console.log('✅ Project created:', project.name);
    console.log(`   Project ID: ${project._id}`);
    console.log(`   Access Password: ${projectPassword}`);

    // Create Tasks
    console.log('📋 Creating tasks...');

    const taskTemplates = [
      // Todo tasks (5 tasks)
      { title: 'Design System Setup', description: 'Create comprehensive design system with color palette, typography, and component library', status: 'Todo', priority: 'High', complexity: 'High', assignees: [dev._id], deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      { title: 'API Architecture Planning', description: 'Design RESTful API structure and define endpoints for all modules', status: 'Todo', priority: 'High', complexity: 'High', assignees: [dev._id], deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
      { title: 'Database Schema Design', description: 'Design MongoDB schemas for products, orders, users, and inventory', status: 'Todo', priority: 'High', complexity: 'Med', assignees: [dev._id], deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) },
      { title: 'User Authentication Flow', description: 'Implement OAuth2 and JWT-based authentication system', status: 'Todo', priority: 'Critical', complexity: 'High', assignees: [dev._id], deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
      { title: 'Payment Gateway Integration', description: 'Integrate Stripe payment gateway with webhook handling', status: 'Todo', priority: 'Critical', complexity: 'High', assignees: [dev._id], deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      
      // In Progress tasks (5 tasks)
      { title: 'Homepage Redesign', description: 'Redesign homepage with modern hero section, featured products, and improved navigation', status: 'In Progress', priority: 'High', complexity: 'Med', assignees: [dev._id], deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      { title: 'Product Catalog Page', description: 'Build responsive product catalog with filters, search, and pagination', status: 'In Progress', priority: 'High', complexity: 'Med', assignees: [dev._id], deadline: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000) },
      { title: 'Shopping Cart Implementation', description: 'Implement cart functionality with add/remove items and quantity management', status: 'In Progress', priority: 'High', complexity: 'Low', assignees: [dev._id], deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
      { title: 'User Dashboard', description: 'Create user dashboard with order history, profile management, and preferences', status: 'In Progress', priority: 'Medium', complexity: 'Med', assignees: [dev._id], deadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000) },
      { title: 'Admin Panel Setup', description: 'Build admin panel for managing products, orders, and users', status: 'In Progress', priority: 'High', complexity: 'High', assignees: [dev._id], deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000) },
      
      // Review tasks (3 tasks)
      { title: 'Mobile Responsive Design', description: 'Ensure all pages are fully responsive and optimized for mobile devices', status: 'Review', priority: 'High', complexity: 'Med', assignees: [dev._id], deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
      { title: 'Performance Optimization', description: 'Optimize page load times, implement lazy loading, and code splitting', status: 'Review', priority: 'Medium', complexity: 'Med', assignees: [dev._id], deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
      { title: 'Security Audit', description: 'Conduct security audit and implement necessary security measures', status: 'Review', priority: 'Critical', complexity: 'High', assignees: [dev._id], deadline: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000) },
      
      // Done tasks (2 tasks)
      { title: 'Project Setup & Configuration', description: 'Initialize project repository, set up development environment, and configure build tools', status: 'Done', priority: 'High', complexity: 'Low', assignees: [dev._id], deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { title: 'Requirements Gathering', description: 'Collect and document all project requirements from stakeholders', status: 'Done', priority: 'High', complexity: 'Low', assignees: [pm._id], deadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    ];
    
    // Total: 15 tasks (5 Todo + 5 In Progress + 3 Review + 2 Done)

    const tasks = [];
    for (const template of taskTemplates) {
      const task = await Task.create({
        projectId: project._id, // Task model uses 'projectId' field
        ...template,
        createdBy: dev._id, // Set creator
        risk: {
          probability: Math.floor(Math.random() * 3) + 1, // 1-3
          impact: Math.floor(Math.random() * 3) + 1, // 1-3
          auto_score: 1,
          isAutoAdjusted: false,
        },
      });
      tasks.push(task);
    }

    // Add time logs to some tasks to generate actual cost
    // Mix of Low/Med/High complexity tasks with time logs
    console.log('⏱️  Adding time logs...');
    const tasksWithLogs = tasks.filter((task, idx) => {
      // Add logs to In Progress and Done tasks, plus some Todo tasks
      return task.status === 'In Progress' || task.status === 'Done' || idx < 3;
    });
    
    for (const task of tasksWithLogs) {
      // Vary hours based on complexity
      let hoursWorked;
      if (task.complexity === 'High') {
        hoursWorked = Math.floor(Math.random() * 20) + 10; // 10-30 hours
      } else if (task.complexity === 'Med') {
        hoursWorked = Math.floor(Math.random() * 12) + 6; // 6-18 hours
      } else {
        hoursWorked = Math.floor(Math.random() * 8) + 2; // 2-10 hours
      }
      
      const startTime = new Date(Date.now() - (hoursWorked * 60 * 60 * 1000));
      const endTime = new Date();

      task.timeLogs.push({
        userId: task.assignees[0] || dev._id, // Use task assignee or default to dev
        startTime,
        endTime,
        duration: hoursWorked * 3600, // in seconds
      });
      await task.save();
    }

    console.log(`✅ Created ${tasks.length} tasks with time logs`);

    // Create Transactions
    console.log('💰 Creating transactions...');

    const transactions = [
      {
        projectId: project._id, // Transaction model uses 'projectId' field
        amount: 500,
        type: '-',
        source: 'Software Licenses',
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        authorId: owner._id,
        description: 'Annual subscription for development tools and software licenses',
      },
      {
        projectId: project._id,
        amount: 1200,
        type: '-',
        source: 'Cloud Infrastructure',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        authorId: owner._id,
        description: 'Monthly cloud hosting and infrastructure costs',
      },
      {
        projectId: project._id,
        amount: 2000,
        type: '+',
        source: 'Client Payment',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        authorId: owner._id,
        description: 'Milestone payment received from client',
      },
    ];

    for (const transaction of transactions) {
      await Transaction.create(transaction);
    }

    console.log(`✅ Created ${transactions.length} transactions`);

    // Update task risks with some auto-adjusted scores
    console.log('⚠️  Setting up risk matrix...');
    const riskTasks = tasks.slice(0, 5);
    const riskConfigs = [
      { probability: 3, impact: 4, autoAdjusted: true },
      { probability: 4, impact: 3, autoAdjusted: true },
      { probability: 2, impact: 5, autoAdjusted: false },
      { probability: 5, impact: 2, autoAdjusted: false },
      { probability: 3, impact: 3, autoAdjusted: false },
    ];

    for (let i = 0; i < riskTasks.length; i++) {
      const task = riskTasks[i];
      const config = riskConfigs[i];
      const autoScore = config.probability * config.impact;

      task.risk = {
        probability: config.probability,
        impact: config.impact,
        auto_score: autoScore,
        isAutoAdjusted: config.autoAdjusted,
        autoAdjustReason: config.autoAdjusted ? 'Deadline approaching and budget constraints' : null,
      };
      await task.save();
    }

    console.log('✅ Risk matrix configured');

    // Summary
    console.log('\n📊 Seed Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 Users: ${await User.countDocuments()}`);
    console.log(`📁 Projects: ${await Project.countDocuments()}`);
    console.log(`📋 Tasks: ${await Task.countDocuments()}`);
    console.log(`💰 Transactions: ${await Transaction.countDocuments()}`);
    console.log('\n🔑 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Owner: owner@kbm.com / 123456');
    console.log('PM: pm@kbm.com / (create in Firebase)');
    console.log('Dev: dev@kbm.com / (create in Firebase)');
    console.log('\n📁 Project Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Project ID: ${project._id}`);
    console.log(`Project Password: ${projectPassword}`);
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n⚠️  Note: You need to create Firebase accounts for pm@kbm.com and dev@kbm.com');
    console.log('   Then sync them via /api/auth/sync to link with MongoDB users.');
    console.log('\n   For owner@kbm.com, create a Firebase account with password: 123456');
    console.log('   Then login and the user will be automatically synced.');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

// Run seed
seedDatabase();

