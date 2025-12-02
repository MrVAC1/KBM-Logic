# Financial System & Earned Value Management (EVM)

## Overview

The Financial System implements Earned Value Management (EVM) methodology to track project performance, budget, and schedule. It provides real-time insights into project health through three key metrics: Planned Value (PV), Actual Cost (AC), and Earned Value (EV).

---

## Core Concepts

### Earned Value Management (EVM)

EVM is a project management technique that integrates scope, schedule, and cost metrics to provide a comprehensive view of project performance.

#### Three Key Metrics:

1. **Planned Value (PV)** - "The Plan"
   - Budgeted cost of work scheduled to be completed by a given date
   - Represents the baseline budget curve (S-Curve)
   - Displayed as a dashed gray/blue line on the chart

2. **Actual Cost (AC)** - "The Spend"
   - Actual cost incurred for work performed by a given date
   - Includes daily salary costs and project expenses
   - Displayed as a solid red/orange line on the chart

3. **Earned Value (EV)** - "The Value"
   - Budgeted cost of work actually completed by a given date
   - Only increases when tasks are marked as "Done"
   - Displayed as a solid bright green line on the chart

### Variance Indicators

#### Schedule Variance (SV)
- **Formula:** `SV = EV - PV`
- **Interpretation:**
  - **Positive (Green):** Ahead of schedule
  - **Negative (Red):** Behind schedule
  - **Zero:** On schedule

#### Cost Variance (CV)
- **Formula:** `CV = EV - AC`
- **Interpretation:**
  - **Positive (Green):** Under budget
  - **Negative (Red):** Over budget
  - **Zero:** On budget

---

## How It Works

### 1. Planned Value (PV) Calculation

**Algorithm:**
- Iterates through all tasks in the project
- For each task:
  - Calculates task budget = `Estimate Hours × Average Hourly Rate of Assignees`
  - If date is between task's start date and deadline:
    - Calculates linear daily portion: `Task Budget / Duration Days`
    - Adds cumulative portion to PV
  - If date is after deadline:
    - Adds full task budget to PV

**Hourly Rate Calculation:**
```
Hourly Rate = Monthly Salary / (Working Days per Month × Hours per Day)
Working Days per Month = (Working Days per Week / 7) × 30.44
```

### 2. Actual Cost (AC) Calculation

**Automated Daily Calculation:**
- Runs daily at 00:00 UTC via cron job
- Calculates daily cost from:
  - **Salaries:** Sum of all active members' daily rates
  - **Expenses:** Daily equivalent of recurring expenses (daily, weekly, monthly, yearly)

**Daily Rate Calculation:**
```
Daily Rate = Monthly Salary / Working Days per Month
```

**Expense Frequency Conversion:**
- **Daily:** Full amount per day
- **Weekly:** Amount / 7
- **Monthly:** Amount / 30.44
- **Yearly:** Amount / 365

**Persistence:**
- Daily snapshots saved to `project.evmSnapshots[]`
- Cumulative AC stored in `project.cumulativeActualCost`

### 3. Earned Value (EV) Calculation

**Algorithm:**
- Finds all tasks with `status === 'Done'`
- Filters tasks completed on or before the target date
- Sums the task budgets (same calculation as PV) for completed tasks

**Key Rule:**
- EV only increases when a task is **fully completed** (status = 'Done')
- Partial completion does not contribute to EV

---

## Work Schedule Configuration

Each project has a configurable work schedule that affects all calculations:

- **Working Days per Week:** Default 5 (Monday-Friday)
- **Days Off per Week:** Default 2 (Saturday-Sunday)
- **Hours per Day:** Default 8

These settings can be modified in **Project Info → Work Schedule** (requires `can_manage_work_schedule` permission).

---

## User Salaries

### Setting Salaries
1. Navigate to **Settings → Costs → Members Salaries**
2. Enter monthly salary for each team member
3. Requires `can_manage_salaries` permission

### Impact on Calculations
- Salaries are used to calculate hourly and daily rates
- Only members with `monthlySalary > 0` contribute to AC
- Task budgets are calculated using assignee salaries

---

## Project Expenses

### Adding Expenses
1. Navigate to **Settings → Costs → Other Project Expenses**
2. Click "Add Expense"
3. Enter:
   - Expense name
   - Amount
   - Frequency (daily, weekly, monthly, yearly)

### Expense Impact
- Expenses are automatically included in daily AC calculations
- Converted to daily equivalent based on frequency
- Can be edited or deleted after creation

---

## S-Curve Chart

The Financial Dashboard displays an S-Curve chart showing PV, AC, and EV over time.

### Chart Interpretation:

1. **PV Line (Dashed Gray):**
   - Should follow a smooth S-curve pattern
   - Represents the planned spending baseline

2. **AC Line (Solid Red):**
   - Shows actual money spent
   - Should ideally follow PV line closely
   - If above PV: Spending faster than planned
   - If below PV: Spending slower than planned

3. **EV Line (Solid Green):**
   - Shows value of work completed
   - Should ideally match or exceed PV
   - If below PV: Behind schedule
   - If above PV: Ahead of schedule

### Ideal Scenario:
- **EV = PV:** On schedule
- **EV = AC:** On budget
- **EV > PV:** Ahead of schedule
- **EV > AC:** Under budget

---

## API Endpoints

### Get Dashboard Stats
```
GET /api/projects/:projectId/stats
```

**Response:**
```json
{
  "evmDataPoints": [
    {
      "date": "2025-01-01",
      "PV": 1000,
      "AC": 950,
      "EV": 800
    }
  ],
  "current": {
    "PV": 5000,
    "AC": 4800,
    "EV": 4500
  },
  "variances": {
    "scheduleVariance": -500,
    "costVariance": -300
  }
}
```

---

## Cron Job

The daily EVM calculation runs automatically via `node-cron`:
- **Schedule:** Every day at 00:00 UTC
- **Function:** `calculateDailyActualCost()`
- **Action:** Calculates and saves daily AC snapshots for all active projects

---

## Permissions

- `can_view_financial` - View financial dashboard and EVM data
- `can_manage_salaries` - Edit user salaries in Costs section
- `can_manage_work_schedule` - Modify project work schedule
- `can_edit_budget` - Create/edit project expenses

---

## Best Practices

1. **Set Accurate Salaries:** Ensure all team members have correct monthly salaries
2. **Define Work Schedule:** Configure realistic working days/hours per project
3. **Estimate Task Hours:** Provide accurate `estimateHours` when creating tasks
4. **Set Task Dates:** Always specify `startDate` and `deadline` for tasks
5. **Monitor Regularly:** Check Schedule and Cost Variance indicators frequently
6. **Update Task Status:** Mark tasks as "Done" when completed to update EV

---

## Troubleshooting

### EV Not Increasing
- **Cause:** Tasks not marked as "Done"
- **Solution:** Update task status to "Done" when work is completed

### AC Too High/Low
- **Cause:** Missing or incorrect salaries
- **Solution:** Verify all team members have correct monthly salaries

### PV Not Calculating
- **Cause:** Tasks missing `estimateHours`, `startDate`, or `deadline`
- **Solution:** Ensure all tasks have required fields filled

### Schedule Variance Always Negative
- **Cause:** Tasks taking longer than estimated
- **Solution:** Review task estimates and deadlines, consider updating estimates

---

## Technical Details

### Database Schema

**Project Model:**
```javascript
{
  workSchedule: {
    workingDaysPerWeek: Number, // Default: 5
    daysOffPerWeek: Number,      // Default: 2
    hoursPerDay: Number          // Default: 8
  },
  evmSnapshots: [{
    date: Date,
    plannedValue: Number,
    actualCost: Number,
    earnedValue: Number
  }],
  cumulativeActualCost: Number
}
```

**User Model:**
```javascript
{
  monthlySalary: Number // Default: 0
}
```

**Task Model:**
```javascript
{
  estimateHours: Number,    // Required
  startDate: Date,
  deadline: Date,
  status: String,           // 'Todo', 'In Progress', 'Review', 'Done'
  assignees: [ObjectId]
}
```

---

## Summary

The Financial System provides comprehensive project performance tracking through EVM metrics. By monitoring PV, AC, and EV, project managers can:

- Identify schedule delays early
- Detect budget overruns
- Make data-driven decisions
- Improve project planning accuracy

Regular monitoring and accurate data entry are essential for reliable EVM analysis.

