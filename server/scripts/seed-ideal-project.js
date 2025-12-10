/**
 * Database Seeding Script - KBM Logic v3.1 "Golden Path" Ideal Project
 * 
 * Creates a perfect project scenario where PV, AC, and EV track closely together,
 * demonstrating a healthy, profitable, predictable project execution.
 * 
 * Project: "SaaS Platform 2.0 (Ideal State)"
 * Timeline: Started 6 months ago, Deadline in 2 months (8 months total)
 * 
 * Usage: node server/scripts/seed-ideal-project.js
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

// ============================================
// ROLE DEFINITIONS (Stable & Efficient Team)
// ============================================

const IDEAL_ROLES = [
  { 
    name: "Senior Dev", 
    currentRate: 6000,
    color: '#3b82f6', // Blue
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "Mid Dev", 
    currentRate: 4000,
    color: '#22c55e', // Green
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "QA Engineer", 
    currentRate: 3000,
    color: '#eab308', // Yellow
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_edit_tasks']
  },
  { 
    name: "UI/UX Designer", 
    currentRate: 3500,
    color: '#f97316', // Orange
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_create_tasks', 'can_edit_tasks']
  },
  { 
    name: "Product Manager", 
    currentRate: 5500,
    color: '#ef4444', // Red
    permissions: ['can_view_dashboard', 'can_view_tasks', 'can_view_financial', 'can_create_tasks', 'can_edit_tasks', 'can_view_risks']
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a simple UID from email (for seeding purposes)
 * Uses full base64 encoding to ensure uniqueness
 */
const generateUID = (email) => {
  const base64 = Buffer.from(email).toString('base64');
  // Use full base64 but replace characters that might cause issues
  const safeBase64 = base64.replace(/[+/=]/g, (char) => {
    if (char === '+') return '-';
    if (char === '/') return '_';
    if (char === '=') return '';
    return char;
  });
  return `seed_${safeBase64}`;
};

/**
 * Format roles for project.roles array (financial compensation)
 * @param {Array} rolesConfig - Role definitions
 * @param {Date} effectiveDate - Effective date for salary history
 * @returns {Array} - Formatted roles array
 */
const formatRolesForProject = (rolesConfig, effectiveDate) => {
  return rolesConfig.map(role => ({
    name: role.name,
    currentRate: role.currentRate,
    salaryHistory: [{ rate: role.currentRate, effectiveDate: effectiveDate }],
  }));
};

/**
 * Format roles for project.customRoles array (Roles tab UI)
 * @param {Array} rolesConfig - Role definitions
 * @returns {Array} - Formatted custom roles array
 */
const formatCustomRolesForProject = (rolesConfig) => {
  return rolesConfig.map(role => ({
    name: role.name,
    color: role.color,
    permissions: role.permissions,
    createdAt: new Date(),
  }));
};

/**
 * Get first day of month
 */
const getFirstOfMonth = (date) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get last day of month
 */
const getLastOfMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Add months to date
 */
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// ============================================
// MAIN SEEDING FUNCTION
// ============================================

const seedIdealProject = async () => {
  try {
    console.log('🌱 Starting KBM Logic v3.1 Ideal Project Seed...\n');

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

    // Find or create owner
    let owner = await User.findOne({ email: 'owner@kbm.com' });
    if (!owner) {
      throw new Error('Owner user (owner@kbm.com) not found. Please create this user first.');
    }
    console.log(`✅ Found owner: ${owner.email} (${owner._id})\n`);

    // Check if project already exists
    const existingProject = await Project.findOne({ 
      name: 'SaaS Platform 2.0 (Ideal State)',
      ownerId: owner._id 
    });

    if (existingProject) {
      console.log('⚠️  Project "SaaS Platform 2.0 (Ideal State)" already exists.');
      console.log('   Deleting existing project and recreating...\n');
      
      // Delete related data
      await Task.deleteMany({ projectId: existingProject._id });
      await Transaction.deleteMany({ projectId: existingProject._id });
      await Project.deleteOne({ _id: existingProject._id });
      console.log('✅ Cleaned up existing project data\n');
    }

    // ============================================
    // PROJECT TIMELINE
    // ============================================
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Project started 6 months ago
    const projectStartDate = addMonths(today, -6);
    projectStartDate.setDate(1); // First of month
    projectStartDate.setHours(0, 0, 0, 0);
    
    // Deadline in 2 months
    const projectDeadline = addMonths(today, 2);
    projectDeadline.setDate(0); // Last day of month
    projectDeadline.setHours(23, 59, 59, 999);

    console.log(`📅 Project Timeline:`);
    console.log(`   Start: ${projectStartDate.toISOString().split('T')[0]}`);
    console.log(`   Today: ${today.toISOString().split('T')[0]}`);
    console.log(`   Deadline: ${projectDeadline.toISOString().split('T')[0]}\n`);

    // ============================================
    // CREATE TEAM MEMBERS
    // ============================================
    console.log('👥 Creating team members...');
    
    const teamMembers = [];
    const roleDistribution = [
      { role: 'Senior Dev', count: 3 },
      { role: 'Mid Dev', count: 3 },
      { role: 'QA Engineer', count: 2 },
      { role: 'UI/UX Designer', count: 1 },
      { role: 'Product Manager', count: 1 },
    ];

    let memberIndex = 0;
    for (const { role, count } of roleDistribution) {
      for (let i = 0; i < count; i++) {
        const email = `ideal-${role.toLowerCase().replace(/\s+/g, '-')}-${i + 1}@demo.com`;
        const name = `${role} ${i + 1}`;
        
        let user = await User.findOne({ email });
        if (!user) {
          const uid = generateUID(email);
          // Check if UID already exists (from previous run)
          const existingUserByUID = await User.findOne({ uid });
          if (existingUserByUID) {
            // Use existing user if found by UID
            user = existingUserByUID;
            console.log(`   ✅ Found existing user by UID: ${name} (${email})`);
          } else {
            // Create new user
            user = await User.create({
              uid,
              email,
              displayName: name,
              role: 'User',
              emailVerified: true,
            });
            console.log(`   ✅ Created: ${name} (${email})`);
          }
        } else {
          console.log(`   ✅ Found: ${name} (${email})`);
        }
        
        teamMembers.push({
          user,
          role,
          roleIndex: memberIndex++,
        });
      }
    }

    console.log(`\n✅ Created ${teamMembers.length} team members\n`);

    // ============================================
    // SETUP PROJECT ROLES
    // ============================================
    const projectRoles = [
      { name: 'Owner', currentRate: 0, salaryHistory: [{ rate: 0, effectiveDate: projectStartDate }] },
      { name: 'Guest', currentRate: 0, salaryHistory: [{ rate: 0, effectiveDate: projectStartDate }] },
      ...formatRolesForProject(IDEAL_ROLES, projectStartDate),
    ];

    const projectCustomRoles = formatCustomRolesForProject(IDEAL_ROLES);

    // ============================================
    // CREATE PROJECT MEMBERS ARRAY
    // ============================================
    const projectMembers = [
      {
        userId: owner._id,
        roles: ['Owner', 'Product Manager'], // Owner also has functional role
        roleName: 'Owner',
        permissions: ALL_PERMISSIONS,
        joinedAt: projectStartDate, // CRITICAL: Active from Day 1
      },
    ];

    // Add team members
    for (const { user, role } of teamMembers) {
      projectMembers.push({
        userId: user._id,
        roles: [role],
        roleName: role,
        permissions: IDEAL_ROLES.find(r => r.name === role)?.permissions || [],
        joinedAt: projectStartDate, // CRITICAL: Active from Day 1
      });
    }

    // ============================================
    // CREATE PROJECT
    // ============================================
    console.log('📦 Creating project...');
    
    const projectPasswordHash = await bcrypt.hash('ideal2024', 10);
    
    const project = await Project.create({
      name: 'SaaS Platform 2.0 (Ideal State)',
      description: 'A perfect project execution demonstrating ideal EVM metrics. PV, AC, and EV track closely together, showing predictable, healthy, profitable project delivery. This is the "Golden Path" scenario for KBM Logic v3.1.',
      passwordHash: projectPasswordHash,
      ownerId: owner._id,
      workSchedule: {
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        hoursPerDay: 8,
      },
      roles: projectRoles,
      customRoles: projectCustomRoles,
      members: projectMembers,
      deadline: projectDeadline,
      createdAt: projectStartDate, // Historical start date
    });

    console.log(`✅ Created project: ${project.name} (${project._id})\n`);

    // ============================================
    // CREATE INCOME TRANSACTION
    // ============================================
    console.log('💰 Creating income transaction...');
    
    await Transaction.create({
      projectId: project._id,
      type: '+',
      amount: 800000,
      source: 'Upfront Investment',
      date: projectStartDate, // Historical date (immutable)
      effectiveDate: projectStartDate, // Historical date
      authorId: owner._id,
      description: 'Upfront Investment - SaaS Platform 2.0 Development',
    });

    console.log('✅ Created $800,000 income transaction\n');

    // ============================================
    // CREATE TASKS (Salary-Driven Task Estimation)
    // ============================================
    console.log('📋 Creating tasks with salary-driven estimation (EV = AC)...\n');

    // Helper to get random integer between min and max (inclusive)
    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Helper to get random date within a week
    const getRandomDateInWeek = (weekStart) => {
      const daysOffset = randomInt(0, 6); // Random day within the week (0-6)
      const randomDate = new Date(weekStart);
      randomDate.setDate(weekStart.getDate() + daysOffset);
      // Random time during workday (9 AM to 5 PM)
      const randomHour = randomInt(9, 17);
      randomDate.setHours(randomHour, 0, 0, 0);
      return randomDate;
    };
    
    // Helper to calculate hourly rate from monthly rate
    const calculateHourlyRate = (monthlyRate, workSchedule) => {
      const hoursPerDay = workSchedule?.hoursPerDay || 8;
      const workingDaysPerWeek = workSchedule?.workingDays?.length || 5;
      // Approximate working days per month: (workingDaysPerWeek / 7) * 30.44
      const workingDaysPerMonth = (workingDaysPerWeek / 7) * 30.44;
      const hoursPerMonth = hoursPerDay * workingDaysPerMonth;
      return hoursPerMonth > 0 ? monthlyRate / hoursPerMonth : 0;
    };

    // ============================================
    // Calculate Total Monthly Team Cost
    // ============================================
    const workSchedule = project.workSchedule || { workingDays: [1, 2, 3, 4, 5], hoursPerDay: 8 };
    let totalMonthlyTeamCost = 0;
    
    // Calculate total monthly cost for all team members (excluding owner)
    for (const { role } of teamMembers) {
      const roleDef = IDEAL_ROLES.find(r => r.name === role);
      if (roleDef) {
        totalMonthlyTeamCost += roleDef.currentRate;
      }
    }
    
    console.log(`💰 Total Monthly Team Cost: $${totalMonthlyTeamCost.toLocaleString()}\n`);

    // ============================================
    // PHASE 1: Historical Completion (Month by Month)
    // ============================================
    console.log('📅 Generating historical task completions (month by month)...\n');
    
    const tasks = [];
    let currentMonth = new Date(projectStartDate);
    currentMonth.setDate(1); // First of month
    currentMonth.setHours(0, 0, 0, 0);
    
    const todayMonthStart = getFirstOfMonth(today);
    let monthNumber = 1;
    let completedTasksCount = 0;

    // Iterate through past months
    while (currentMonth < todayMonthStart) {
      const monthStart = new Date(currentMonth);
      const monthEnd = getLastOfMonth(currentMonth);
      
      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`   📅 Month ${monthNumber}: ${monthLabel}`);
      
      // Target: Generate tasks that sum to monthly team cost
      // Strategy: Create 12-18 tasks per month, distributed across weeks
      const tasksPerMonth = randomInt(12, 18);
      const targetPVPerTask = totalMonthlyTeamCost / tasksPerMonth;
      
      console.log(`      Generating ${tasksPerMonth} tasks (Target PV per task: $${targetPVPerTask.toFixed(2)})`);
      
      // Distribute tasks across weeks in the month
      const weeksInMonth = Math.ceil(monthEnd.getDate() / 7);
      const tasksPerWeek = Math.ceil(tasksPerMonth / weeksInMonth);
      
      let weekStart = new Date(monthStart);
      let taskIndexInMonth = 0;
      
      while (weekStart <= monthEnd && taskIndexInMonth < tasksPerMonth) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        // Generate tasks for this week
        const tasksThisWeek = Math.min(tasksPerWeek, tasksPerMonth - taskIndexInMonth);
        
        for (let i = 0; i < tasksThisWeek; i++) {
          // Select random role and user
          const randomMemberIndex = randomInt(0, teamMembers.length - 1);
          const { user, role } = teamMembers[randomMemberIndex];
          
          // Get role's monthly rate and calculate hourly rate
          const roleDef = IDEAL_ROLES.find(r => r.name === role);
          const monthlyRate = roleDef ? roleDef.currentRate : 4000; // Fallback
          const hourlyRate = calculateHourlyRate(monthlyRate, workSchedule);
          
          // CRITICAL: Calculate estimateHours to match target PV
          // PV = estimateHours × hourlyRate
          // Therefore: estimateHours = targetPVPerTask / hourlyRate
          // Add small random variation (±10%) to make it more realistic
          const baseEstimateHours = hourlyRate > 0 
            ? targetPVPerTask / hourlyRate
            : 12; // Fallback if rate is 0
          const variation = baseEstimateHours * 0.1 * (Math.random() * 2 - 1); // ±10%
          const estimateHours = Math.max(1, Math.round((baseEstimateHours + variation) * 10) / 10); // Min 1 hour, round to 1 decimal
          
          // Generate task details
          const taskNumber = completedTasksCount + 1;
          const taskTitle = `${role} - Task #${taskNumber}`;
          
          // Completion date: random date within this week
          const completionDate = getRandomDateInWeek(weekStart);
          
          // Task start date: beginning of the week (or slightly before)
          const taskStartDate = new Date(weekStart);
          const daysBeforeStart = randomInt(0, 2);
          taskStartDate.setDate(taskStartDate.getDate() - daysBeforeStart);
          
          // Task deadline: end of week (or slightly after)
          const taskDeadline = new Date(weekEnd);
          const daysAfterEnd = randomInt(0, 1);
          taskDeadline.setDate(taskDeadline.getDate() + daysAfterEnd);
          
          // CRITICAL: Mongoose timestamps will overwrite updatedAt during creation
          // Solution: Create task first, then update updatedAt separately
          const task = await Task.create({
            projectId: project._id,
            title: taskTitle,
            description: `Task completed in ${monthLabel}. Estimated ${estimateHours} hours (PV: $${(estimateHours * hourlyRate).toFixed(2)}).`,
            status: 'Done',
            priority: randomInt(0, 2) === 0 ? 'High' : randomInt(0, 1) === 0 ? 'Medium' : 'Low',
            complexity: randomInt(0, 2) === 0 ? 'High' : randomInt(0, 1) === 0 ? 'Med' : 'Low',
            estimateHours: estimateHours,
            assignees: [user._id],
            startDate: taskStartDate,
            deadline: taskDeadline,
          });
          
          // Update updatedAt to historical completion date (bypass Mongoose timestamps)
          await Task.findByIdAndUpdate(
            task._id,
            { updatedAt: completionDate },
            { timestamps: false } // Prevent Mongoose from overwriting
          );

          tasks.push(task);
          completedTasksCount++;
          taskIndexInMonth++;
          
          const taskPV = estimateHours * hourlyRate;
          console.log(`      ✅ ${taskTitle} (${estimateHours}h, PV: $${taskPV.toFixed(2)}) - Completed: ${completionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
        }
        
        // Move to next week
        weekStart.setDate(weekStart.getDate() + 7);
      }
      
      // Move to next month
      currentMonth = addMonths(currentMonth, 1);
      monthNumber++;
      console.log('');
    }

    console.log(`✅ Completed ${completedTasksCount} historical tasks across ${monthNumber - 1} months\n`);

    // ============================================
    // PHASE 2: Current Week (In Progress)
    // ============================================
    console.log('🔄 Creating current week tasks (In Progress)...\n');
    
    // Create 2-5 tasks for the current week
    const currentWeekTasks = randomInt(2, 5);
    const currentWeekStartDate = new Date(today);
    currentWeekStartDate.setDate(today.getDate() - (today.getDay() || 7) + 1); // Monday of current week
    currentWeekStartDate.setHours(0, 0, 0, 0);
    
    // Calculate target PV per task for current month (proportional to days passed)
    const currentMonthStart = getFirstOfMonth(today);
    const currentMonthEnd = getLastOfMonth(today);
    const daysPassedInMonth = Math.floor((today.getTime() - currentMonthStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysInMonth = currentMonthEnd.getDate();
    const monthProgress = daysPassedInMonth / daysInMonth;
    const currentMonthTargetCost = totalMonthlyTeamCost * monthProgress;
    const targetPVPerTask = currentMonthTargetCost / currentWeekTasks;
    
    for (let i = 0; i < currentWeekTasks; i++) {
      const randomMemberIndex = randomInt(0, teamMembers.length - 1);
      const { user, role } = teamMembers[randomMemberIndex];
      
      // Get role's hourly rate
      const roleDef = IDEAL_ROLES.find(r => r.name === role);
      const monthlyRate = roleDef ? roleDef.currentRate : 4000;
      const hourlyRate = calculateHourlyRate(monthlyRate, workSchedule);
      
      // Calculate estimateHours to match target PV
      const estimateHours = hourlyRate > 0 
        ? Math.round((targetPVPerTask / hourlyRate) * 10) / 10
        : randomInt(8, 16);
      
      const taskNumber = completedTasksCount + i + 1;
      
      const task = await Task.create({
        projectId: project._id,
        title: `${role} - Task #${taskNumber}`,
        description: `Task in progress for current week. Estimated ${estimateHours} hours.`,
        status: 'In Progress',
        priority: randomInt(0, 2) === 0 ? 'High' : 'Medium',
        complexity: randomInt(0, 1) === 0 ? 'Med' : 'Low',
        estimateHours: estimateHours,
        assignees: [user._id],
        startDate: currentWeekStartDate,
        deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from today
      });
      
      // For In Progress tasks, updatedAt is fine as current time (Mongoose default)

      tasks.push(task);
      console.log(`      🔄 ${role} - Task #${taskNumber} (${estimateHours}h) - In Progress`);
    }

    // ============================================
    // PHASE 3: Future Tasks (Todo)
    // ============================================
    console.log('\n📝 Creating future planned tasks (Todo)...\n');
    
    // Create tasks for the next 2 months (future)
    let futureMonth = new Date(today);
    futureMonth.setMonth(futureMonth.getMonth() + 1);
    futureMonth.setDate(1); // First of next month
    
    const futureMonthsCount = 2;
    
    for (let monthOffset = 0; monthOffset < futureMonthsCount; monthOffset++) {
      const monthStart = new Date(futureMonth);
      monthStart.setMonth(futureMonth.getMonth() + monthOffset);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthStart.getMonth() + 1);
      monthEnd.setDate(0); // Last day of month
      monthEnd.setHours(23, 59, 59, 999);
      
      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`   📅 ${monthLabel} (Future)`);
      
      // Create 3-6 tasks per future month
      const tasksPerMonth = randomInt(3, 6);
      
      // Calculate target PV per task for future month
      const targetPVPerTask = totalMonthlyTeamCost / tasksPerMonth;
      
      for (let i = 0; i < tasksPerMonth; i++) {
        const randomMemberIndex = randomInt(0, teamMembers.length - 1);
        const { user, role } = teamMembers[randomMemberIndex];
        
        // Get role's hourly rate
        const roleDef = IDEAL_ROLES.find(r => r.name === role);
        const monthlyRate = roleDef ? roleDef.currentRate : 4000;
        const hourlyRate = calculateHourlyRate(monthlyRate, workSchedule);
        
        // Calculate estimateHours to match target PV
        const baseEstimateHours = hourlyRate > 0 
          ? targetPVPerTask / hourlyRate
          : 12;
        const variation = baseEstimateHours * 0.1 * (Math.random() * 2 - 1); // ±10%
        const estimateHours = Math.max(1, Math.round((baseEstimateHours + variation) * 10) / 10);
        
        const taskNumber = tasks.length + 1;
        
        const task = await Task.create({
          projectId: project._id,
          title: `${role} - Task #${taskNumber}`,
          description: `Planned task for ${monthLabel}. Estimated ${estimateHours} hours.`,
          status: 'Todo',
          priority: randomInt(0, 2) === 0 ? 'Medium' : 'Low',
          complexity: randomInt(0, 1) === 0 ? 'Med' : 'Low',
          estimateHours: estimateHours,
          assignees: [user._id],
          startDate: monthStart,
          deadline: monthEnd,
        });
        
        // For Todo tasks, updatedAt is fine as current time (Mongoose default)

        tasks.push(task);
        console.log(`      📝 ${role} - Task #${taskNumber} (${estimateHours}h) - Todo`);
      }
    }

    console.log(`\n✅ Created ${tasks.length} total tasks (${completedTasksCount} completed, ${tasks.length - completedTasksCount} active/future)\n`);

    // ============================================
    // CREATE MINIMAL EXPENSES (Infrastructure)
    // ============================================
    console.log('💸 Creating minimal infrastructure expenses...');

    // Create monthly AWS expenses for past months
    let expenseMonth = new Date(projectStartDate);
    while (expenseMonth <= today) {
      const expenseDate = getFirstOfMonth(expenseMonth);
      
      await Transaction.create({
        projectId: project._id,
        type: '-',
        amount: 200,
        source: 'AWS Infrastructure',
        date: expenseDate, // Historical date (immutable)
        effectiveDate: expenseDate,
        authorId: owner._id,
        description: `AWS Infrastructure - ${expenseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      });

      expenseMonth = addMonths(expenseMonth, 1);
    }

    console.log(`✅ Created ${Math.ceil((today - projectStartDate) / (1000 * 60 * 60 * 24 * 30))} monthly infrastructure expenses\n`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ IDEAL PROJECT SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 Project Summary:');
    console.log(`   Name: ${project.name}`);
    console.log(`   ID: ${project._id}`);
    console.log(`   Timeline: ${projectStartDate.toISOString().split('T')[0]} → ${projectDeadline.toISOString().split('T')[0]}`);
    console.log(`   Team Size: ${projectMembers.length} members`);
    console.log(`   Tasks Created: ${tasks.length}`);
    console.log(`   Funding: $800,000`);
    console.log(`   Monthly Expenses: $200 (AWS)\n`);
    console.log('🎯 Expected Behavior:');
    console.log('   • PV, AC, and EV should track closely together');
    console.log('   • S-Curve should show smooth, predictable growth');
    console.log('   • Project should be profitable and on schedule');
    console.log('   • Each monthly sprint task = 160 hours × Role Rate');
    console.log('   • AC (salary costs) should match PV (planned work) for completed months\n');
    console.log('💡 Next Steps:');
    console.log('   1. Navigate to the Financial Dashboard');
    console.log('   2. Verify that PV, AC, and EV are aligned');
    console.log('   3. Check the S-Curve chart for smooth tracking');
    console.log('   4. Run "Recalculate Financials" if needed\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding ideal project:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the seeding function
seedIdealProject();

