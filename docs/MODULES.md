# Application Modules Documentation

## Overview

This document describes the main modules and features of the KBM Logic project management system.

---

## 1. Project Information Module

### Purpose
Manages project metadata, settings, and configuration.

### Key Features

#### Deadline Management
- **Field:** `Project.deadline` (Date, nullable)
- **RBAC Check:** Requires `can_manage_deadline` permission
- **Validation:**
  - Deadline must be strictly after `project.createdAt`
  - Cannot be equal to or before creation date
- **UI Location:** Project Info sidebar
- **Edit Access:** Only users with `can_manage_deadline` permission can edit

**Permission Levels:**
- **Owner:** Always has permission (via `ALL_PERMISSIONS`)
- **Project Manager:** Must have `can_manage_deadline` in permissions array
- **Other Roles:** Read-only access

#### Work Schedule Configuration
- **Field:** `Project.workSchedule`
- **Properties:**
  - `workingDaysPerWeek` (1-7)
  - `daysOffPerWeek` (0-6)
  - `hoursPerDay` (1-24)
- **Validation:** `workingDaysPerWeek + daysOffPerWeek = 7`
- **RBAC Check:** Requires `can_manage_work_schedule` permission
- **Usage:** Used for calculating daily/hourly rates from monthly salaries

#### Project Members
- **Field:** `Project.members[]`
- **Structure:**
  - `userId` (ObjectId reference to User)
  - `roles[]` (array of role names)
  - `permissions[]` (array of permission strings)
  - `hourlyRate` (Number)
  - `joinedAt` (Date)
  - `notificationSettings` (Object)

**Role System:**
- Default roles: `Owner`, `Guest`
- Custom roles: Defined in `Project.customRoles[]`
- Multiple roles: Members can have multiple roles
- Permission inheritance: Permissions from all roles are aggregated

---

## 2. Kanban / Tasks Module

### Purpose
Manages project tasks with Kanban board interface.

### Key Features

#### Task Status Flow
```
Todo → In Progress → Review → Done
```

#### Task Properties
- `projectId` (ObjectId reference)
- `title` (String, required)
- `description` (String)
- `status` (Enum: 'Todo', 'In Progress', 'Review', 'Done')
- `priority` (Enum: 'Low', 'Medium', 'High', 'Critical')
- `complexity` (Enum: 'Low', 'Med', 'High')
- `assignees[]` (ObjectId references to User)
- `startDate` (Date)
- `deadline` (Date)
- `estimateHours` (Number, required, min: 0)
- `plannedValue` (Number, auto-calculated)
- `plannedCost` (Number, auto-calculated)
- `risk` (Object with probability, impact, auto_score)

#### EV Calculation Integration
- **Completed Tasks Feed EV:**
  - Only tasks with `status === 'Done'` contribute to Earned Value
  - EV = Sum of task budgets for completed tasks
  - Task budget = `estimateHours × Average Hourly Rate`
  - Completion date = `Task.updatedAt` (when status changed to 'Done')

**Calculation Logic:**
```javascript
// Find all completed tasks
const completedTasks = await Task.find({
  projectId,
  status: 'Done',
  updatedAt: { $lte: targetDate }
});

// Calculate EV from completed tasks
let totalEV = 0;
for (const task of completedTasks) {
  const taskBudget = estimateHours × averageHourlyRate;
  totalEV += taskBudget;
}
```

#### Database Indexes
- `{ projectId: 1, status: 1, updatedAt: -1 }` - Optimized for EV calculation

---

## 3. Financial Dashboard Module

### Purpose
Provides comprehensive financial tracking using Earned Value Management (EVM).

### Key Features

#### Metric Cards (Fast Load)
- **Planned Value (PV):** Budgeted cost of scheduled work
- **Actual Cost (AC):** Actual cost incurred
- **Earned Value (EV):** Budgeted cost of completed work
- **Schedule Variance (SV):** `EV - PV`
- **Cost Variance (CV):** `EV - AC`
- **Remaining Budget:** `(PV + Income) - AC`

#### S-Curve Chart (Delayed Load)
- **Data Source:** `evmDataPoints[]` array
- **Adaptive Granularity:** 5-tier step system (see EVM_FINANCIAL_LOGIC.md)
- **Key Dates:** Always includes project start, today, and deadline
- **Future Data:** AC and EV are `null` for future dates

#### Performance Optimization
- **Summary Stats:** ~200-500ms (fast load)
- **Chart Data:** ~1-3s (uses snapshots for historical dates)
- **Snapshot Caching:** 95-100% cache hit rate for historical dates

**API Endpoints:**
- `GET /api/projects/:projectId/stats?summary=true` - Fast metric cards
- `GET /api/projects/:projectId/stats?chart=true` - Chart data
- `GET /api/projects/:projectId/stats` - Full data (backward compatibility)

---

## 4. Investor Report Module

### Purpose
Generates comprehensive financial reports for investors with PDF export capability.

### Key Features

#### Time Range Filter
- **Options:**
  - `'all'` - Entire project duration (from `project.createdAt` to today)
  - `'month'` - Current month (from start of month to today)
  - `'year'` - Current year (from start of year to today)

**API Endpoint:**
```
GET /api/projects/:projectId/reports/investor?range=all|month|year
```

#### Report Sections

1. **Burn Rate**
   - Monthly: `Total AC / Project Duration (months)`
   - Daily: `Monthly Burn Rate / 30.44`

2. **Runway**
   - Calculation: `Remaining Budget / Burn Rate`
   - Status: `healthy` (>6 months), `warning` (3-6 months), `critical` (<3 months), `infinite` (burn rate = 0)
   - Date: Calculated date when funds will run out
   - Deadline Context: Shows if funds run out before project deadline

3. **Financials**
   - Planned Total: PV (Planned Value)
   - Actual Total: AC (Actual Cost)
   - Variance: `AC - PV`

4. **Top Risks**
   - Top 3 tasks with highest `risk.auto_score`
   - Includes: Task title, risk score, probability, impact, description, status

5. **Roadmap Status**
   - Completed Tasks: Count and percentage
   - Time Elapsed: Percentage of project duration
   - Ahead of Schedule: `completedPercentage > timeElapsedPercentage`
   - Valid Deadline: Flag indicating if deadline is valid (not default)

6. **Team Data** (Owner only)
   - Role Distribution: Count of members per role
   - Members List: Name, email, roles, monthly salary, hourly rate, daily rate
   - Total Monthly Salary: Sum of all member salaries

#### PDF Generation
- **Technology:** `html2canvas` + `jsPDF`
- **Process:**
  1. Render report content to HTML
  2. Capture as image using `html2canvas`
  3. Generate PDF using `jsPDF`
  4. Download PDF file

**Frontend Component:** `client/src/components/investor-report-modal.tsx`

---

## 5. Transactions Module

### Purpose
Manages financial transactions (income and expenses) for projects.

### Transaction Model

```javascript
{
  projectId: ObjectId,
  amount: Number,
  type: '+' | '-',  // '+' = Income, '-' = Expense
  source: String,
  date: Date,
  authorId: ObjectId,
  description: String
}
```

### Usage in EVM

#### Income Transactions (`type: '+'`)
- **Purpose:** Increase available budget
- **Formula:** `Total Available Budget = PV + Sum(Income Transactions)`
- **Calculation:** Sum of all transactions where `type === '+'`

#### Expense Transactions (`type: '-'`)
- **Purpose:** Increase Actual Cost
- **Formula:** `AC = Salaries + Fixed Costs + Sum(Expense Transactions)`
- **Calculation:** Sum of all transactions where `type === '-'` and `date <= targetDate`

### Database Indexes
- `{ projectId: 1, type: 1, date: -1 }` - Optimized for budget calculation

---

## 6. Roles & Permissions Module

### Purpose
Manages role-based access control (RBAC) for projects.

### Permission System

#### Available Permissions (`ALL_PERMISSIONS`)
- **View Permissions:**
  - `can_view_dashboard`
  - `can_view_tasks`
  - `can_view_risks`
  - `can_view_financial`

- **Action Permissions:**
  - `can_create_tasks`
  - `can_edit_tasks`
  - `can_delete_tasks`
  - `can_edit_budget`
  - `can_manage_roles`
  - `can_invite_users`
  - `can_manage_settings`
  - `can_manage_salaries`
  - `can_manage_work_schedule`
  - `can_manage_deadline` ⭐ (Required for editing project deadline)
  - `can_delete_project`
  - `can_generate_reports`

- **Notification Permissions:**
  - `notify_on_financial_risk`
  - `notify_on_task_assignment`
  - `notify_on_role_change`

#### Default Roles

**Owner:**
- Has ALL permissions (via `ALL_PERMISSIONS` array)
- Cannot be removed or modified
- Always has access to all features

**Guest:**
- Zero permissions by default
- Must be granted permissions by Owner
- Lowest hierarchy level

#### Custom Roles
- Defined in `Project.customRoles[]`
- Can have any name
- Permissions array must only contain values from `ALL_PERMISSIONS`
- Hierarchy: Higher than Guest, lower than Owner

#### Permission Aggregation
- Members can have multiple roles
- Permissions from all roles are combined (union)
- Owner always has all permissions (bypasses role checks)

---

## 7. Database Integration

### MongoDB Atlas Connection

**Configuration:**
- **Connection String:** `MONGODB_URI` in `server/.env`
- **Database Name:** `kbm-logic`
- **Connection Options:**
  - `serverSelectionTimeoutMS: 10000`
  - `socketTimeoutMS: 45000`
  - `retryWrites: true` (for Atlas)
  - `w: 'majority'` (for Atlas)

**Connection File:** `server/config/db.js`

### Key Models

#### Project Model
- **Collection:** `projects`
- **Key Fields:**
  - `name` (String, required)
  - `description` (String)
  - `ownerId` (ObjectId, required)
  - `deadline` (Date, nullable) ⭐
  - `workSchedule` (Object)
  - `members[]` (Array of member objects)
  - `customRoles[]` (Array of custom role objects)
  - `fixedCosts[]` (Array of fixed cost objects)
  - `evmSnapshots[]` (Array of EVM snapshot objects)
  - `createdAt` (Date, auto)

#### Transaction Model
- **Collection:** `transactions`
- **Key Fields:**
  - `projectId` (ObjectId, required, indexed)
  - `amount` (Number, required)
  - `type` (Enum: '+', '-', required)
  - `source` (String, required)
  - `date` (Date, required, immutable, indexed)
  - `authorId` (ObjectId, required)
  - `description` (String)

#### Task Model
- **Collection:** `tasks`
- **Key Fields:**
  - `projectId` (ObjectId, required, indexed)
  - `title` (String, required)
  - `status` (Enum: 'Todo', 'In Progress', 'Review', 'Done', indexed)
  - `estimateHours` (Number, required)
  - `assignees[]` (ObjectId references)
  - `updatedAt` (Date, indexed for EV calculation)

#### Expense Model
- **Collection:** `expenses`
- **Key Fields:**
  - `projectId` (ObjectId, required, indexed)
  - `name` (String, required)
  - `amount` (Number, required)
  - `frequency` (Enum: 'daily', 'weekly', 'monthly', 'yearly')
  - `createdAt` (Date, indexed)

---

## File Structure

### Backend
```
server/
├── controllers/
│   ├── financialController.js    # Financial dashboard API
│   ├── projectController.js      # Project CRUD & deadline management
│   ├── reportController.js        # Investor report generation
│   └── ...
├── services/
│   ├── evmEngine.js               # Core EVM calculation logic
│   ├── dailyEVMJob.js             # Daily snapshot generation
│   └── ...
├── models/
│   ├── Project.js                 # Project schema with deadline, roles
│   ├── Transaction.js             # Transaction schema
│   ├── Task.js                    # Task schema
│   └── ...
└── config/
    └── db.js                      # MongoDB Atlas connection
```

### Frontend
```
client/src/
├── pages/
│   └── workspace/
│       ├── financial/
│       │   └── page.tsx           # Financial dashboard
│       ├── project-info/
│       │   └── page.tsx            # Project info with deadline
│       └── kanban/
│           └── page.tsx            # Kanban board
├── components/
│   ├── investor-report-modal.tsx  # Investor report with PDF
│   └── ...
└── contexts/
    └── ProjectContext.jsx          # Project state & permissions
```

---

## Key Integrations

### EVM System Integration
- **Tasks → EV:** Completed tasks feed into Earned Value calculation
- **Transactions → Budget:** Income transactions increase available budget
- **Transactions → AC:** Expense transactions increase Actual Cost
- **Salaries → AC:** Member salaries calculated as daily rates

### Permission System Integration
- **Deadline Management:** Requires `can_manage_deadline` permission
- **Work Schedule:** Requires `can_manage_work_schedule` permission
- **Financial View:** Requires `can_view_financial` permission
- **Report Generation:** Requires `can_generate_reports` permission

---

## Performance Optimizations

1. **Snapshot Caching:** Historical EVM values cached in `project.evmSnapshots`
2. **Database Indexing:** Optimized indexes for EV, AC, and budget calculations
3. **API Splitting:** Summary stats and chart data loaded separately
4. **Adaptive Granularity:** Smart sampling for S-Curve (30-60 data points)

---

## Migration Scripts

### Cleanup Obsolete Permissions
```bash
npm run cleanup:permissions
```
Removes `can_track_time` and other invalid permissions from database.

### Fix Deadline Permissions
```bash
npm run fix:deadline-permissions
```
Adds `can_manage_deadline` to Owner and Project Manager roles.

