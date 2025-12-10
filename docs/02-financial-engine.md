# Financial Engine (EVM)

## Overview

The **Financial Engine** in KBM Logic v3.0 implements **Earned Value Management (EVM)** with schedule-aware accrual logic. All financial calculations respect the project's work schedule (working days, hours per day) and use historical role rates for accurate time-based calculations.

## Core Concepts

### PV (Planned Value) - AUTOMATED

**Planned Value** represents the approved budget for work scheduled to be completed by a specific date. In v3.0, PV is **fully automated** and calculated from tasks.

#### Formula

```
PV = Σ (Task Working Hours × Role Hourly Rate)
```

Where:
- **Task Working Hours** = Calculated based on Project Work Schedule
  - If task has `startDate` and `deadline`: `Working Days × Hours Per Day`
  - Otherwise: Uses `task.estimateHours` directly
- **Role Hourly Rate** = Derived from Role Monthly Salary
  - Formula: `Monthly Rate / (Working Days Per Month × Hours Per Day)`
  - Default: 21 working days per month, 8 hours per day

#### Calculation Logic

1. **For each task** scheduled to be completed by the target date:
   - Determine task duration (working days between `startDate` and `deadline`)
   - Get average hourly rate from assignees' roles
   - Calculate: `durationHours × avgHourlyRate`

2. **Sum all task PVs** to get total PV for the date

#### Example

```
Task: "Build Login Page"
- Start Date: 2024-01-01
- Deadline: 2024-01-05
- Working Days: 5 (Mon-Fri)
- Hours Per Day: 8
- Duration: 5 × 8 = 40 hours
- Assignee Role: "Developer" ($5000/month)
- Hourly Rate: $5000 / (21 × 8) = $29.76/hour
- PV: 40 × $29.76 = $1,190.48
```

### AC (Actual Cost) - Schedule-Aware Accrual

**Actual Cost** represents the real money spent. In v3.0, AC uses **schedule-aware accrual** - costs only accrue on working days defined by the project's work schedule.

#### Formula

```
AC = Salary Costs + Fixed Costs + Negative Transactions
```

#### Salary Costs (Schedule-Aware)

```
Daily Rate = Monthly Salary / 21 (working days per month)
AC (per day) = Daily Rate × Allocation Percentage
```

**Key Points:**
- Costs **only accrue on working days** (Mon-Fri by default)
- Weekends and holidays are excluded
- Allocation percentage accounts for part-time work
- Historical rates are preserved via `salaryHistory`

#### Fixed Costs

Fixed costs accrue based on frequency:
- **Daily:** Accrues every working day
- **Weekly:** Accrues once per week
- **Monthly:** Accrues once per month (21 working days)
- **Yearly:** Accrues once per year

#### Negative Transactions

Transactions with `type: '-'` are added directly to AC.

#### Example

```
Role: "Developer" ($5000/month)
- Daily Rate: $5000 / 21 = $238.10/day
- Working Days in Period: 15 days (Mon-Fri only)
- AC from Salary: 15 × $238.10 = $3,571.43

Fixed Cost: "Office Rent" ($2000/month)
- AC from Fixed Cost: $2000

Transaction: "Equipment Purchase" (-$500)
- AC from Transaction: $500

Total AC: $3,571.43 + $2,000 + $500 = $6,071.43
```

### EV (Earned Value)

**Earned Value** represents the budget value of work actually completed.

#### Formula

```
EV = Σ (Task PV for completed tasks)
```

Where completed tasks are those with `status: 'Done'` and `updatedAt <= targetDate`.

#### Calculation Logic

1. Find all tasks with `status: 'Done'`
2. Filter tasks completed by the target date (`updatedAt <= targetDate`)
3. Sum the `plannedValue` (PV) of these tasks

**Note:** EV uses the task's PV at completion time, preserving historical accuracy.

### Transactions - Dual Timestamping

Transactions use **dual timestamping** to support retroactive financial entries:

#### Fields

- **`createdAt`** (automatic) - When the transaction was entered into the system
- **`effectiveDate`** (user-provided) - When the transaction should affect financial calculations
- **`date`** (legacy, immutable) - Set to `effectiveDate` for backward compatibility

#### Use Cases

1. **Backdating Expenses:** Enter an expense today but set `effectiveDate` to last month
2. **Correcting Historical Data:** Fix past transactions without changing entry timestamp
3. **Audit Trail:** `createdAt` preserves when data was entered; `effectiveDate` preserves financial impact

#### Example

```
Transaction Created: 2024-02-15 10:30 AM
Effective Date: 2024-01-20

Result:
- createdAt: 2024-02-15T10:30:00Z (audit trail)
- effectiveDate: 2024-01-20T00:00:00Z (financial impact)
- AC calculation uses: 2024-01-20
```

### Time Machine (Snapshot Regenerator)

When a transaction with a retroactive `effectiveDate` is created, the system triggers the **Snapshot Regenerator** to recalculate historical EVM data.

#### Process

1. **Detect Retroactive Transaction:**
   ```javascript
   if (effectiveDate < today) {
     regenerateSnapshotsFromDate(projectId, effectiveDate);
   }
   ```

2. **Regenerate Snapshots:**
   - Recalculate PV, AC, EV for all dates from `effectiveDate` to today
   - Update `project.evmSnapshots` array
   - Preserve historical accuracy

3. **Update Charts:**
   - Frontend fetches updated snapshot data
   - S-Curve chart reflects corrected historical values

#### Performance

- Snapshots are cached in `project.evmSnapshots`
- Only regenerates affected date range
- Uses optimized MongoDB queries

## Financial Metrics

### Schedule Variance (SV)

**Formula:**
```
SV = EV - PV
```

**Interpretation:**
- **SV > 0:** Ahead of schedule
- **SV < 0:** Behind schedule
- **SV = 0:** On schedule

### Cost Variance (CV)

**Formula:**
```
CV = EV - AC
```

**Interpretation:**
- **CV > 0:** Under budget (savings)
- **CV < 0:** Over budget
- **CV = 0:** On budget

### Burn Rate

**Formula:**
```
Burn Rate = Total Actual Spent / Project Duration (in months)
```

Where:
- **Total Actual Spent** = Current AC
- **Project Duration** = `(Today - Project Start) / 30.44 days`

### Runway

**Formula:**
```
Runway = Remaining Budget / Burn Rate
```

**Result:** Number of months until budget is exhausted.

**Calculation:**
```javascript
const runwayDate = new Date(today);
runwayDate.setMonth(runwayDate.getMonth() + runwayMonths);
```

### Budget Health

**Formula:**
```
Budget Health = (Remaining Budget / Total Budget) × 100
```

**Thresholds:**
- **< 10%:** Over budget warning
- **10-30%:** Low budget warning
- **> 30%:** Healthy

## Budget Calculation

### Total Available Budget

```
Total Budget = Baseline PV + Income Transactions
```

Where:
- **Baseline PV** = Initial planned value from tasks
- **Income Transactions** = Transactions with `type: '+'`

### Remaining Budget

```
Remaining Budget = Total Budget - Actual Cost (AC)
```

## Implementation Details

### EVM Engine (`server/services/evmEngine.js`)

Key functions:
- `calculatePV(project, date, startDate)` - Calculate Planned Value
- `calculateAC(project, date, startDate)` - Calculate Actual Cost
- `calculateEV(project, date, startDate)` - Calculate Earned Value
- `resolveRoleRateForDate(project, roleName, targetDate)` - Get historical role rate

### Snapshot System

Snapshots are stored in `project.evmSnapshots`:

```javascript
{
  date: Date,
  PV: Number,
  AC: Number,
  EV: Number
}
```

Snapshots are:
- Generated daily via cron job (`dailyEVMJob.js`)
- Regenerated when retroactive transactions are created
- Used for historical chart data

### Adaptive Granularity

The system uses adaptive granularity for chart data points:

- **< 60 days:** Daily sampling
- **< 180 days:** Weekly sampling
- **< 2 years:** Bi-weekly sampling
- **< 5 years:** Monthly sampling
- **≥ 5 years:** Quarterly sampling

Target: 30-60 data points per chart for optimal visualization.

## Best Practices

1. **Set Work Schedule Early:** Configure `workSchedule` before creating tasks
2. **Use Effective Dates:** Always set `effectiveDate` for transactions, not just `date`
3. **Monitor Budget Health:** Check Budget Health percentage regularly
4. **Review Snapshots:** Verify historical data accuracy after retroactive changes
5. **Role Rate Changes:** Update role rates via Settings → Roles to preserve history

## Related Documentation

- **[Database Schema](./05-database-schema.md)** - Transaction and Snapshot models
- **[Roles and Permissions](./03-roles-and-permissions.md)** - Role compensation model
- **[Architecture](./01-architecture-and-setup.md)** - System overview

