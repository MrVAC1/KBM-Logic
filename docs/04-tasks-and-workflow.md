# Tasks and Workflow

## Overview

The **Task Management** system in KBM Logic v3.0 provides a Kanban-style workflow with drag-and-drop functionality, schedule-aware duration calculations, and integrated time tracking.

## Kanban Board

### Board Structure

The Kanban board consists of **4 columns** representing task status:

1. **Todo** - Newly created tasks, not yet started
2. **In Progress** - Tasks currently being worked on
3. **Review** - Tasks completed and awaiting review/approval
4. **Done** - Completed tasks (contribute to EV calculation)

### Drag-and-Drop

Tasks can be moved between columns via drag-and-drop:

- **Visual Feedback:** Task card follows cursor during drag
- **Status Update:** Dropping a task updates its `status` field
- **Auto-Save:** Changes are saved immediately via API call
- **Permission Check:** Requires `can_edit_tasks` permission

### Task Card Display

Each task card shows:
- **Title** - Task name
- **Description** - Detailed information (expandable)
- **Assignees** - Team members assigned (avatars)
- **Complexity** - Low, Med, High (color-coded badge)
- **Deadline** - Target completion date (if set)
- **Estimated Hours** - Time estimate
- **Risk Score** - Auto-calculated risk indicator

## Task Logic

### Task Schema

```javascript
{
  projectId: ObjectId,
  title: String,
  description: String,
  status: "Todo" | "In Progress" | "Review" | "Done",
  complexity: "Low" | "Med" | "High",
  assignees: [ObjectId],  // User IDs
  startDate: Date,        // Optional
  deadline: Date,         // Optional
  estimateHours: Number,  // Required
  plannedCost: Number,    // Auto-calculated
  plannedValue: Number,   // Auto-calculated (same as plannedCost)
  risk: {
    probability: 1-5,
    impact: 1-5,
    auto_score: 1-25
  },
  timeLogs: [{
    userId: ObjectId,
    startTime: Date,
    endTime: Date,
    duration: Number  // seconds
  }]
}
```

### Duration Calculation

Task duration is calculated based on **Project Work Schedule**:

#### With Start Date and Deadline

If both `startDate` and `deadline` are set:

```
Duration (hours) = Working Days × Hours Per Day
```

Where:
- **Working Days** = Count of working days between `startDate` and `deadline` (inclusive)
- **Hours Per Day** = `project.workSchedule.hoursPerDay` (default: 8)
- **Weekend Exclusion** = Only days in `project.workSchedule.workingDays` are counted

#### Without Dates

If `startDate` or `deadline` is missing:

```
Duration (hours) = estimateHours
```

Uses the `estimateHours` field directly.

#### Example

```
Project Work Schedule:
- Working Days: [1, 2, 3, 4, 5] (Mon-Fri)
- Hours Per Day: 8

Task:
- Start Date: Monday, Jan 1, 2024
- Deadline: Friday, Jan 5, 2024

Calculation:
- Working Days: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5) = 5 days
- Duration: 5 × 8 = 40 hours
```

**Note:** If the deadline falls on a weekend, only working days up to the last working day are counted.

### Planned Cost Calculation

**Planned Cost** (and **Planned Value**) is automatically calculated when a task is created or updated:

```
Planned Cost = Duration (hours) × Average Hourly Rate
```

Where:
- **Duration** = Calculated as above (working days × hours per day)
- **Average Hourly Rate** = Average of assignees' role hourly rates

#### Hourly Rate Derivation

```
Hourly Rate = Monthly Salary / (Working Days Per Month × Hours Per Day)
```

Default: `21 working days/month × 8 hours/day = 168 hours/month`

#### Example

```
Task: "Build API Endpoint"
- Duration: 40 hours
- Assignees: 2 Developers
  - Developer 1: $5000/month → $29.76/hour
  - Developer 2: $4500/month → $26.79/hour
- Average Rate: ($29.76 + $26.79) / 2 = $28.28/hour
- Planned Cost: 40 × $28.28 = $1,131.20
```

### Risk Calculation

Tasks have an **auto-calculated risk score**:

```
Risk Score = Probability × Impact
```

Where:
- **Probability** = 1-5 (likelihood of issues)
- **Impact** = 1-5 (severity if issues occur)
- **Auto Score** = 1-25 (product of probability × impact)

The risk engine (`riskEngine.js`) automatically adjusts risk scores based on:
- **Deadline proximity** - Tasks nearing deadline get higher risk
- **Budget variance** - Over-budget projects increase task risk
- **Task complexity** - High complexity increases base risk

## Time Tracking

### Start/Stop Timer

Tasks support **time tracking** via start/stop timer functionality:

**UI:** Click "Start Timer" button on task card

**Process:**
1. User clicks "Start Timer"
2. System creates a `timeLog` entry with `startTime = now`
3. Timer runs until user clicks "Stop Timer"
4. System sets `endTime = now` and calculates `duration` (seconds)

### Time Log Schema

```javascript
timeLog: {
  userId: ObjectId,
  startTime: Date,
  endTime: Date,      // null while running
  duration: Number    // seconds (calculated on stop)
}
```

### Multiple Time Logs

A task can have **multiple time logs**:
- Different users can track time on the same task
- Each user can have one active timer at a time
- Historical logs are preserved for reporting

### Timer Restrictions

- **One Active Timer:** A user can only have one active timer across all tasks
- **Task-Specific:** Each task can have multiple timers (different users)
- **Auto-Stop:** Timer must be manually stopped (no auto-stop on logout)

## Task Lifecycle

### Creation

1. **User Action:** Click "Create Task" button
2. **Required Fields:**
   - Title
   - Estimate Hours
   - Assignees (optional)
   - Start Date (optional)
   - Deadline (optional)
3. **Auto-Calculations:**
   - Planned Cost (from duration × rates)
   - Risk Score (initial calculation)
4. **Notifications:** Assigned users receive notification

### Updates

**Editable Fields:**
- Title, Description
- Status (via drag-and-drop)
- Assignees
- Start Date, Deadline
- Estimate Hours
- Complexity

**Auto-Recalculations:**
- Planned Cost (if duration/assignees change)
- Risk Score (if deadline/budget changes)

### Completion

When a task moves to **Done** status:

1. **EV Contribution:** Task's `plannedValue` is added to EV calculation
2. **Completion Date:** `updatedAt` timestamp marks completion
3. **Notifications:** Assigned users receive completion notification
4. **Risk Update:** Risk score may decrease (task no longer at risk)

### Deletion

**Permission:** Requires `can_delete_tasks` or Owner status

**Process:**
1. System verifies user has delete permission
2. Task is removed from database
3. Associated time logs are deleted
4. EV calculation excludes deleted task

## Workflow Best Practices

1. **Set Realistic Estimates:** Use accurate `estimateHours` for financial planning
2. **Use Start Dates:** Set `startDate` and `deadline` for accurate duration calculation
3. **Assign Roles:** Assign tasks to users with appropriate roles
4. **Track Time:** Use timer functionality to measure actual vs. estimated hours
5. **Update Status:** Keep task status current for accurate workflow visibility
6. **Review Regularly:** Move completed tasks to "Done" to update EV

## API Endpoints

### Task Management

```
GET    /api/projects/:projectId/tasks           # List all tasks
POST   /api/projects/:projectId/tasks           # Create task
PUT    /api/tasks/:taskId                      # Update task
DELETE /api/tasks/:taskId                      # Delete task
```

### Time Tracking

```
POST   /api/tasks/:taskId/start-timer          # Start timer
POST   /api/tasks/:taskId/stop-timer           # Stop timer
```

## Related Documentation

- **[Financial Engine](./02-financial-engine.md)** - How tasks contribute to PV/EV
- **[Roles and Permissions](./03-roles-and-permissions.md)** - Assignee role rates
- **[Database Schema](./05-database-schema.md)** - Task model reference

