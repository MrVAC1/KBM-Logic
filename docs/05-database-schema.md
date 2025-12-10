# Database Schema

## Overview

KBM Logic v3.0 uses **MongoDB Atlas** with **Mongoose ODM** for data modeling. This document provides a reference for key database schemas and their relationships.

## Core Models

### Project

The **Project** model is the central entity, containing all project configuration, members, roles, and financial data.

#### Schema Structure

```javascript
{
  // Basic Information
  name: String (required, trimmed),
  description: String (trimmed),
  passwordHash: String (required, select: false),
  ownerId: ObjectId (required, ref: 'User', indexed),
  
  // Financial Configuration
  fixedCosts: [{
    title: String (required),
    amount: Number (required, min: 0),
    frequency: 'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    currency: String (default: 'USD')
  }],
  
  // Role Compensation
  roles: [{
    name: String (required),
    currentRate: Number (default: 0, min: 0),
    salaryHistory: [{
      rate: Number (required, min: 0),
      effectiveDate: Date (required)
    }]
  }],
  
  // Custom Roles
  customRoles: [{
    name: String (required, trimmed),
    color: String (required, default: '#6b7280'),
    hierarchy: Number (default: 200),
    permissions: [String (enum: ALL_PERMISSIONS)],
    createdAt: Date (default: Date.now)
  }],
  
  // Members
  members: [{
    userId: ObjectId (required, ref: 'User'),
    roles: [String],           // Multiple roles support
    roleName: String (required, default: 'Guest'),  // Legacy field
    permissions: [String (enum: ALL_PERMISSIONS)],
    hourlyRate: Number (default: 0),
    joinedAt: Date (default: Date.now),
    notificationSettings: {
      notifyOnTaskAssignment: Boolean (default: true),
      notifyOnBudgetRisk: Boolean (default: true),
      notifyOnRoleChange: Boolean (default: true),
      notifyOnTaskOverdue: Boolean (default: true),
      notifyOnTaskCompleted: Boolean (default: true)
    }
  }],
  
  // Work Schedule
  workSchedule: {
    workingDays: [Number] (default: [1,2,3,4,5]),  // 0=Sun, 6=Sat
    hoursPerDay: Number (min: 1, max: 24, default: 8)
  },
  
  // Departments
  departments: [{
    _id: ObjectId (auto),
    name: String (required, trimmed),
    memberIds: [ObjectId (ref: 'User')],
    createdAt: Date (default: Date.now)
  }],
  
  // Banned Users
  bannedUsers: [{
    userId: ObjectId (required, ref: 'User'),
    email: String (required),
    reason: String (required),
    bannedAt: Date (default: Date.now),
    bannedBy: ObjectId (ref: 'User')
  }],
  
  // Financial Data
  deadline: Date (nullable),
  inviteCode: String,
  evmSnapshots: [{
    date: Date,
    PV: Number,
    AC: Number,
    EV: Number
  }],
  
  // Timestamps
  createdAt: Date (default: Date.now),
  updatedAt: Date (default: Date.now)
}
```

#### Key Fields

**`workSchedule`** - Critical for financial calculations:
- `workingDays`: Array of day numbers (0=Sunday, 6=Saturday)
- `hoursPerDay`: Hours worked per day (default: 8)
- Used by EVM engine to calculate working days and hourly rates

**`roles`** - Role compensation data:
- `currentRate`: Current monthly salary
- `salaryHistory`: Historical rate changes with effective dates
- Used for AC calculation with historical accuracy

**`evmSnapshots`** - Cached EVM calculations:
- Generated daily via cron job
- Regenerated when retroactive transactions are created
- Used for S-Curve chart data

#### Indexes

```javascript
projectSchema.index({ ownerId: 1 });
projectSchema.index({ inviteCode: 1 });
```

### Transaction

The **Transaction** model stores financial transactions (income and expenses).

#### Schema Structure

```javascript
{
  projectId: ObjectId (required, ref: 'Project', indexed),
  amount: Number (required),
  type: '+' | '-' (required),  // '+' = income, '-' = expense
  source: String (required, trimmed),
  date: Date (required, immutable, indexed),  // Legacy field
  effectiveDate: Date (required, default: Date.now, indexed),
  authorId: ObjectId (required, ref: 'User'),
  description: String,
  
  // Timestamps (automatic)
  createdAt: Date,
  updatedAt: Date
}
```

#### Key Fields

**`effectiveDate`** - Financial impact date:
- Used for AC calculation (when transaction affects budget)
- Can be set to past dates for retroactive entries
- Triggers snapshot regeneration if in the past

**`createdAt`** - Audit trail:
- When transaction was entered into system
- Preserved for audit purposes
- Not used in financial calculations

**`date`** - Legacy field:
- Set to `effectiveDate` value
- Immutable (cannot be changed)
- Maintained for backward compatibility

#### Indexes

```javascript
transactionSchema.index({ projectId: 1, type: 1, effectiveDate: -1 });
transactionSchema.index({ projectId: 1, effectiveDate: -1 });
transactionSchema.index({ projectId: 1, type: 1 });
```

**Optimization:** Indexes support efficient queries for:
- Remaining budget calculation (income/expenses by effective date)
- Transaction history lookup
- Transaction filtering by type

### Task

The **Task** model represents work items in the Kanban board.

#### Schema Structure

```javascript
{
  projectId: ObjectId (required, ref: 'Project', indexed),
  title: String (required, trimmed),
  description: String (trimmed),
  status: 'Todo' | 'In Progress' | 'Review' | 'Done' (default: 'Todo', indexed),
  priority: 'Low' | 'Medium' | 'High' | 'Critical' (default: 'Medium'),
  complexity: 'Low' | 'Med' | 'High' (default: 'Med'),
  assignees: [ObjectId (ref: 'User')],
  startDate: Date,
  deadline: Date (indexed),
  estimateHours: Number (required, min: 0),
  plannedValue: Number (default: 0, min: 0),
  plannedCost: Number (default: 0, min: 0),
  timeLogs: [{
    userId: ObjectId (required, ref: 'User'),
    startTime: Date (required),
    endTime: Date,
    duration: Number (default: 0),  // seconds
    description: String
  }],
  risk: {
    probability: Number (min: 1, max: 5, default: 1),
    impact: Number (min: 1, max: 5, default: 1),
    auto_score: Number (default: 1),
    isAutoAdjusted: Boolean (default: false),
    autoAdjustReason: String
  },
  
  // Timestamps
  createdAt: Date (default: Date.now),
  updatedAt: Date (default: Date.now)
}
```

#### Key Fields

**`plannedValue`** and **`plannedCost`**:
- Both store the same value (task budget)
- Calculated: `Duration (hours) × Average Hourly Rate`
- Used for PV and EV calculations

**`timeLogs`**:
- Array of time tracking entries
- Each entry tracks one timer session
- `duration` calculated when timer stops

**`risk`**:
- Auto-calculated risk score
- `auto_score = probability × impact`
- Adjusted by risk engine based on deadline/budget

#### Indexes

```javascript
taskSchema.index({ projectId: 1, status: 1, updatedAt: -1 });
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ deadline: 1 });
```

**Optimization:** Indexes support:
- EV calculation (completed tasks by date)
- Project tasks lookup
- Assignee filtering
- Deadline-based queries

### User

The **User** model stores user account information.

#### Schema Structure

```javascript
{
  uid: String (required, unique, indexed),  // Firebase UID
  email: String (required, unique, indexed),
  displayName: String,
  avatar: String,
  
  // Timestamps
  createdAt: Date (default: Date.now),
  updatedAt: Date (default: Date.now)
}
```

#### Key Fields

**`uid`** - Firebase User ID:
- Primary identifier from Firebase Auth
- Used for authentication and authorization
- Unique across all users

**`email`** - User email:
- Used for display and notifications
- Must be unique

#### Indexes

```javascript
userSchema.index({ uid: 1 });
userSchema.index({ email: 1 });
```

### Expense

The **Expense** model stores recurring fixed costs.

#### Schema Structure

```javascript
{
  projectId: ObjectId (required, ref: 'Project', indexed),
  name: String (required, trimmed),
  amount: Number (required, min: 0),
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' (default: 'monthly'),
  createdBy: ObjectId (ref: 'User'),
  updatedBy: ObjectId (ref: 'User'),
  
  // Timestamps
  createdAt: Date (default: Date.now),
  updatedAt: Date (default: Date.now)
}
```

#### Key Fields

**`frequency`** - Accrual frequency:
- `daily`: Accrues every working day
- `weekly`: Accrues once per week
- `monthly`: Accrues once per month (21 working days)
- `yearly`: Accrues once per year

Used by AC calculation to determine when expense affects budget.

### Snapshot (Embedded)

**Snapshots** are stored as an embedded array in the Project model (`evmSnapshots`).

#### Structure

```javascript
{
  date: Date,
  PV: Number,
  AC: Number,
  EV: Number
}
```

#### Usage

- Generated daily via `dailyEVMJob.js`
- Regenerated when retroactive transactions are created
- Used for S-Curve chart historical data
- Optimizes performance (avoids recalculating past dates)

## Relationships

### Project → Members → Users

```
Project.members[].userId → User._id
```

**Relationship Type:** One-to-Many (Project has many Members, each references one User)

### Project → Tasks

```
Task.projectId → Project._id
```

**Relationship Type:** One-to-Many (Project has many Tasks)

### Project → Transactions

```
Transaction.projectId → Project._id
```

**Relationship Type:** One-to-Many (Project has many Transactions)

### Task → Assignees → Users

```
Task.assignees[] → User._id
```

**Relationship Type:** Many-to-Many (Task can have many Users, User can be on many Tasks)

## Data Integrity

### Referential Integrity

MongoDB does not enforce foreign key constraints. The application handles referential integrity:

- **On Delete:** Cascade deletes are handled in application code
- **On Update:** References are validated before operations
- **Orphaned Data:** Cleanup scripts handle orphaned records

### Validation

Mongoose schemas include validation:
- **Required Fields:** Enforced at schema level
- **Type Checking:** Automatic type coercion and validation
- **Enum Values:** Restricted to allowed values
- **Min/Max:** Numeric range validation

## Indexing Strategy

### Performance Optimization

Indexes are optimized for common query patterns:

1. **Project Lookups:** `projectId` indexed on all related models
2. **Status Filtering:** `status` indexed on Task model
3. **Date Range Queries:** `effectiveDate`, `deadline` indexed
4. **User References:** `userId`, `uid`, `email` indexed

### Atlas Optimization

Indexes are designed for MongoDB Atlas:
- Compound indexes for multi-field queries
- Sparse indexes for optional fields
- TTL indexes not used (data retention handled in application)

## Best Practices

1. **Use Indexes:** Always query by indexed fields when possible
2. **Populate Sparingly:** Use `.lean()` for read-only queries
3. **Batch Operations:** Use bulk operations for multiple updates
4. **Validate Early:** Validate data before database operations
5. **Monitor Performance:** Use Atlas Performance Advisor for index recommendations

## Related Documentation

- **[Financial Engine](./02-financial-engine.md)** - How schemas support EVM calculations
- **[Roles and Permissions](./03-roles-and-permissions.md)** - Role and Member schemas
- **[Architecture](./01-architecture-and-setup.md)** - Database connection and setup

