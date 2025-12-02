# EVM Financial Logic Documentation

## Overview

The Earned Value Management (EVM) system provides comprehensive financial tracking and analysis for projects. This document details the core formulas, calculation methods, and data sources.

---

## Core EVM Formulas

### 1. Planned Value (PV)

**Definition:** The budgeted cost of work scheduled to be completed by a given date.

**Formula:**
```
PV = Σ (Task Budget × Completion Percentage)
```

**Calculation Method:**
- For each task with `estimateHours > 0`:
  - Calculate task budget: `estimateHours × Average Hourly Rate`
  - Hourly rate derived from: `Monthly Salary / Working Hours per Month`
  - Working hours per month: `(workingDaysPerWeek × 4.33) × hoursPerDay`
- If task deadline ≤ target date: Add full task budget
- If task deadline > target date: Calculate linear daily portion
  - `dailyPortion = taskBudget / taskDuration`
  - `partialPV = min(taskBudget, dailyPortion × daysSinceStart)`

**Source of Truth:**
- Tasks collection (`Task` model)
- User monthly salaries (`User.monthlySalary`)
- Project work schedule (`Project.workSchedule`)

**Optimization:**
- Uses cached snapshots (`project.evmSnapshots`) for historical dates
- Only recalculates for today or future dates

---

### 2. Actual Cost (AC)

**Definition:** The actual cost incurred for work performed by a given date.

**Formula:**
```
AC = Salaries + Fixed Costs + Negative Transactions
```

**Calculation Components:**

#### A. Salaries (Daily Rate Calculation)
```
Daily Rate = Monthly Salary / Working Days per Month
Working Days per Month = (workingDaysPerWeek / 7) × 30.44
AC from Salaries = Σ (Daily Rate × Days Since Member Joined)
```

#### B. Fixed Costs
- From `Expense` collection (frequency-based):
  - Daily: `amount × daysSinceStart`
  - Weekly: `amount × ceil(daysSinceStart / 7)`
  - Monthly: `amount × ceil(daysSinceStart / 30.44)`
  - Yearly: `amount × ceil(daysSinceStart / 365)`
- From `Project.fixedCosts` array (same frequency logic)

#### C. Negative Transactions
- Sum of all `Transaction` documents where:
  - `type === '-'` (expense)
  - `date <= targetDate`

**Source of Truth:**
1. **Salaries:** `Project.members` → `User.monthlySalary` → Calculated daily rate
2. **Fixed Costs:** `Expense` collection + `Project.fixedCosts` array
3. **Negative Transactions:** `Transaction` collection (`type: '-'`)

**Optimization:**
- Uses cached snapshots for historical dates
- Only calculates for today or future dates

---

### 3. Earned Value (EV)

**Definition:** The budgeted cost of work actually completed by a given date.

**Formula:**
```
EV = Σ (Task Budget for Completed Tasks)
```

**Calculation Method:**
- Find all tasks where:
  - `status === 'Done'`
  - `updatedAt <= targetDate` (completed on or before target date)
- For each completed task:
  - Calculate task budget: `estimateHours × Average Hourly Rate`
  - Add to total EV

**Source of Truth:**
- Tasks collection (`Task` model)
- Task status and completion date (`Task.status`, `Task.updatedAt`)

**Optimization:**
- Uses cached snapshots for historical dates
- Only calculates for today or future dates

---

### 4. Schedule Variance (SV)

**Formula:**
```
SV = EV - PV
```

**Interpretation:**
- **SV > 0:** Ahead of schedule
- **SV = 0:** On schedule
- **SV < 0:** Behind schedule

---

### 5. Cost Variance (CV)

**Formula:**
```
CV = EV - AC
```

**Interpretation:**
- **CV > 0:** Under budget
- **CV = 0:** On budget
- **CV < 0:** Over budget

---

## Budget Calculation

### Total Available Budget

**Formula:**
```
Total Available Budget = PV (Baseline) + Positive Transactions (Income)
```

**Components:**
1. **PV Baseline:** Planned Value represents the original budget
2. **Positive Transactions:** Sum of all `Transaction` documents where `type === '+'` (income)

**Source of Truth:**
- PV: Calculated from tasks (see PV section)
- Income: `Transaction` collection (`type: '+'`)

### Remaining Budget

**Formula:**
```
Remaining Budget = (PV + Total Additional Funds) - AC
```

Where:
- `Total Additional Funds` = Sum of positive transactions (`type: '+'`)

---

## Adaptive Granularity (S-Curve Sampling)

The system uses a 5-tier adaptive granularity system to optimize chart density (target: 30-60 data points).

### Step Calculation Logic

Based on project duration (`durationDays = endDate - startDate`):

| Duration | Step | Description |
|----------|------|-------------|
| < 60 days | 1 day | Daily sampling |
| < 180 days | 7 days | Weekly sampling |
| < 730 days (2 years) | 14 days | Bi-weekly sampling |
| < 1825 days (5 years) | 30 days | Monthly sampling |
| ≥ 1825 days | 90 days | Quarterly sampling |

### Key Dates Injection

The following dates are **always** included in the data points:
1. **Project Start Date** (`project.createdAt`)
2. **Today** (current date)
3. **Project Deadline** (`project.deadline`, if set)

### Data Point Generation

1. Generate dates using calculated step
2. Inject key dates (start, today, deadline)
3. Sort chronologically
4. Remove duplicates
5. Calculate PV, AC, EV for each date:
   - **PV:** Calculated for all dates (extends to future)
   - **AC & EV:** Calculated only for dates ≤ today (null for future dates)

---

## Performance Optimization

### Snapshot Caching

**Purpose:** Reduce recalculation time for historical dates.

**Implementation:**
- Daily cron job (`dailyEVMJob.js`) calculates and stores snapshots
- Snapshot structure:
  ```javascript
  {
    date: Date,
    plannedValue: Number,
    actualCost: Number,
    earnedValue: Number
  }
  ```

**Cache Priority:**
1. Check `project.evmSnapshots` for historical dates (`date < today`)
2. If snapshot exists: Return cached value immediately
3. If snapshot missing or date is today/future: Calculate normally

**Cache Hit Rate:** ~95-100% for historical dates

### Database Indexing

Optimized indexes for faster queries:

- **Task:** `{ projectId: 1, status: 1, updatedAt: -1 }` (for EV calculation)
- **Expense:** `{ projectId: 1, createdAt: 1, frequency: 1 }` (for AC calculation)
- **Transaction:** `{ projectId: 1, type: 1, date: -1 }` (for budget calculation)

---

## API Endpoints

### Get Summary Stats (Fast Load)
```
GET /api/projects/:projectId/stats?summary=true
```

Returns:
- Current PV, AC, EV (today's values)
- Variances (Schedule, Cost)
- Budget (Baseline, Additional Funds, Remaining)

**Performance:** ~200-500ms

### Get Chart Data (Delayed Load)
```
GET /api/projects/:projectId/stats?chart=true
```

Returns:
- `evmDataPoints` array (for S-Curve chart)
- `plannedValueCurve` array

**Performance:** ~1-3s (uses snapshots for historical dates)

### Get Full Data (Backward Compatibility)
```
GET /api/projects/:projectId/stats
```

Returns both summary and chart data.

---

## Data Flow

### Calculation Flow

1. **User requests Financial Dashboard**
2. **Frontend makes 2 API calls:**
   - Call 1: `GET /stats?summary=true` (fast)
   - Call 2: `GET /stats?chart=true` (delayed)

3. **Backend processes chart data:**
   - For each date in range:
     - **If date < today:** Check `project.evmSnapshots` first
       - ✅ Cache Hit: Return snapshot value
       - ❌ Cache Miss: Calculate from scratch
     - **If date >= today:** Always calculate (no snapshot)

4. **Daily Cron Job:**
   - Runs at 00:00 UTC daily
   - Calculates PV, AC, EV for "yesterday"
   - Saves to `project.evmSnapshots` array

---

## Key Files

- **Core Logic:** `server/services/evmEngine.js`
- **API Controller:** `server/controllers/financialController.js`
- **Daily Job:** `server/services/dailyEVMJob.js`
- **Frontend:** `client/src/pages/workspace/financial/page.tsx`

---

## Notes

- All monetary values are stored and calculated in the project's base currency
- Dates are normalized to start of day (00:00:00) for consistent comparisons
- Future dates have `AC` and `EV` set to `null` (not calculated)
- PV extends to future dates (represents planned work)

