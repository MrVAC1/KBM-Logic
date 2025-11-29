# Architecture Documentation

## System Overview

KBM Logic v4 follows a **Client-Server architecture** with clear separation between frontend (React) and backend (Express/Node.js). The system uses MongoDB as the primary database and Firebase for authentication.

### Architecture Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   React Client  │ ◄─────► │  Express API    │ ◄─────► │    MongoDB      │
│   (Port 5173)   │  HTTP   │   (Port 5000)    │  ODM    │   (Port 27017)   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
         │                           │
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  Firebase Auth  │         │ Firebase Admin  │
│   (Client SDK)  │         │   (Server SDK)  │
└─────────────────┘         └─────────────────┘
```

### Data Flow

1. **Authentication Flow**:
   - User authenticates via Firebase Auth (client-side)
   - Firebase token sent to Express API
   - Express verifies token with Firebase Admin SDK
   - User synced to MongoDB (if new)
   - MongoDB user record used for all subsequent operations

2. **Request Flow**:
   - Client sends request with Firebase token in `Authorization` header
   - `authMiddleware` verifies token and loads MongoDB user
   - `rbacMiddleware` checks project membership and permissions
   - Controller executes business logic
   - Response sent back to client

## Database Schema

### User Model

```javascript
{
  uid: String (unique, indexed),           // Firebase UID
  email: String (unique, lowercase),
  displayName: String,
  avatar: String,
  role: Enum ['Pending', 'User', 'Admin'],
  emailVerified: Boolean,
  phoneNumber: String,
  createdProjects: [ObjectId],             // Array of Project IDs
  projectsCount: Number,                   // Count of created projects
  profile: {
    bio: String,
    location: String
  },
  timestamps: { createdAt, updatedAt }
}
```

**Relationships**:
- `createdProjects` → `Project.ownerId` (one-to-many)
- Referenced in `Project.members[].userId` (many-to-many)

### Project Model

```javascript
{
  name: String (required),
  description: String,
  passwordHash: String (select: false),    // Bcrypt hashed
  ownerId: ObjectId (ref: 'User', indexed),
  fixedCosts: [{
    title: String,
    amount: Number,
    frequency: Enum ['one-time', 'daily', 'weekly', 'monthly', 'yearly'],
    currency: String (default: 'USD')
  }],
  members: [{                               // Inline role data
    userId: ObjectId (ref: 'User'),
    roleName: Enum ['Owner', 'Admin', 'PM', 'Developer', 'Guest'],
    permissions: [String],                  // Array of permission strings
    hourlyRate: Number,
    joinedAt: Date
  }],
  inviteCode: String (unique, sparse),
  isDeleted: Boolean (default: false, indexed),
  timestamps: { createdAt, updatedAt }
}
```

**Key Design Decision**: Role data is stored **inline** in `members` array, not in a separate `roles` collection. This simplifies queries and ensures role data is always available with member records.

**Relationships**:
- `ownerId` → `User._id` (many-to-one)
- `members[].userId` → `User._id` (many-to-many)
- Referenced in `Task.projectId` (one-to-many)
- Referenced in `Transaction.projectId` (one-to-many)

### Task Model

```javascript
{
  projectId: ObjectId (ref: 'Project', indexed),
  title: String (required),
  description: String,
  status: Enum ['Todo', 'In Progress', 'Review', 'Done'] (indexed),
  priority: Enum ['Low', 'Medium', 'High', 'Critical'],
  complexity: Enum ['Low', 'Med', 'High'],
  assignees: [ObjectId] (ref: 'User', indexed),
  deadline: Date (indexed),
  timeLogs: [{
    userId: ObjectId (ref: 'User'),
    startTime: Date,
    endTime: Date,
    duration: Number,                       // in seconds
    description: String
  }],
  risk: {
    probability: Number (1-5),
    impact: Number (1-5),
    auto_score: Number,                     // probability × impact
    isAutoAdjusted: Boolean,
    autoAdjustReason: String
  },
  timestamps: { createdAt, updatedAt }
}
```

**Indexes**:
- `{ projectId: 1, status: 1 }` - Fast filtering by project and status
- `{ assignees: 1 }` - Fast "My Tasks" queries
- `{ deadline: 1 }` - Risk engine deadline checks

**Relationships**:
- `projectId` → `Project._id` (many-to-one)
- `assignees[]` → `User._id` (many-to-many)
- `timeLogs[].userId` → `User._id` (many-to-one)

### Transaction Model

```javascript
{
  projectId: ObjectId (ref: 'Project', indexed),
  amount: Number (required),
  type: Enum ['+', '-'],                   // Income or Expense
  source: String (required),               // e.g., "Client Payment", "Software License"
  date: Date (required, immutable, indexed),
  authorId: ObjectId (ref: 'User'),
  description: String,
  timestamps: { createdAt, updatedAt }
}
```

**Indexes**:
- `{ projectId: 1, date: -1 }` - Recent transactions per project
- `{ projectId: 1, type: 1 }` - Income vs expense filtering

**Relationships**:
- `projectId` → `Project._id` (many-to-one)
- `authorId` → `User._id` (many-to-one)

## Security Architecture

### Authentication Flow

1. **Client-Side (Firebase Auth)**:
   ```javascript
   // User signs in with email/password or Google
   const userCredential = await signInWithEmailAndPassword(auth, email, password);
   const token = await userCredential.user.getIdToken();
   localStorage.setItem('firebaseToken', token);
   ```

2. **Server-Side Verification**:
   ```javascript
   // Middleware verifies Firebase token
   const decodedToken = await admin.auth().verifyIdToken(token);
   req.user = decodedToken; // Firebase user data
   
   // Load MongoDB user record
   const dbUser = await User.findOne({ uid: decodedToken.uid });
   req.dbUser = dbUser; // MongoDB user (source of truth)
   ```

3. **User Sync**:
   - On first login, Firebase user is synced to MongoDB via `POST /api/auth/sync`
   - MongoDB becomes the source of truth for all user data
   - Firebase UID is stored as `User.uid` for linking

### RBAC (Role-Based Access Control)

#### Permission System

**Available Permissions**:
```javascript
const ALL_PERMISSIONS = [
  // View permissions
  'can_view_dashboard',
  'can_view_tasks',
  'can_view_risks',
  'can_view_financial',
  // Action permissions
  'can_track_time',
  'can_create_tasks',
  'can_edit_tasks',
  'can_delete_tasks',
  'can_edit_budget',
  'can_manage_roles',
  'can_invite_users',
  'can_manage_settings',
  'can_delete_project',
];
```

#### Role Definitions

| Role | Default Permissions |
|------|---------------------|
| **Owner** | All permissions (ALL_PERMISSIONS) |
| **Admin** | View all, manage tasks, edit budget, invite users, manage settings |
| **PM** | View all, track time, create/edit tasks, invite users |
| **Developer** | View tasks/risks, track time, create/edit tasks |
| **Guest** | No permissions (empty array) |

**Note**: Permissions are stored **inline** in `Project.members[].permissions`, allowing per-project customization.

#### RBAC Middleware Flow

```javascript
// 1. Check project membership
checkProjectMember(req, res, next) {
  const member = project.members.find(m => m.userId === req.dbUser._id);
  if (!member && !isOwner) return 403;
  
  // Load permissions from member record
  req.memberPermissions = member.permissions || [];
  req.memberRole = member.roleName;
  next();
}

// 2. Check specific permission
requirePermission('can_view_tasks')(req, res, next) {
  if (req.isOwner) return next(); // Owner bypass
  if (!req.memberPermissions.includes('can_view_tasks')) return 403;
  next();
}
```

### Gateway Logic (Pending Users)

**Problem**: New users who join a project should not see sensitive data until assigned a role.

**Solution**: "Safe View" system

1. **Backend** (`getProjectDetails`):
   ```javascript
   const isGuestOrPending = !isOwner && 
     (userRoleName === 'Guest' || userPermissions.length === 0);
   
   if (isGuestOrPending) {
     return {
       id, name, description, status,
       role: 'Guest',
       isSafeView: true,  // Flag for frontend
       owner: { name, avatar },
       currentUserAccess: {
         role: 'Guest',
         permissions: [],
         isPending: true
       }
     };
   }
   ```

2. **Frontend** (`WorkspaceLayout`):
   ```javascript
   if (currentProject?.isSafeView) {
     return <ProjectOverview project={currentProject} />;
     // Sidebar and main content hidden
   }
   ```

**Result**: Guest users see only project name, description, owner, and "Waiting for access approval" message.

## Business Logic Engines

### Budget Engine (S-Curve Calculation)

**Location**: `server/services/budgetEngine.js`

#### Planned Value Formula

The S-Curve represents cumulative planned spending over time:

```javascript
calculatePlannedValue(projectId, startDate, endDate, fixedCosts) {
  const dayDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
  const plannedValueCurve = [];
  let cumulativePlanned = 0;
  
  // Daily fixed costs
  const dailyFixedCost = fixedCosts.reduce((sum, fc) => {
    if (fc.frequency === 'monthly') return sum + (fc.amount / 30);
    if (fc.frequency === 'weekly') return sum + (fc.amount / 7);
    if (fc.frequency === 'yearly') return sum + (fc.amount / 365);
    return sum + fc.amount; // daily
  }, 0);
  
  // For each day in project timeline
  for (let day = 0; day <= dayDiff; day++) {
    let dailyTaskPlannedSpend = 0;
    
    // Calculate planned spend from tasks active on this day
    tasks.forEach(task => {
      if (currentDate >= task.createdAt && currentDate <= task.deadline) {
        const taskDuration = (task.deadline - task.createdAt) / (1000 * 60 * 60 * 24);
        const estimatedHours = task.timeLogs?.reduce(...) || 8;
        const estimatedCost = estimatedHours * hourlyRate;
        dailyTaskPlannedSpend += estimatedCost / taskDuration;
      }
    });
    
    cumulativePlanned += dailyFixedCost + dailyTaskPlannedSpend;
    plannedValueCurve.push({ date, plannedValue: cumulativePlanned });
  }
  
  return plannedValueCurve; // S-Curve data points
}
```

**Output Format**:
```javascript
[
  { date: '2024-01-01', plannedValue: 100 },
  { date: '2024-01-02', plannedValue: 250 },
  { date: '2024-01-03', plannedValue: 450 },
  // ... S-Curve progression
]
```

#### Actual Cost Calculation

```javascript
calculateActualCost(projectId) {
  // From time logs
  let taskCostSum = 0;
  tasks.forEach(task => {
    task.timeLogs?.forEach(log => {
      const hours = log.duration / 3600;
      taskCostSum += hours * hourlyRate;
    });
  });
  
  // From transactions
  const transactionSum = transactions.reduce((sum, t) => {
    return sum + (t.type === '+' ? t.amount : -t.amount);
  }, 0);
  
  return taskCostSum + transactionSum;
}
```

### Risk Engine (Dynamic Scoring)

**Location**: `server/services/riskEngine.js`

#### Risk Score Formula

Base risk score: `probability × impact` (1-25 scale)

#### Auto-Adjustment Logic

```javascript
recalculateRisk(taskId, projectId) {
  let newProbability = task.risk.probability;
  let newImpact = task.risk.impact;
  let autoAdjustReason = null;
  
  // Time Modifier: Deadline < 2 days
  if (task.deadline) {
    const daysUntilDeadline = (task.deadline - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilDeadline < 2 && task.status !== 'Done') {
      newProbability = Math.min(5, newProbability + 1);
      autoAdjustReason = 'Deadline approaching (< 2 days)';
    }
  }
  
  // Budget Modifier: (Future enhancement)
  // if (actualCost > projectBudget) {
  //   newProbability = Math.min(5, newProbability + 1);
  //   autoAdjustReason = 'Budget overrun';
  // }
  
  const autoScore = newProbability * newImpact;
  
  return {
    probability: newProbability,
    impact: newImpact,
    auto_score: autoScore,
    isAutoAdjusted: !!autoAdjustReason,
    autoAdjustReason
  };
}
```

**Risk Matrix**:
- **1-5**: Low Risk (Green)
- **6-10**: Medium Risk (Yellow)
- **11-15**: High Risk (Orange)
- **16-20**: Very High Risk (Red)
- **21-25**: Critical Risk (Dark Red)

**Auto-Adjustment Triggers**:
1. Deadline < 2 days away → Probability +1 (capped at 5)
2. Budget overrun (future) → Probability +1

## API Architecture

### Request/Response Format

**Success Response**:
```javascript
{
  success: true,
  data: { ... }
}
```

**Error Response**:
```javascript
{
  success: false,
  message: "Error description",
  error: "Detailed error" // (development only)
}
```

### Middleware Chain

```
Request → CORS → Helmet → Rate Limit → JSON Parser → 
Mongo Sanitize → Auth Middleware → RBAC Middleware → 
Validation → Controller → Response
```

### Error Handling

- **401 Unauthorized**: Invalid/missing token
- **403 Forbidden**: Missing permission or not a project member
- **404 Not Found**: Resource doesn't exist
- **400 Bad Request**: Validation error
- **500 Internal Server Error**: Server error

## Performance Optimizations

1. **Database Indexes**: All foreign keys and frequently queried fields are indexed
2. **Population**: User data populated only when needed (selective fields)
3. **Rate Limiting**: 100 requests per 15 minutes per IP
4. **Query Optimization**: Compound indexes for multi-field queries
5. **Selective Field Loading**: Password hashes excluded by default (`select: false`)

## Deployment Considerations

### Environment Variables
- All sensitive data in `.env` files
- Firebase service account key stored securely
- MongoDB connection string encrypted in production

### Security Headers
- Helmet.js configured for production
- CORS restricted to frontend domain
- MongoDB injection protection enabled

### Scalability
- Stateless API design (JWT tokens)
- Horizontal scaling possible
- Database connection pooling (Mongoose default)

---

**Last Updated**: 2024

