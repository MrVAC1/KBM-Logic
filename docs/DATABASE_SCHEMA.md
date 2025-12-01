# Database Schema Documentation

This document describes the MongoDB database schema for KBM Logic, including all models, their fields, relationships, and design decisions.

---

## Overview

KBM Logic uses MongoDB with Mongoose ODM. The database consists of 4 main collections:

1. **users** - User accounts (synced from Firebase Auth)
2. **projects** - Project definitions with inline role data
3. **tasks** - Task items with time tracking and risk data
4. **transactions** - Financial transactions (income/expenses)

---

## User Model

**File**: `server/models/User.js`  
**Collection**: `users`

### Schema Definition

```javascript
{
  uid: String,              // Firebase UID (unique, indexed)
  email: String,            // Required, unique, lowercase
  displayName: String,      // User's display name
  avatar: String,           // Avatar URL
  role: String,             // Enum: 'Pending' | 'User' | 'Admin'
  emailVerified: Boolean,   // Firebase email verification status
  phoneNumber: String,      // Optional phone number
  profile: {
    bio: String,
    location: String
  },
  createdProjects: [ObjectId],  // Array of Project IDs (ref: 'Project')
  projectsCount: Number,        // Count of created projects
  createdAt: Date,
  updatedAt: Date
}
```

### Key Features

- **Primary Key**: `uid` (Firebase UID string, not MongoDB ObjectId)
- **Unique Constraints**: `uid`, `email`
- **Indexes**: `uid` (for fast Firebase lookups)

### Relationships

- **One-to-Many**: `createdProjects` → `Project.ownerId`
- **Many-to-Many**: Referenced in `Project.members[].userId`

### Data Flow

- User data is synced from Firebase Auth to MongoDB on login
- Profile updates are stored in MongoDB
- `createdProjects` array is updated when user creates a project

---

## Project Model

**File**: `server/models/Project.js`  
**Collection**: `projects`

### Schema Definition

```javascript
{
  name: String,                  // Required, trimmed
  description: String,           // Optional project description
  passwordHash: String,          // Bcrypt hashed (select: false)
  ownerId: ObjectId,             // Ref: 'User' (indexed)
  fixedCosts: [{
    title: String,               // Cost item name
    amount: Number,              // Amount (min: 0)
    frequency: String,           // Enum: 'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly'
    currency: String             // Default: 'USD'
  }],
  members: [{                    // Embedded member documents
    userId: ObjectId,            // Ref: 'User' (required)
    roleName: String,            // Enum: 'Owner' | 'Admin' | 'PM' | 'Developer' | 'Guest'
    permissions: [String],       // Array of permission strings
    hourlyRate: Number,          // Default: 0
    joinedAt: Date              // Default: Date.now
  }],
  inviteCode: String,            // Unique, sparse, auto-generated
  isDeleted: Boolean,            // Soft delete flag (indexed)
  createdAt: Date,
  updatedAt: Date
}
```

### Key Design Decision: Inline Role Data

**Important**: Role data is stored **inline** in the `members` array, not in a separate collection.

**Benefits**:
- Role data always available when querying members
- No additional populate queries needed
- Simpler permission checking
- Better performance

**Structure**:
Each member document contains:
- `roleName`: The role identifier
- `permissions`: Array of permission strings specific to this member
- `hourlyRate`: Member's hourly rate for cost calculations

### Default Roles

The Project model has a static method `getDefaultRoles()` that returns:

1. **Owner**
   - Permissions: ALL_PERMISSIONS
   - Hierarchy: 0

2. **Admin**
   - Permissions: View all, edit all (except delete project)
   - Hierarchy: 10

3. **PM** (Project Manager)
   - Permissions: View all, create/edit tasks, invite users
   - Hierarchy: 20

4. **Developer**
   - Permissions: View tasks/risks, track time, create/edit tasks
   - Hierarchy: 30

5. **Guest**
   - Permissions: None (empty array)
   - Hierarchy: 100

### Available Permissions

```javascript
[
  'can_view_dashboard',
  'can_view_tasks',
  'can_view_risks',
  'can_view_financial',
  'can_track_time',
  'can_create_tasks',
  'can_edit_tasks',
  'can_delete_tasks',
  'can_edit_budget',
  'can_manage_roles',
  'can_invite_users',
  'can_manage_settings',
  'can_delete_project'
]
```

### Relationships

- **Many-to-One**: `ownerId` → `User._id`
- **Many-to-Many**: `members[].userId` → `User._id`
- **One-to-Many**: Referenced in `Task.projectId`
- **One-to-Many**: Referenced in `Transaction.projectId`

### Indexes

- `{ ownerId: 1, isDeleted: 1 }` - Fast queries for user's projects
- `{ inviteCode: 1 }` - Fast invite code lookups

### Auto-Generated Fields

- `inviteCode`: Generated before save if not provided
- Format: Random alphanumeric string (30 characters)

---

## Task Model

**File**: `server/models/Task.js`  
**Collection**: `tasks`

### Schema Definition

```javascript
{
  projectId: ObjectId,           // Ref: 'Project' (indexed)
  title: String,                 // Required, trimmed
  description: String,           // Optional task description
  status: String,                // Enum: 'Todo' | 'In Progress' | 'Review' | 'Done'
  priority: String,              // Enum: 'Low' | 'Medium' | 'High' | 'Critical'
  complexity: String,            // Enum: 'Low' | 'Med' | 'High'
  assignees: [ObjectId],         // Array of User IDs (ref: 'User')
  deadline: Date,                // Optional task deadline
  timeLogs: [{
    userId: ObjectId,            // Ref: 'User' (required)
    startTime: Date,             // Required
    endTime: Date,               // Optional (null if timer running)
    duration: Number,            // Duration in seconds
    description: String          // Optional log description
  }],
  risk: {
    probability: Number,         // 1-5 (min: 1, max: 5, default: 1)
    impact: Number,              // 1-5 (min: 1, max: 5, default: 1)
    auto_score: Number,          // Calculated: probability × impact
    isAutoAdjusted: Boolean,     // True if auto-adjusted by risk engine
    autoAdjustReason: String     // Reason for auto-adjustment
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Key Features

- **Time Logs**: Embedded subdocuments for time tracking
- **Risk Data**: Embedded object (not a separate collection)
- **Status Workflow**: Todo → In Progress → Review → Done

### Relationships

- **Many-to-One**: `projectId` → `Project._id`
- **Many-to-Many**: `assignees[]` → `User._id`

### Indexes

- `{ projectId: 1, status: 1 }` - Fast queries by project and status
- `{ assignees: 1 }` - Fast queries for user's assigned tasks
- `{ deadline: 1 }` - Fast deadline queries (for risk calculations)

### Risk Score Calculation

The `risk.auto_score` is calculated as:
```
auto_score = probability × impact
```

Range: 1-25 (1×1 = 1, 5×5 = 25)

The risk engine automatically adjusts `probability` and recalculates `auto_score` based on:
- Deadline proximity (if < 2 days, probability +1)
- Budget status (future: if overrun, probability +1)

### Time Log Structure

Each time log entry represents a work session:
- `startTime`: When the timer started
- `endTime`: When the timer stopped (null if still running)
- `duration`: Calculated duration in seconds
- Only one active timer per task (no overlapping time logs)

---

## Transaction Model

**File**: `server/models/Transaction.js`  
**Collection**: `transactions`

### Schema Definition

```javascript
{
  projectId: ObjectId,           // Ref: 'Project' (indexed)
  amount: Number,                // Required transaction amount
  type: String,                  // Enum: '+' | '-'
  source: String,                // Required, trimmed (transaction source)
  date: Date,                    // Required, immutable, indexed
  authorId: ObjectId,            // Ref: 'User' (required)
  description: String,           // Optional transaction description
  createdAt: Date,
  updatedAt: Date
}
```

### Key Features

- **Immutable Date**: `date` field cannot be changed after creation
- **Type**: '+' for income, '-' for expenses
- **Source**: Description of where transaction came from/went to

### Relationships

- **Many-to-One**: `projectId` → `Project._id`
- **Many-to-One**: `authorId` → `User._id`

### Indexes

- `{ projectId: 1, date: -1 }` - Fast queries for project transactions (newest first)
- `{ projectId: 1, type: 1 }` - Fast queries by project and type

### Usage in Budget Calculations

Transactions are included in Actual Cost (AC) calculation:
- Positive transactions (`type: '+'`) add to total
- Negative transactions (`type: '-'`) subtract from total

---

## Activity Model (Future)

**Status**: Planned but not yet implemented

The Activity model will track project events for the Activity Feed:

```javascript
{
  projectId: ObjectId,           // Ref: 'Project'
  userId: ObjectId,              // Ref: 'User' (who performed the action)
  action: String,                // Enum: 'task_created' | 'task_updated' | 'member_added' | etc.
  entityType: String,            // 'task' | 'transaction' | 'member' | 'project'
  entityId: ObjectId,            // ID of the affected entity
  metadata: Object,              // Additional context (task title, member name, etc.)
  createdAt: Date                // When the activity occurred
}
```

**Planned Actions**:
- Task created/updated/completed
- Member added/removed/role changed
- Transaction added
- Project settings updated

---

## Data Relationships Diagram

```
User (uid)
  │
  ├─→ createdProjects[] ───→ Project
  │                            │
  │                            ├─→ ownerId ───→ User
  │                            │
  │                            └─→ members[]
  │                                 │
  │                                 └─→ userId ───→ User
  │
  ├─→ Referenced in Project.members[]
  ├─→ Referenced in Task.assignees[]
  └─→ Referenced in Task.timeLogs[].userId

Project
  │
  ├─→ Referenced in Task.projectId
  └─→ Referenced in Transaction.projectId

Task
  │
  └─→ projectId ───→ Project
  └─→ assignees[] ───→ User
  └─→ timeLogs[].userId ───→ User

Transaction
  │
  ├─→ projectId ───→ Project
  └─→ authorId ───→ User
```

---

## Design Patterns

### 1. Embedded vs Referenced

**Embedded** (stored directly in document):
- `Project.members[]` - Role data stored inline
- `Task.risk` - Risk data stored inline
- `Task.timeLogs[]` - Time entries stored inline
- `Project.fixedCosts[]` - Fixed costs stored inline

**Referenced** (stored as ObjectId):
- `Project.ownerId` → User
- `Task.assignees[]` → User
- `Task.projectId` → Project
- `Transaction.projectId` → Project

### 2. Soft Deletes

- Projects use `isDeleted: Boolean` flag
- Allows recovery and audit trails
- Queries filter out deleted projects by default

### 3. Immutable Fields

- `Transaction.date` - Cannot be changed after creation
- Ensures financial audit integrity

### 4. Auto-Generated Fields

- `Project.inviteCode` - Generated before save
- Ensures unique invite codes for all projects

---

## Indexing Strategy

### High-Traffic Queries

1. **User's Projects**
   - Index: `{ ownerId: 1, isDeleted: 1 }`
   - Used in: `GET /api/projects`

2. **Project Tasks by Status**
   - Index: `{ projectId: 1, status: 1 }`
   - Used in: Kanban board filtering

3. **User's Assigned Tasks**
   - Index: `{ assignees: 1 }`
   - Used in: "My Tasks" filter

4. **Project Transactions**
   - Index: `{ projectId: 1, date: -1 }`
   - Used in: Transaction history

### Lookup Performance

- User lookups by Firebase UID: `uid` index
- Project lookup by invite code: `inviteCode` index
- Deadline-based risk calculations: `deadline` index

---

## Summary

The database schema is designed for:

1. **Performance** - Embedded role data, strategic indexes
2. **Flexibility** - Inline permissions, extensible risk data
3. **Data Integrity** - Referential integrity, immutable fields
4. **Audit Trail** - Soft deletes, timestamps on all documents

All relationships are maintained through MongoDB ObjectId references, with Mongoose handling population when needed.

