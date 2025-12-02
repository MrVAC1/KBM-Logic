# Financial Module Documentation

## 1. Module Overview

The Financial module is a comprehensive Earned Value Management (EVM) system designed to track project budget, expenses, and financial health in real-time. It provides stakeholders with critical insights into project economics through visual dashboards, detailed metrics, and automated reporting.

**Key Features:**
- **Financial Dashboard**: Real-time EVM metrics (PV, AC, EV) with interactive S-Curve visualization
- **Budget Tracking**: Planned Value vs Actual Cost comparison with variance analysis
- **Investor Report**: Comprehensive PDF export with burn rate, runway, risks, and team financials
- **Funds Management**: Transaction logging and expense tracking
- **Fixed Costs**: Recurring cost management (monthly, weekly, daily, yearly)
- **Performance Indices**: Schedule Variance (SV) and Cost Variance (CV) calculations

---

## 2. Architecture & Data Flow

#### Data Flow Architecture

```
MongoDB Collections
    ↓
Express.js API Layer (Controllers)
    ↓
Business Logic Layer (Services: evmEngine.js)
    ↓
React Frontend (Components & Pages)
    ↓
User Interface (Charts, Cards, Modals)
```

**Data Flow Process:**

1. **Data Storage (MongoDB)**:
   - `Projects`: Contains `members`, `fixedCosts`, `workSchedule`, `evmSnapshots`
   - `Tasks`: Contains `estimateHours`, `assignees`, `startDate`, `deadline`, `status`
   - `Expenses`: Contains `amount`, `frequency`, `createdAt`
   - `Transactions`: Contains `amount`, `type` ('+' or '-'), `date`
   - `Users`: Contains `monthlySalary`

2. **API Layer (Express.js)**:
   - `GET /api/projects/:projectId/stats` → Returns EVM data points and current metrics
   - `GET /api/projects/:projectId/reports/investor` → Returns investor report data
   - `POST /api/projects/:projectId/transactions` → Creates new transaction
   - `GET /api/projects/:projectId/transactions` → Retrieves transaction history

3. **Business Logic (evmEngine.js)**:
   - `calculatePV(project, date)`: Calculates Planned Value for a specific date
   - `calculateAC(project, date)`: Calculates Actual Cost for a specific date
   - `calculateEV(project, date)`: Calculates Earned Value for a specific date

4. **Frontend (React)**:
   - `FinancialDashboardPage`: Main dashboard component
   - `InvestorReportModal`: PDF export modal
   - `ManageFundsModal`: Transaction management
   - `FixedCostsModal`: Fixed cost management

#### Database Relationships

**Project → Tasks:**
- Each project has multiple tasks
- Tasks contribute to PV calculation based on `estimateHours` and assignee hourly rates
- Task completion status determines EV calculation

**Project → Members:**
- Each project has multiple members (users)
- Members' `monthlySalary` is used to calculate daily/hourly rates
- Daily rates × days elapsed = salary portion of AC

**Project → Expenses:**
- Each project has multiple expenses
- Expenses have `frequency` (daily, weekly, monthly, yearly)
- Expenses contribute to AC based on frequency and elapsed time

**Project → Transactions:**
- Each project has multiple transactions
- Transactions represent income (`type: '+'`) or expenses (`type: '-'`)
- Transactions are logged with `date` and `amount`

**Project → EVM Snapshots:**
- `evmSnapshots` array stores daily snapshots of PV, AC, EV
- Updated daily by cron job via `calculateDailyActualCost()`
- Used for historical AC calculation if available

---

## 3. Business Logic & Calculations

#### 3.1 Planned Value (PV) Calculation

**Formula:**
```
PV = Σ (Task Budget × Completion Percentage by Date)
```

**Implementation Logic:**
1. For each task with `estimateHours > 0` and valid `startDate`/`deadline`:
   - Calculate average hourly rate from task assignees' `monthlySalary`
   - `Task Budget = estimateHours × Average Hourly Rate`
2. If target date >= task deadline: Add full task budget to PV
3. If target date is between start and deadline: Calculate linear daily portion:
   ```
   Task Duration (days) = (deadline - startDate) / (1000 × 60 × 60 × 24)
   Days Since Start = (date - startDate) / (1000 × 60 × 60 × 24)
   Daily Portion = Task Budget / Task Duration
   Partial PV = Daily Portion × Days Since Start
   ```
4. Sum all task PV contributions

**Code Location:** `server/services/evmEngine.js` → `calculatePV()`

#### 3.2 Actual Cost (AC) Calculation

**Formula:**
```
AC = Salary Costs + Expense Costs
```

**Implementation Logic:**

**Part 1: Salary Costs**
```
For each active member:
  Daily Rate = Monthly Salary / Working Days Per Month
  Working Days Per Month = (Working Days Per Week / 7) × 30.44
  Days Since Project Start = (date - project.createdAt) / (1000 × 60 × 60 × 24)
  Salary Cost = Daily Rate × Days Since Project Start
```

**Part 2: Expense Costs**
```
For each expense:
  Days Since Expense Start = (date - expense.createdAt) / (1000 × 60 × 60 × 24)
  
  If frequency === 'daily':
    Expense Cost = amount × Days Since Expense Start
  If frequency === 'weekly':
    Expense Cost = amount × ceil(Days Since Expense Start / 7)
  If frequency === 'monthly':
    Expense Cost = amount × ceil(Days Since Expense Start / 30.44)
  If frequency === 'yearly':
    Expense Cost = amount × ceil(Days Since Expense Start / 365)
```

**Optimization:** If `project.evmSnapshots` exists and contains data up to the target date, use the latest snapshot's `actualCost` instead of recalculating.

**Code Location:** `server/services/evmEngine.js` → `calculateAC()`

#### 3.3 Earned Value (EV) Calculation

**Formula:**
```
EV = Σ (Task Budget for Completed Tasks)
```

**Implementation Logic:**
1. Find all tasks with `status === 'Done'` and `updatedAt <= target date`
2. For each completed task:
   - Calculate task budget (same as PV calculation)
   - Add full task budget to EV
3. Sum all completed task budgets

**Code Location:** `server/services/evmEngine.js` → `calculateEV()`

#### 3.4 Burn Rate Calculation

**Formula:**
```
Burn Rate (Monthly) = Total Actual Cost / Project Duration in Months
Burn Rate (Daily) = Burn Rate (Monthly) / 30.44
```

**Implementation:**
```javascript
const monthsDiff = (today - projectStartDate) / (1000 × 60 × 60 × 24 × 30.44)
const projectDurationMonths = Math.max(0.1, monthsDiff) // Minimum 0.1 to avoid division by zero
const burnRate = currentAC / projectDurationMonths
```

**Code Location:** `server/controllers/reportController.js` → `getInvestorReport()`

#### 3.5 Runway Calculation

**Formula:**
```
Remaining Budget = PV - AC
Runway (Months) = Remaining Budget / Burn Rate
Runway Date = Today + Runway (Months)
```

**Status Classification:**
- `healthy`: Runway > 6 months
- `warning`: Runway > 3 months and ≤ 6 months
- `critical`: Runway > 0 and ≤ 3 months
- `infinite`: Burn Rate = 0

**Code Location:** `server/controllers/reportController.js` → `getInvestorReport()`

#### 3.6 Variance Calculations

**Schedule Variance (SV):**
```
SV = EV - PV
```
- **Positive SV**: Ahead of schedule (EV > PV)
- **Negative SV**: Behind schedule (EV < PV)
- **Zero SV**: On schedule

**Cost Variance (CV):**
```
CV = EV - AC
```
- **Positive CV**: Under budget (EV > AC)
- **Negative CV**: Over budget (EV < AC)
- **Zero CV**: On budget

**Code Location:** `server/controllers/financialController.js` → `getDashboardStats()`

#### 3.7 Performance Indices (CPI / SPI)

**Note:** While CPI and SPI are referenced in legacy code, they are not currently calculated in the active implementation. The system uses SV and CV instead.

**Theoretical Formulas:**
```
CPI (Cost Performance Index) = EV / AC
SPI (Schedule Performance Index) = EV / PV
```

---

## 4. UI Components & Interactivity

#### 4.1 Financial Dashboard Overview

**Location:** `client/src/pages/workspace/financial/page.tsx`

**Main Layout:**
- Header section with title "Financial Dashboard" and action buttons
- Grid of 6 metric cards (PV, AC, EV, SV, CV, Remaining)
- S-Curve chart showing PV, AC, EV over time
- Velocity card (for users with `can_view_financial` permission)

#### 4.2 Metric Cards

**Planned Value (PV) Card:**
- **Display:** Total budget baseline
- **Calculation:** `currentPV` from API response
- **Color:** Primary blue
- **Interactive:** Clickable → Opens Transaction Log Drawer

**Actual Cost (AC) Card:**
- **Display:** Total actual spending
- **Calculation:** `currentAC` from API response
- **Subtext:** Percentage of PV consumed
- **Formula:** `(actualSpent / totalBudget) × 100`

**Earned Value (EV) Card:**
- **Display:** Value of completed work
- **Calculation:** `currentEV` from API response
- **Color:** Green (`text-green-400`)

**Schedule Variance (SV) Card:**
- **Display:** `EV - PV`
- **Color Coding:**
  - Red/Warning border if `SV < 0` (behind schedule)
  - Green border if `SV > 0` (ahead of schedule)
- **Tooltip:** Explains that positive = ahead, negative = behind

**Cost Variance (CV) Card:**
- **Display:** `EV - AC`
- **Color Coding:**
  - Red/Destructive border if `CV < 0` (over budget)
  - Green border if `CV > 0` (under budget)
- **Tooltip:** Explains that positive = under budget, negative = over budget

**Remaining Budget Card:**
- **Display:** `PV - AC`
- **Subtext:** Percentage remaining
- **Color:** Warning if `budgetHealth < 10%`

#### 4.3 S-Curve Chart

**Component:** Recharts `ComposedChart` with `Line` components

**X-Axis:**
- **Data Key:** `date` (formatted as "MMM DD")
- **Angle:** -45 degrees for readability
- **Height:** 60px to accommodate angled labels

**Y-Axis:**
- **Formatter:** `$${(value / 1000).toFixed(0)}k` (displays in thousands)
- **Domain:** Auto-scaling based on data

**Lines:**
1. **PV Line (Planned Value):**
   - Color: `#6b7280` (gray)
   - Style: Dashed (`strokeDasharray="5 5"`)
   - Represents: The planned budget baseline

2. **AC Line (Actual Cost):**
   - Color: `#ef4444` (red)
   - Style: Solid
   - Represents: Actual spending over time

3. **EV Line (Earned Value):**
   - Color: `#22c55e` (green)
   - Style: Solid, thicker (`strokeWidth={3}`)
   - Represents: Value of work completed

**Tooltip:**
- Custom styled with dark theme
- Shows formatted currency values
- Displays date label

**Legend:**
- White text for dark theme visibility
- Icon type: Line

#### 4.4 Action Buttons

**"Manage Funds" Button:**
- **Location:** Header, right side
- **Icon:** `DollarSign`
- **Action:** Opens `ManageFundsModal`
- **Functionality:** Allows users to create transactions (income/expense)
- **Permission:** No specific permission required (all project members can manage funds)

**"Fixed Costs" Button:**
- **Location:** Header, right side
- **Action:** Opens `FixedCostsModal`
- **Functionality:** 
  - View existing fixed costs
  - Add new fixed costs (Owner only)
  - Delete fixed costs (Owner only)
- **Permission:** View available to all, edit requires Owner role

**"Investor Report" Button:**
- **Location:** Header, right side
- **Visibility:** Only shown if `hasPermission('can_generate_reports')`
- **Action:** Opens `InvestorReportModal`
- **Functionality:**
  - Displays comprehensive financial report
  - Shows burn rate, runway, financials, risks, roadmap status
  - Team financial data (Owner only)
  - PDF export capability

#### 4.5 Investor Report Modal

**Component:** `client/src/components/investor-report-modal.tsx`

**Layout:**
- **Width:** `90vw` with `max-w-[1400px]` (wide dashboard-style)
- **Height:** `max-h-[90vh]` with scrollable content
- **Header:** Title, subtitle, "Download PDF" button, close button

**Sections:**

1. **Key Metrics Grid (4 columns):**
   - Burn Rate: Monthly and daily display
   - Runway: Months remaining with battery icon and status
   - Budget Variance: Over/under budget with percentage

2. **Financial Overview Chart:**
   - Area chart showing Planned vs Actual over time
   - X-axis: Months (e.g., "Jan", "Feb")
   - Y-axis: Auto-scaling currency values
   - Ensures minimum 2 data points for visibility

3. **Roadmap Progress:**
   - Completed tasks vs total tasks
   - Time elapsed percentage
   - Ahead/behind schedule indicator

4. **Top Risks:**
   - Top 3 risks by `risk.auto_score`
   - Displays probability, impact, description

5. **Team & Financial Structure (Owner only):**
   - Role distribution
   - Member table with:
     - Name, email, roles
     - Monthly salary, hourly rate, daily rate
     - Join date

**PDF Export:**
- **Technology:** `html2canvas` + `jsPDF`
- **Target Element:** `id="report-printable-area"`
- **Quality:** Scale 2 for high resolution
- **Color Handling:** Computed Style Transfer technique to convert `oklch` colors to RGB
- **Multi-page:** Automatically handles content overflow

#### 4.6 Transaction Log Drawer

**Component:** `TransactionLogDrawer`

**Trigger:** Click on "Planned Value (PV)" card

**Functionality:**
- Displays recent transactions
- Shows transaction type (`+` for income, `-` for expense)
- Displays amount, date, description, author

#### 4.7 Fixed Costs Modal

**Component:** `FixedCostsModal`

**Functionality:**
- Lists all fixed costs for the project
- Displays: Name, category, amount, frequency
- Owner can add/delete fixed costs
- Fixed costs feed into PV calculation

---

## 5. API Reference

#### 5.1 Get Dashboard Stats

**Endpoint:** `GET /api/projects/:projectId/stats`

**Authentication:** Required (Bearer token)

**Permissions:** `can_view_financial`

**Request:**
```http
GET /api/projects/507f1f77bcf86cd799439011/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "evmDataPoints": [
      {
        "date": "2024-01-01",
        "PV": 1000.50,
        "AC": 800.25,
        "EV": 900.75
      }
    ],
    "current": {
      "PV": 50000.00,
      "AC": 45000.00,
      "EV": 48000.00
    },
    "variances": {
      "scheduleVariance": -2000.00,
      "costVariance": 3000.00
    },
    "transactions": [...],
    "tasksByStatus": {
      "Todo": 10,
      "In Progress": 5,
      "Review": 2,
      "Done": 20
    },
    "totalTasks": 37
  }
}
```

**Key Fields:**
- `evmDataPoints`: Array of daily PV, AC, EV values for S-Curve chart
- `current`: Current day's PV, AC, EV values
- `variances`: Schedule Variance (SV) and Cost Variance (CV)
- `transactions`: Recent transactions (limit 10)
- `tasksByStatus`: Task count by status

#### 5.2 Get Investor Report

**Endpoint:** `GET /api/projects/:projectId/reports/investor`

**Authentication:** Required (Bearer token)

**Permissions:** `can_generate_reports` (checked in route, but not enforced in controller)

**Request:**
```http
GET /api/projects/507f1f77bcf86cd799439011/reports/investor
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Project Name",
      "description": "Project Description",
      "startDate": "2024-01-01T00:00:00.000Z",
      "currentDate": "2024-06-15T00:00:00.000Z"
    },
    "burnRate": {
      "monthly": 12500.00,
      "daily": 410.50
    },
    "runway": {
      "months": 8.5,
      "date": "2025-03-01T00:00:00.000Z",
      "status": "healthy",
      "message": "Funds last until March 1, 2025"
    },
    "financials": {
      "plannedTotal": 100000.00,
      "actualTotal": 75000.00,
      "variance": -25000.00
    },
    "topRisks": [
      {
        "taskId": "507f1f77bcf86cd799439012",
        "title": "Risk Task",
        "riskScore": 25,
        "probability": 5,
        "impact": 5,
        "description": "Risk description",
        "status": "In Progress"
      }
    ],
    "roadmapStatus": {
      "completedTasks": 20,
      "totalTasks": 37,
      "completedPercentage": 54.05,
      "timeElapsedPercentage": 45.00,
      "isAheadOfSchedule": true
    },
    "team": {
      "roleDistribution": {
        "Developer": 3,
        "Designer": 2
      },
      "members": [
        {
          "userId": "507f1f77bcf86cd799439013",
          "displayName": "John Doe",
          "email": "john@example.com",
          "roles": ["Developer"],
          "primaryRole": "Developer",
          "monthlySalary": 5000.00,
          "hourlyRate": 31.25,
          "dailyRate": 250.00,
          "joinedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "totalMembers": 5,
      "totalMonthlySalary": 25000.00
    },
    "isOwner": true
  }
}
```

**Key Fields:**
- `burnRate`: Monthly and daily burn rate
- `runway`: Months remaining, date, status, message
- `financials`: Planned total, actual total, variance
- `topRisks`: Top 3 risks by score
- `roadmapStatus`: Completion percentage vs time elapsed
- `team`: Only included if user is Owner (otherwise `null`)

#### 5.3 Create Transaction

**Endpoint:** `POST /api/projects/:projectId/transactions`

**Authentication:** Required (Bearer token)

**Permissions:** `can_view_financial` (implicit, via `checkProjectMember`)

**Request:**
```http
POST /api/projects/507f1f77bcf86cd799439011/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 1000.00,
  "type": "+",
  "source": "Client Payment",
  "date": "2024-06-15T00:00:00.000Z",
  "description": "Monthly payment from client"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "projectId": "507f1f77bcf86cd799439011",
    "amount": 1000.00,
    "type": "+",
    "source": "Client Payment",
    "date": "2024-06-15T00:00:00.000Z",
    "description": "Monthly payment from client",
    "authorId": {
      "_id": "507f1f77bcf86cd799439015",
      "displayName": "John Doe"
    },
    "_persistedToMongo": true
  }
}
```

**Transaction Types:**
- `"+"`: Income (adds to project funds)
- `"-"`: Expense (subtracts from project funds)

#### 5.4 Get Transactions

**Endpoint:** `GET /api/projects/:projectId/transactions`

**Authentication:** Required (Bearer token)

**Permissions:** `can_view_financial`

**Request:**
```http
GET /api/projects/507f1f77bcf86cd799439011/transactions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "projectId": "507f1f77bcf86cd799439011",
      "amount": 1000.00,
      "type": "+",
      "source": "Client Payment",
      "date": "2024-06-15T00:00:00.000Z",
      "description": "Monthly payment from client",
      "authorId": {
        "_id": "507f1f77bcf86cd799439015",
        "displayName": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

**Sorting:** Transactions are sorted by `date` in descending order (newest first)

---

## 6. Database Schema Reference

#### 6.1 Project Model

**Location:** `server/models/Project.js`

**Financial-Relevant Fields:**

```javascript
{
  // Fixed costs array
  fixedCosts: [{
    title: String,        // Cost name (e.g., "Office Rent")
    amount: Number,       // Cost amount
    frequency: String,    // 'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly'
    currency: String      // Default: 'USD'
  }],
  
  // Work schedule for rate calculations
  workSchedule: {
    workingDaysPerWeek: Number,  // Default: 5
    daysOffPerWeek: Number,      // Default: 2
    hoursPerDay: Number          // Default: 8
  },
  
  // EVM snapshots (daily snapshots of PV, AC, EV)
  evmSnapshots: [{
    date: Date,
    plannedValue: Number,  // PV
    actualCost: Number,    // AC
    earnedValue: Number    // EV
  }],
  
  // Cumulative actual cost (updated daily by cron)
  cumulativeActualCost: Number,
  
  // Project members (for salary calculations)
  members: [{
    userId: ObjectId,      // Reference to User
    roles: [String],       // Array of role names
    hourlyRate: Number,    // Optional override
    joinedAt: Date
  }],
  
  // Timestamps
  createdAt: Date,         // Used as project start date
  updatedAt: Date
}
```

#### 6.2 Expense Model

**Location:** `server/models/Expense.js`

**Schema:**

```javascript
{
  projectId: ObjectId,     // Reference to Project (required, indexed)
  name: String,            // Expense name (required, trimmed)
  amount: Number,         // Expense amount (required, min: 0)
  frequency: String,      // 'daily' | 'weekly' | 'monthly' | 'yearly' (default: 'monthly')
  createdBy: ObjectId,     // Reference to User (required)
  updatedBy: ObjectId,    // Reference to User (optional)
  createdAt: Date,        // Used for AC calculation
  updatedAt: Date
}
```

**Indexes:**
- `{ projectId: 1, createdAt: -1 }` - For efficient querying by project and date

#### 6.3 Transaction Model

**Location:** `server/models/Transaction.js`

**Schema:**

```javascript
{
  projectId: ObjectId,     // Reference to Project (required, indexed)
  amount: Number,         // Transaction amount (required)
  type: String,           // '+' (income) | '-' (expense) (required)
  source: String,         // Transaction source (required, trimmed)
  date: Date,            // Transaction date (required, immutable, indexed)
  authorId: ObjectId,    // Reference to User (required)
  description: String,    // Optional description
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ projectId: 1, date: -1 }` - For efficient querying by project and date
- `{ projectId: 1, type: 1 }` - For filtering by transaction type

#### 6.4 Task Model

**Location:** `server/models/Task.js`

**Financial-Relevant Fields:**

```javascript
{
  projectId: ObjectId,    // Reference to Project (required, indexed)
  estimateHours: Number,  // Estimated hours to complete (required, min: 0)
  assignees: [ObjectId],   // Array of User references (for hourly rate calculation)
  startDate: Date,        // Task start date (used for PV calculation)
  deadline: Date,         // Task deadline (used for PV calculation)
  status: String,         // 'Todo' | 'In Progress' | 'Review' | 'Done' (indexed)
  updatedAt: Date         // Used for EV calculation (when status === 'Done')
}
```

#### 6.5 User Model

**Location:** `server/models/User.js`

**Financial-Relevant Fields:**

```javascript
{
  monthlySalary: Number,   // Monthly salary (used for hourly/daily rate calculation)
  // ... other user fields
}
```

---

## 7. Additional Notes

#### 7.1 Data Synchronization

The Financial Dashboard and Investor Report use the **exact same calculation functions** from `evmEngine.js` to ensure 100% data parity:

- `calculatePV(project, today)` - Used by both
- `calculateAC(project, today)` - Used by both
- `calculateEV(project, date)` - Used by Financial Dashboard

The Investor Report controller includes a helper function `getFinancialDashboardValues()` that replicates the exact logic from `financialController.getDashboardStats()` to guarantee consistency.

#### 7.2 EVM Snapshots

The system maintains daily snapshots of EVM metrics in `project.evmSnapshots` array. These snapshots are updated by a cron job that calls `calculateDailyActualCost()` daily. If snapshots exist for a target date, `calculateAC()` uses the snapshot value instead of recalculating, improving performance.

#### 7.3 Performance Considerations

- **S-Curve Generation**: Limited to 365 days maximum to prevent performance issues
- **Data Point Sampling**: If project duration > 100 days, data points are generated every 7th day instead of daily
- **Snapshot Optimization**: AC calculation uses snapshots when available to avoid expensive recalculations

#### 7.4 Security & Permissions

- **View Financial Data**: Requires `can_view_financial` permission
- **Generate Reports**: Requires `can_generate_reports` permission
- **Team Salary Data**: Only visible to project Owner in Investor Report
- **Fixed Costs Management**: Only Owner can add/delete fixed costs

---

**Document Version:** 1.0  
**Last Updated:** 2024-06-15  
**Author:** Technical Documentation Team

