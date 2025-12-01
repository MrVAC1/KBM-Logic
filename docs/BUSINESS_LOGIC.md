# Business Logic Documentation

This document explains the core business logic engines that power KBM Logic: the Dynamic Risk Engine, S-Curve Budgeting system, and Access Gateway.

---

## Dynamic Risk Engine

**Location**: `server/services/riskEngine.js`

The Risk Engine automatically recalculates task risk scores based on real-time factors like deadline proximity and budget status. This ensures risk scores remain accurate as project conditions change.

### Risk Score Formula

**Base Score Calculation**:
```
Base Score = probability × impact
```

Where:
- **probability**: Manual input (1-5 scale)
- **impact**: Manual input (1-5 scale)
- **Result Range**: 1-25

### Auto-Adjustment Logic

The system automatically adjusts risk scores when certain conditions are met:

#### 1. Time Modifier (Deadline Approaching)

**Trigger Condition**:
- Task has a deadline set
- Days until deadline < 2
- Task status is not "Done"

**Action**:
```javascript
newProbability = Math.min(5, currentProbability + 1)
autoAdjustReason = "Deadline approaching (< 2 days)"
```

**Example**:
- Original probability: 3
- After adjustment: 4 (capped at 5)
- Original score: 3 × 4 = 12
- New score: 4 × 4 = 16 (33% increase)

#### 2. Budget Modifier (Future Enhancement)

The budget modifier is planned but not yet fully implemented. When enabled, it will:

**Trigger Condition**:
- Project actual cost > 100% of planned budget
- Task is not "Done"

**Action**:
- Increase probability by 1 (capped at 5)
- Set `autoAdjustReason` to indicate budget overrun

### Risk Calculation Process

1. **Task Update Triggers Recalculation**
   - Every time a task is created or updated
   - Risk engine runs automatically

2. **Check Time Pressure**
   - Calculates days until deadline
   - Applies time modifier if needed

3. **Check Budget Status** (if enabled)
   - Compares actual vs planned cost
   - Applies budget modifier if overrun detected

4. **Calculate Final Score**
   - Uses adjusted probability and impact
   - Stores `auto_score` in task.risk

5. **Mark Auto-Adjusted**
   - Sets `isAutoAdjusted: true` if modifiers applied
   - Stores reason in `autoAdjustReason`

### Risk Score Matrix

| Score Range | Risk Level | Color Indicator |
|-------------|-----------|-----------------|
| 1-5         | Low       | Green           |
| 6-10        | Medium    | Yellow          |
| 11-15       | High      | Orange          |
| 16-20       | Very High | Red             |
| 21-25       | Critical  | Dark Red        |

### Example Calculation

**Initial State**:
- Manual probability: 3
- Manual impact: 4
- Base score: 3 × 4 = 12 (High Risk)

**After Deadline Approaches** (< 2 days):
- Adjusted probability: 4 (+1 from time modifier)
- Impact: 4 (unchanged)
- Auto score: 4 × 4 = 16 (Very High Risk)
- `isAutoAdjusted`: true
- `autoAdjustReason`: "Deadline approaching (< 2 days)"

---

## EVM Budgeting (S-Curve)

**Location**: `server/services/budgetEngine.js`

The system uses Earned Value Management (EVM) principles with S-Curve calculations to track planned vs actual spending over time.

### Planned Value (PV) - S-Curve Calculation

The S-Curve represents cumulative planned spending over the project lifecycle.

#### Formula

For each day in the project timeline:
```javascript
Daily Planned Value = Daily Fixed Costs + Daily Task Costs

Cumulative PV = Sum of all daily values from start date
```

#### Components

**1. Fixed Costs Distribution**:
- Monthly costs: `daily = amount / 30`
- Weekly costs: `daily = amount / 7`
- Daily costs: `daily = amount`
- Yearly costs: `daily = amount / 365`

**2. Task Costs Distribution**:
- Each task has a deadline and creation date
- Estimated task cost = `estimatedHours × hourlyRate`
- Daily task cost = `estimatedCost / taskDurationDays`
- Only active tasks (not "Done") are included

**3. Cumulative Calculation**:
- Starting from project `createdAt`
- Running total accumulates each day
- Results in S-shaped curve (slow start, ramp-up, slow finish)

### Actual Cost (AC) Calculation

Actual cost is the sum of two components:

#### 1. Time Log Costs

```javascript
For each task:
  For each time log entry:
    hours = duration (seconds) / 3600
    cost = hours × hourlyRate
    totalCost += cost
```

#### 2. Manual Transactions

```javascript
For each transaction:
  if (type === '+') totalCost += amount
  if (type === '-') totalCost -= amount
```

**Final AC**:
```
Actual Cost = Time Log Costs + Transaction Sum
```

### Planned Value Curve Structure

The `calculatePlannedValue()` function returns an array of daily data points:

```javascript
[
  { date: "2024-01-01", plannedValue: 100 },
  { date: "2024-01-02", plannedValue: 210 },
  { date: "2024-01-03", plannedValue: 325 },
  // ... continues for project duration
]
```

Each point represents cumulative planned spending up to that date.

### Example S-Curve

**Project Timeline**: 6 months (180 days)

- **Days 1-30**: Slow ramp-up (0% → 15% of budget)
- **Days 31-120**: Steady progress (15% → 70% of budget)
- **Days 121-180**: Completion phase (70% → 100% of budget)

This creates the characteristic S-shape when graphed.

### Budget Variance Calculation

```
Variance = Actual Cost - Planned Value
```

- **Positive variance**: Over budget (spending more than planned)
- **Negative variance**: Under budget (spending less than planned)

---

## Access Gateway

**Location**: `server/controllers/projectController.js` (getProjectDetails)

The Access Gateway controls what data users can see based on their membership status and role. It implements a "Safe View" system for pending/guest users.

### Member States

#### 1. Owner

**Characteristics**:
- Created the project
- Has all permissions automatically
- Cannot be removed from project
- Bypasses all permission checks

#### 2. Active Member

**Characteristics**:
- Has been assigned a role (Admin, PM, Developer, etc.)
- Has at least one permission
- Can see full project data
- Access controlled by RBAC permissions

#### 3. Guest/Pending Member

**Characteristics**:
- Has joined project (member in `members` array)
- Has role "Guest" or zero permissions
- Cannot see sensitive data
- Shows "Safe View" interface

### Safe View Logic

When a user is identified as Guest/Pending:

**Backend Response** (`getProjectDetails`):
```javascript
{
  id: project._id,
  name: project.name,
  description: project.description,
  status: 'Active',
  role: 'Guest',
  isSafeView: true,  // Flag for frontend
  owner: {
    name: owner.displayName,
    avatar: owner.photoURL
  },
  currentUserAccess: {
    role: 'Guest',
    permissions: [],
    isPending: true
  }
  // Explicitly excluded:
  // - inviteCode
  // - fixedCosts
  // - members (full list)
  // - tasks
  // - transactions
  // - budget data
}
```

**Frontend Behavior** (`WorkspaceLayout`):
```javascript
if (currentProject?.isSafeView) {
  return <ProjectOverview project={currentProject} />;
  // Sidebar hidden
  // Main content hidden
  // Only shows: Project name, description, owner, "Waiting for access" message
}
```

### Identification Logic

```javascript
const isOwner = project.ownerId.toString() === userId.toString();

const currentMember = project.members.find(
  m => m.userId.toString() === userId.toString()
);

const userRoleName = currentMember?.roleName || 'Guest';
const userPermissions = currentMember?.permissions || [];

const isGuestOrPending = !isOwner && 
  (userRoleName === 'Guest' || userPermissions.length === 0);
```

### Access Control Flow

1. **User Requests Project Data**
   - Calls `GET /api/projects/:projectId`

2. **Backend Checks Membership**
   - Finds user in `project.members` array
   - Checks if user is owner

3. **Determine Access Level**
   - Owner → Full access
   - Active Member → Permission-based access
   - Guest/Pending → Safe View only

4. **Return Appropriate Data**
   - Full data for owners/active members
   - Limited data for guests/pending

5. **Frontend Renders**
   - Full workspace for active members
   - Safe view for guests/pending

### Permission-Based Access

Even for active members, access is controlled by granular permissions:

- `can_view_dashboard` - See dashboard page
- `can_view_tasks` - See Kanban board
- `can_view_risks` - See risk assessments
- `can_view_financial` - See budget/financial data
- `can_track_time` - Log time on tasks
- `can_create_tasks` - Create new tasks
- `can_edit_tasks` - Modify tasks
- `can_delete_tasks` - Remove tasks
- `can_edit_budget` - Modify budget/transactions
- `can_manage_roles` - Change member roles
- `can_invite_users` - Invite new members
- `can_manage_settings` - Edit project settings
- `can_delete_project` - Delete project

Each API endpoint checks required permissions before returning data.

---

## Integration Points

### Risk Engine Integration

- **Triggered by**: Task create/update operations
- **Called from**: `taskController.js` (createTask, updateTask)
- **Updates**: Task document with recalculated risk scores

### Budget Engine Integration

- **Triggered by**: Dashboard stats request
- **Called from**: `financialController.js` (getDashboardStats)
- **Used for**: S-Curve visualization, budget variance calculations

### Access Gateway Integration

- **Triggered by**: Project details request
- **Called from**: `projectController.js` (getProjectDetails)
- **Enforced by**: RBAC middleware on all protected routes

---

## Summary

These three engines work together to provide:

1. **Proactive Risk Management** - Automatic risk score adjustments
2. **Financial Visibility** - Planned vs actual cost tracking
3. **Secure Access Control** - Safe view for pending members, granular permissions for active members

All engines run automatically based on data changes - no manual intervention required.

