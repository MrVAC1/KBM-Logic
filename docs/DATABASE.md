# Database Integration Documentation

## Overview

The application uses **MongoDB Atlas** (cloud-hosted MongoDB) as the primary database. This document describes the database connection, schema structure, and key models.

---

## MongoDB Atlas Connection

### Configuration

**Connection String:** Set in `server/.env`
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxx.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0
```

**Database Name:** `kbm-logic`

**Connection Options:**
- `serverSelectionTimeoutMS: 10000` (10 seconds)
- `socketTimeoutMS: 45000` (45 seconds)
- `retryWrites: true` (required for Atlas replica sets)
- `w: 'majority'` (write concern for Atlas)

**Connection File:** `server/config/db.js`

### Connection Flow

1. Load `MONGODB_URI` from environment variables
2. Validate connection string exists
3. Warn if using local MongoDB (should use Atlas)
4. Connect with optimized options
5. Handle connection events (error, disconnect, reconnect)

---

## Key Models

### 1. Project Model

**Collection:** `projects`

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | String (required) | Project name |
| `description` | String | Project description |
| `ownerId` | ObjectId (required, indexed) | Reference to User (project owner) |
| `deadline` | Date (nullable) | Target completion date ⭐ |
| `createdAt` | Date (auto) | Project creation date |
| `workSchedule` | Object | Work schedule configuration |
| `members[]` | Array | Project members with roles & permissions |
| `customRoles[]` | Array | Custom role definitions |
| `fixedCosts[]` | Array | Fixed cost items |
| `evmSnapshots[]` | Array | Cached EVM calculation snapshots |
| `isDeleted` | Boolean | Soft delete flag |

**Work Schedule Structure:**
```javascript
{
  workingDaysPerWeek: Number,  // 1-7
  daysOffPerWeek: Number,       // 0-6
  hoursPerDay: Number           // 1-24
}
```

**Member Structure:**
```javascript
{
  userId: ObjectId,            // Reference to User
  roles: [String],            // Array of role names
  permissions: [String],      // Array of permission strings (enum: ALL_PERMISSIONS)
  hourlyRate: Number,
  joinedAt: Date,
  notificationSettings: {
    notifyOnTaskAssignment: Boolean,
    notifyOnBudgetRisk: Boolean,
    // ... other notification preferences
  }
}
```

**Custom Role Structure:**
```javascript
{
  name: String,                // Role name
  color: String,              // Display color
  hierarchy: Number,         // Position in hierarchy
  permissions: [String]      // Array of permission strings
}
```

**EVM Snapshot Structure:**
```javascript
{
  date: Date,                // Snapshot date
  plannedValue: Number,      // PV for this date
  actualCost: Number,        // AC for this date
  earnedValue: Number       // EV for this date
}
```

**Indexes:**
- `{ ownerId: 1, isDeleted: 1 }` - Find projects by owner
- `{ inviteCode: 1 }` - Find projects by invite code

---

### 2. Transaction Model

**Collection:** `transactions`

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | ObjectId (required, indexed) | Reference to Project |
| `amount` | Number (required) | Transaction amount |
| `type` | Enum: '+', '-' (required) | '+' = Income, '-' = Expense |
| `source` | String (required) | Transaction source |
| `date` | Date (required, immutable, indexed) | Transaction date |
| `authorId` | ObjectId (required) | Reference to User (creator) |
| `description` | String | Transaction description |
| `createdAt` | Date (auto) | Creation timestamp |
| `updatedAt` | Date (auto) | Update timestamp |

**Usage in EVM:**
- **Income (`type: '+'`):** Increases available budget
- **Expense (`type: '-'`):** Increases Actual Cost (AC)

**Indexes:**
- `{ projectId: 1, type: 1, date: -1 }` - Optimized for budget calculation
- `{ projectId: 1, date: -1 }` - General transactions lookup
- `{ projectId: 1, type: 1 }` - Transactions by type

---

### 3. Task Model

**Collection:** `tasks`

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | ObjectId (required, indexed) | Reference to Project |
| `title` | String (required) | Task title |
| `description` | String | Task description |
| `status` | Enum (indexed) | 'Todo', 'In Progress', 'Review', 'Done' |
| `priority` | Enum | 'Low', 'Medium', 'High', 'Critical' |
| `complexity` | Enum | 'Low', 'Med', 'High' |
| `assignees[]` | Array of ObjectId | References to User |
| `startDate` | Date | Task start date |
| `deadline` | Date | Task deadline |
| `estimateHours` | Number (required, min: 0) | Estimated hours to complete |
| `plannedValue` | Number | Auto-calculated planned value |
| `plannedCost` | Number | Auto-calculated planned cost |
| `risk` | Object | Risk assessment data |
| `updatedAt` | Date (indexed) | Last update timestamp (used for EV calculation) |

**Risk Structure:**
```javascript
{
  probability: Number,      // 1-5
  impact: Number,          // 1-5
  auto_score: Number,      // Calculated risk score
  isAutoAdjusted: Boolean,
  autoAdjustReason: String
}
```

**Indexes:**
- `{ projectId: 1, status: 1, updatedAt: -1 }` - Optimized for EV calculation
- `{ projectId: 1, status: 1 }` - General project tasks lookup
- `{ assignees: 1 }` - Find tasks by assignee
- `{ deadline: 1 }` - Find tasks by deadline

---

### 4. Expense Model

**Collection:** `expenses`

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | ObjectId (required, indexed) | Reference to Project |
| `name` | String (required) | Expense name |
| `amount` | Number (required, min: 0) | Expense amount |
| `frequency` | Enum | 'daily', 'weekly', 'monthly', 'yearly' |
| `createdBy` | ObjectId (required) | Reference to User (creator) |
| `updatedBy` | ObjectId | Reference to User (last updater) |
| `createdAt` | Date (indexed) | Creation timestamp |
| `updatedAt` | Date | Update timestamp |

**Usage in EVM:**
- Contributes to Actual Cost (AC) calculation
- Frequency-based calculation:
  - Daily: `amount × daysSinceStart`
  - Weekly: `amount × ceil(daysSinceStart / 7)`
  - Monthly: `amount × ceil(daysSinceStart / 30.44)`
  - Yearly: `amount × ceil(daysSinceStart / 365)`

**Indexes:**
- `{ projectId: 1, createdAt: 1, frequency: 1 }` - Optimized for AC calculation
- `{ projectId: 1, createdAt: -1 }` - General expenses lookup

---

### 5. User Model

**Collection:** `users`

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `firebaseUid` | String (unique, indexed) | Firebase Authentication UID |
| `email` | String (unique) | User email address |
| `displayName` | String | User display name |
| `photoURL` | String | User profile photo URL |
| `monthlySalary` | Number | Monthly salary (used for rate calculations) |
| `createdAt` | Date (auto) | Account creation date |
| `updatedAt` | Date (auto) | Last update timestamp |

**Usage in EVM:**
- `monthlySalary` is used to calculate:
  - Hourly rate: `Monthly Salary / Working Hours per Month`
  - Daily rate: `Monthly Salary / Working Days per Month`

---

## Database Relationships

### Project → Members → Users
```
Project.members[].userId → User._id
```

### Project → Tasks
```
Task.projectId → Project._id
```

### Project → Transactions
```
Transaction.projectId → Project._id
Transaction.authorId → User._id
```

### Project → Expenses
```
Expense.projectId → Project._id
Expense.createdBy → User._id
```

### Task → Assignees → Users
```
Task.assignees[] → User._id
```

---

## Data Flow for EVM Calculations

### PV (Planned Value)
1. Query `Task` collection: `{ projectId: projectId }`
2. Populate `assignees` with `User.monthlySalary`
3. Calculate task budgets from `estimateHours` and hourly rates
4. Sum based on task deadlines and target date

### AC (Actual Cost)
1. Query `Project.members[]` → Get `User.monthlySalary`
2. Calculate daily rates from salaries
3. Query `Expense` collection: `{ projectId: projectId }`
4. Query `Transaction` collection: `{ projectId: projectId, type: '-', date: { $lte: targetDate } }`
5. Sum: Salaries + Expenses + Negative Transactions

### EV (Earned Value)
1. Query `Task` collection: `{ projectId: projectId, status: 'Done', updatedAt: { $lte: targetDate } }`
2. Populate `assignees` with `User.monthlySalary`
3. Calculate task budgets for completed tasks
4. Sum all completed task budgets

### Budget Calculation
1. Calculate PV (see above)
2. Query `Transaction` collection: `{ projectId: projectId, type: '+' }`
3. Sum positive transactions
4. Calculate: `Remaining Budget = (PV + Income) - AC`

---

## Performance Optimizations

### Indexes
All models have optimized indexes for common query patterns:
- Project lookups by owner
- Task queries by project and status
- Transaction queries by project, type, and date
- Expense queries by project and date

### Snapshot Caching
- Historical EVM values cached in `Project.evmSnapshots[]`
- Reduces recalculation time by ~90% for historical dates
- Daily cron job updates snapshots

### Query Optimization
- Use `.lean()` for read-only queries (faster)
- Use `.populate()` only when needed
- Filter at database level, not in application code

---

## Migration Scripts

### Cleanup Permissions
```bash
npm run cleanup:permissions
```
Removes obsolete permissions (`can_track_time`) from all projects.

### Fix Deadline Permissions
```bash
npm run fix:deadline-permissions
```
Adds `can_manage_deadline` to Owner and Project Manager roles.

---

## Connection Troubleshooting

### Issue: Connection Timeout
**Solution:**
- Check MongoDB Atlas IP whitelist
- Verify connection string format
- Check network connectivity

### Issue: Authentication Failed
**Solution:**
- Verify username and password in connection string
- Check database user permissions in Atlas
- Ensure database name is correct (`kbm-logic`)

### Issue: Database Not Found
**Solution:**
- Verify database name in connection string: `...mongodb.net/kbm-logic?...`
- Check if database exists in Atlas
- Ensure user has access to the database

---

## Security Notes

1. **Connection String:** Never commit `.env` file to version control
2. **Credentials:** Store in environment variables only
3. **IP Whitelist:** Configure MongoDB Atlas IP whitelist
4. **Database User:** Use dedicated database user with minimal required permissions

---

## Backup & Recovery

### Recommended Backup Strategy
1. **MongoDB Atlas Automated Backups:** Enable in Atlas dashboard
2. **Manual Exports:** Use `mongodump` for critical data
3. **Snapshot Frequency:** Daily snapshots recommended

### Recovery Process
1. Restore from Atlas backup
2. Run migration scripts if schema changed
3. Verify data integrity

---

## Key Files

- **Connection:** `server/config/db.js`
- **Models:** `server/models/*.js`
- **Migrations:** `server/scripts/*.js`

