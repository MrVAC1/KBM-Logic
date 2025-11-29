# KBM Logic v4 - Project Specification

## Project Overview

**Name**: KBM Logic v4  
**Type**: Hybrid Project Management Tool  
**Architecture**: Full-Stack MERN Application  
**Status**: Production Ready (Local Deployment)

KBM Logic is a comprehensive project management application that combines task tracking, financial management, risk assessment, and team collaboration in a single platform. The application features a "Hybrid" UI design that merges modern design patterns with professional dark mode aesthetics.

---

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK (Token Verification)
- **Security**: 
  - Helmet (HTTP Security Headers)
  - CORS (Cross-Origin Resource Sharing)
  - express-mongo-sanitize (NoSQL Injection Prevention)
  - express-rate-limit (100 requests per 15 minutes)
- **Validation**: Joi Schema Validation
- **Password Hashing**: bcryptjs (10 salt rounds)
- **Logging**: Custom Winston-based logger

### Frontend
- **Framework**: React 18 with Hooks
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with Custom Theme (OKLCH Color Space)
- **UI Components**: Radix UI Primitives (70+ components)
- **Routing**: React Router DOM v6
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod Validation
- **Notifications**: Sonner (Toast Notifications)
- **Authentication**: Firebase Client SDK
- **State Management**: React Context API

---

## Architecture

### Directory Structure

```
kbm-logic-v4/
├── server/                    # Backend (Node.js + Express)
│   ├── config/                # Database & Firebase configuration
│   ├── controllers/           # Request handlers (auth, project, task, financial)
│   ├── middleware/            # Auth, RBAC, Validation, Error Handling
│   ├── models/                # Mongoose schemas (User, Project, Task, Transaction)
│   ├── routes/                # API route definitions
│   ├── services/              # Business logic engines (Budget, Risk, MongoSync)
│   └── utils/                 # Helper functions (Logger, Response)
│
├── client/                    # Frontend (React + Vite)
│   └── src/
│       ├── components/        # UI components (70+ files)
│       │   ├── ui/            # Reusable UI primitives
│       │   └── settings/      # Settings page tabs
│       ├── pages/             # Page components
│       ├── contexts/          # React contexts (Auth, Project)
│       ├── services/          # API client (Axios)
│       ├── config/            # Firebase configuration
│       └── lib/               # Utilities & mock data
│
└── docs/                      # Documentation
```

### Request Flow

1. **Client Request** → Axios Interceptor adds Firebase token
2. **Backend Middleware** → `authMiddleware` verifies Firebase token
3. **MongoDB Sync** → User record created/updated in MongoDB
4. **RBAC Check** → `checkProjectMember` validates project access
5. **Permission Check** → `requirePermission` validates specific permissions
6. **Controller** → Business logic execution
7. **Response** → Standardized JSON response with `{ success, data }`

---

## Core Modules

### 1. Authentication & Onboarding

#### Login Flow
1. User authenticates via Firebase (Email/Password or Google Sign-In)
2. Firebase token is stored in `localStorage` as `firebaseToken`
3. On app load, token is sent to `/api/auth/sync` to create/update MongoDB user record
4. User record includes:
   - `uid`: Firebase UID (primary key)
   - `email`, `displayName`, `photoURL`
   - `role`: `'Pending'` | `'User'` | `'Admin'`

#### "Pending" Status
- New users start with `role: 'Pending'`
- Pending users are redirected to `/onboarding` page
- Onboarding modal collects: nickname, birth date, location, bio
- After onboarding, role is updated to `'User'`

#### Onboarding Modal
- **Location**: `client/src/components/onboarding-modal.tsx`
- **Steps**: 3-step wizard (Personal Info → Location → Bio)
- **Validation**: Required fields enforced
- **Completion**: Updates user profile and redirects to `/projects`

---

### 2. Dashboard (Financials)

#### Location
- **Page**: `client/src/pages/workspace/financial/page.tsx`
- **Backend**: `server/controllers/financialController.js`
- **Engine**: `server/services/budgetEngine.js`

#### EVM (Earned Value Management) Logic

The dashboard displays three key metrics:

1. **Planned Value (PV)** - S-Curve distribution of expected costs
2. **Actual Cost (AC)** - Real spending from time logs + transactions
3. **Earned Value (EV)** - Value of completed work (based on task status)

#### S-Curve Calculation

**Planned Value Calculation** (`calculatePlannedValue`):

```javascript
// For each day in project timeline:
1. Calculate daily fixed costs (monthly/weekly/daily conversion)
2. For each active task:
   - If current date is between task.createdAt and task.deadline:
     - Estimate task cost: (estimatedHours × hourlyRate)
     - Distribute cost evenly across task duration
     - Add to daily planned spend
3. Cumulative sum creates S-Curve
```

**Key Features**:
- Fixed costs are distributed based on frequency (monthly/30, weekly/7, daily/1)
- Task costs are distributed evenly across task duration
- S-Curve shows gradual ramp-up, peak, and ramp-down

**Actual Cost Calculation** (`calculateActualCost`):

```javascript
1. Sum all time logs: (duration / 3600) × hourlyRate
2. Sum all transactions: +amount or -amount
3. Total = timeLogCosts + transactionSum
```

#### Fixed Costs Management

- **Location**: `client/src/components/fixed-costs-modal.tsx`
- **Frequencies**: `'one-time'`, `'daily'`, `'weekly'`, `'monthly'`, `'yearly'`
- **Storage**: Stored in `Project.fixedCosts[]` array
- **Calculation**: Automatically included in S-Curve

#### Visual Design

- **Chart Type**: High-Contrast Neon Area Chart
- **Background**: Dark slate (`bg-slate-950`)
- **Planned Line**: Cyan gradient fill with bright dotted line
- **Actual Line**: Solid line overlay
- **Data Points**: Daily values from project start to end date

---

### 3. Kanban Board

#### Location
- **Page**: `client/src/pages/workspace/kanban/page.tsx`
- **Backend**: `server/controllers/taskController.js`

#### Task States

Four-column workflow:
1. **Todo** → Initial state, not started
2. **In Progress** → Active work
3. **Review** → Awaiting approval/QA
4. **Done** → Completed

#### Task Model

```javascript
{
  title: String,
  description: String,
  project: ObjectId,
  status: 'Todo' | 'In Progress' | 'Review' | 'Done',
  priority: 'Low' | 'Medium' | 'High' | 'Critical',
  complexity: 'Low' | 'Med' | 'High',
  assignees: [ObjectId],  // Multi-assign support
  deadline: Date,
  timeLogs: [{
    userId: ObjectId,
    startTime: Date,
    endTime: Date,
    duration: Number  // Seconds
  }],
  risk: {
    probability: Number,  // 1-5
    impact: Number,       // 1-5
    auto_score: Number,   // probability × impact
    isAutoAdjusted: Boolean
  }
}
```

#### "Rich Card" Design

Each task card displays:
- **Title** & **Description** (truncated)
- **Priority Badge** (color-coded)
- **Complexity Badge**
- **Assignees** (avatar stack)
- **Deadline** (with overdue indicator)
- **Time Logged** (total duration)
- **Risk Score** (if > 3, shows warning)

#### Task Detail Modal

**Location**: `client/src/components/task-detail-modal.tsx`

**Features**:
- **Full Task Editing**: Title, description, status, priority, complexity, deadline
- **Multi-Assign**: Select multiple team members from project members
- **Timer Controls**: Start/Stop timer (requires `can_track_time` permission)
- **Time Log Display**: Shows all time entries with duration
- **Risk Indicator**: Visual risk score display
- **Permission-Based**: Edit/Delete buttons only show if user has permissions

#### Column Design

- **Fixed Width**: `min-w-[350px]` for all columns
- **Header**: Column name + task count badge
- **Minimalist**: Clean, professional styling
- **Drag & Drop**: UI ready (logic pending)

---

### 4. Risk Engine

#### Location
- **Page**: `client/src/pages/workspace/risks/page.tsx`
- **Backend**: `server/services/riskEngine.js`

#### 5×5 Risk Matrix

**Visual Grid**:
- **X-Axis**: Impact (1-5, Low to High)
- **Y-Axis**: Probability (1-5, Low to High)
- **Cells**: 25 total cells, color-coded:
  - **Green** (1-6): Low risk
  - **Yellow** (7-12): Medium risk
  - **Red** (13-25): High risk

**Cell Display**:
- Shows count of tasks in that risk bucket
- Clicking a cell opens modal with task list
- Modal: `client/src/components/tasks-in-risk-bucket-modal.tsx`

#### Dynamic Scoring Formula

**Auto-Adjustment Logic** (`recalculateRisk`):

```javascript
// Base risk = probability × impact (1-25)

// Time Modifier:
if (deadline < 2 days && status !== 'Done') {
  probability = Math.min(5, probability + 1)
  reason = 'Deadline approaching (< 2 days)'
}

// Budget Modifier (future):
if (actualCost > 100% of planned) {
  probability = Math.min(5, probability + 1)
  reason = 'Budget overrun'
}

// Final score = adjustedProbability × impact
```

**Triggers**:
- Task created/updated
- Deadline changed
- Status changed
- Time logged

**Manual Override**:
- Users can manually set probability/impact
- Auto-adjustment flag (`isAutoAdjusted`) tracks if score was auto-modified

---

### 5. RBAC (Role-Based Access Control)

#### Location
- **Middleware**: `server/middleware/rbacMiddleware.js`
- **Model**: `server/models/Project.js`

#### Permission System

**All Available Permissions**:
```javascript
// View Permissions
'can_view_dashboard'
'can_view_tasks'
'can_view_risks'
'can_view_financial'

// Action Permissions
'can_track_time'
'can_create_tasks'
'can_edit_tasks'
'can_delete_tasks'
'can_edit_budget'
'can_manage_roles'
'can_invite_users'
'can_manage_settings'
'can_delete_project'
```

#### Default Roles

1. **Owner** (Hierarchy: 0)
   - Color: `#ef4444` (Red)
   - Permissions: ALL_PERMISSIONS (locked)
   - Cannot be deleted or modified

2. **Admin** (Hierarchy: 10)
   - Color: `#f97316` (Orange)
   - Permissions: All except `can_delete_project`

3. **PM** (Project Manager) (Hierarchy: 20)
   - Color: `#eab308` (Yellow)
   - Permissions: View all, create/edit tasks, track time, invite users

4. **Developer** (Hierarchy: 30)
   - Color: `#22c55e` (Green)
   - Permissions: View tasks/risks, create/edit tasks, track time

5. **Guest** (Hierarchy: 100)
   - Color: `#6b7280` (Gray)
   - Permissions: None (zero permissions)
   - Default for new members

#### "Owner Safety Lock"

- Owner role cannot be deleted
- Owner role permissions cannot be modified
- Owner always passes all permission checks
- Owner is automatically added as first member on project creation

#### Access Control Flow

1. **`checkProjectMember`**: Validates user is project member or owner
   - Returns `403` if user is not a member
   - Loads user's role and permissions into `req.memberPermissions`

2. **`requirePermission`**: Checks if user has specific permission(s)
   - Owner always passes
   - Returns `403` if permission missing

3. **`requireRole`**: Checks if user has specific role
   - Used for role-based restrictions

#### "Safe View" for Pending Members

**Scenario**: User joins project but has "Guest" role (zero permissions)

**Backend Response** (`getProjectDetails`):
```javascript
// If user is Guest/Pending:
{
  id: project._id,
  name: project.name,
  description: project.description,
  status: 'Active',
  role: 'Guest',
  isSafeView: true,  // Flag indicating limited data
  owner: { name, avatar },
  currentUserAccess: {
    role: 'Guest',
    permissions: [],
    isPending: true
  }
}
```

**Frontend Display**:
- Shows `ProjectOverview` component instead of full workspace
- Message: "You have successfully joined. Please wait for the Project Manager to assign you a role."
- Displays: Project name, description, owner, status
- Hides: Tasks, budget, risks, settings

---

## Database Schema

### User Model

```javascript
{
  uid: String,              // Firebase UID (primary key, unique, indexed)
  email: String,            // Required, unique
  displayName: String,
  photoURL: String,
  role: {
    type: String,
    enum: ['Pending', 'User', 'Admin'],
    default: 'Pending'
  },
  profile: {
    bio: String,
    location: String,
    birthDate: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Project Model

```javascript
{
  name: String,             // Required, trimmed
  description: String,
  passwordHash: String,     // bcrypt hash, not selected by default
  ownerId: ObjectId,       // Ref: User, required, indexed
  fixedCosts: [{
    title: String,
    amount: Number,         // min: 0
    frequency: String,     // enum: ['one-time', 'daily', 'weekly', 'monthly', 'yearly']
    currency: String,      // default: 'USD'
  }],
  roles: [{
    name: String,          // Required
    color: String,         // default: '#6b7280'
    hierarchy: Number,     // default: 100
    isDefault: Boolean,     // default: false
    permissions: [String]   // enum: ALL_PERMISSIONS
  }],
  members: [{
    userId: ObjectId,       // Ref: User, required
    roleId: ObjectId,      // Ref: Role (from roles array)
    role: String,          // Legacy: enum: ['Owner', 'Admin', 'PM', 'Developer', 'Guest']
    hourlyRate: Number,    // default: 0
    joinedAt: Date         // default: Date.now
  }],
  inviteCode: String,      // Unique, sparse index, auto-generated
  isDeleted: Boolean,      // default: false, indexed (soft delete)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ ownerId: 1, isDeleted: 1 }` - Fast lookup of user's projects
- `{ inviteCode: 1 }` - Fast lookup for join requests

### Task Model

```javascript
{
  title: String,           // Required
  description: String,
  project: ObjectId,       // Ref: Project, required, indexed
  status: {
    type: String,
    enum: ['Todo', 'In Progress', 'Review', 'Done'],
    default: 'Todo'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  complexity: {
    type: String,
    enum: ['Low', 'Med', 'High'],
    default: 'Med'
  },
  assignees: [ObjectId],    // Ref: User (multi-assign)
  deadline: Date,
  timeLogs: [{
    userId: ObjectId,      // Ref: User
    startTime: Date,
    endTime: Date,
    duration: Number        // Seconds
  }],
  risk: {
    probability: Number,   // 1-5
    impact: Number,        // 1-5
    auto_score: Number,    // probability × impact
    isAutoAdjusted: Boolean,
    autoAdjustReason: String
  },
  createdBy: ObjectId,     // Ref: User
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ project: 1, status: 1 }` - Fast lookup of project tasks by status

### Transaction Model

```javascript
{
  project: ObjectId,       // Ref: Project, required, indexed
  amount: Number,          // Required, min: 0
  type: {
    type: String,
    enum: ['+', '-'],
    required: true
  },
  source: String,          // e.g., 'Invoice', 'Expense', 'Salary'
  date: Date,              // Required, immutable (set on create)
  description: String,
  authorId: ObjectId,      // Ref: User
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ project: 1, date: -1 }` - Fast lookup of project transactions (newest first)

---

## Security Features

### 1. Helmet
- Sets secure HTTP headers
- Prevents XSS, clickjacking, MIME sniffing

### 2. CORS
- Configured for frontend origin only
- Credentials enabled for token transmission

### 3. Rate Limiting
- **Limit**: 100 requests per 15 minutes per IP
- **Scope**: All `/api/*` routes
- **Response**: 429 Too Many Requests with `Retry-After` header

### 4. Input Sanitization
- `express-mongo-sanitize` prevents NoSQL injection
- Removes `$` and `.` from user input

### 5. Firebase Token Verification
- All protected routes require valid Firebase token
- Token verified via Firebase Admin SDK
- Invalid/expired tokens return `401 Unauthorized`

### 6. RBAC Enforcement
- Permission checks on all sensitive operations
- Zero-trust model: Permissions derived from role
- Owner always has all permissions (locked)

### 7. Password Hashing
- Project passwords hashed with bcryptjs
- Salt rounds: 10
- Passwords never stored in plain text

### 8. Joi Validation
- Request body validation on all POST/PUT endpoints
- Prevents malformed data from reaching controllers

---

## API Endpoints

### Base URL
`http://localhost:5000/api`

### Authentication
All requests require: `Authorization: Bearer <firebase_token>`

### Response Format

**Success**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error**:
```json
{
  "success": false,
  "message": "Error description",
  "stack": "..." // Development only
}
```

### Endpoints

#### Authentication
- `POST /auth/sync` - Sync Firebase user to MongoDB

#### Projects
- `POST /projects` - Create project (requires authentication)
- `GET /projects` - Get user's projects (owner or member)
- `GET /projects/:id` - Get project details (requires membership)
- `POST /projects/join` - Join project with ID + password
- `PUT /projects/:id` - Update project (requires `can_edit_project`)
- `POST /projects/:id/regenerate-invite` - Generate new invite code (requires `can_invite_users`)
- `DELETE /projects/:id` - Soft delete project (Owner only)
- `GET /projects/:id/roles` - Get project roles (for import)

#### Tasks
- `GET /projects/:id/tasks` - Get project tasks (requires membership)
- `POST /projects/:id/tasks` - Create task (requires `can_create_tasks`)
- `PUT /tasks/:id` - Update task (requires `can_edit_tasks`)
- `DELETE /tasks/:id` - Delete task (requires `can_delete_tasks`)
- `POST /tasks/:id/start-timer` - Start time tracking (requires `can_track_time`)
- `POST /tasks/:id/stop-timer` - Stop time tracking (requires `can_track_time`)

#### Financials
- `GET /projects/:id/stats` - Get dashboard stats (EVM) (requires membership)
- `GET /projects/:id/transactions` - Get transactions (requires membership)
- `POST /projects/:id/transactions` - Create transaction (requires `can_edit_budget`)

#### Members
- `PUT /projects/:id/members/:memberId/role` - Update member role (requires `can_manage_roles`)

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing page |
| Login | `/login` | Firebase auth (Email + Google Sign-In) |
| Onboarding | `/onboarding` | New user setup (3-step wizard) |
| Projects | `/projects` | Project portfolio (list of user's projects) |
| Workspace | `/workspace/*` | Project workspace (requires project selection) |
| Financial | `/workspace/financial` | Budget dashboard (S-Curve, EVM) |
| Kanban | `/workspace/kanban` | Task board (4-column workflow) |
| Risks | `/workspace/risks` | Risk matrix (5×5 grid) |
| Settings | `/workspace/settings` | Project settings (Teams, Roles, Invites, Danger Zone) |

---

## UI Components

### Core UI (`components/ui/`)
70+ reusable components built on Radix UI:
- Button, Card, Dialog, Input, Select, Tabs
- Toast, Tooltip, Dropdown, Popover
- Progress, Badge, Avatar, Separator
- Chart, Calendar, Command, Sheet
- And many more...

### Feature Components

- **`app-sidebar.tsx`** - Navigation sidebar with project switcher
- **`create-project-modal.tsx`** - Project creation with role import
- **`join-project-modal.tsx`** - Join project with ID + password
- **`create-task-modal.tsx`** - Task creation form
- **`task-detail-modal.tsx`** - Task editing + timer controls
- **`manage-funds-modal.tsx`** - Transaction creation
- **`budget-breakdown-modal.tsx`** - Cost breakdown details
- **`fixed-costs-modal.tsx`** - Fixed costs editor
- **`risk-matrix-cell.tsx`** - Risk matrix cell display
- **`tasks-in-risk-bucket-modal.tsx`** - Tasks in risk bucket
- **`transaction-log-drawer.tsx`** - Transaction history
- **`project-overview.tsx`** - Safe view for pending members
- **`onboarding-modal.tsx`** - New user onboarding wizard

### Settings Tabs (`components/settings/`)

- **`teams-tab.tsx`** - Team members management
- **`roles-tab.tsx`** - Role management (create, edit, assign)
- **`invites-tab.tsx`** - Invite code management
- **`danger-zone-tab.tsx`** - Delete project (Owner only)

---

## Styling & Theme

### Theme System

Uses CSS custom properties with OKLCH color space for better color accuracy:

```css
:root {
  --background: oklch(0.989 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.656 0.196 237.317);
  --secondary: oklch(0.8 0.02 237.317);
  /* ... */
}

.dark {
  --background: oklch(0.145 0.005 264.052);
  --foreground: oklch(0.949 0.005 264.052);
  /* ... */
}
```

### Tailwind Configuration

- **Dark Mode**: `class` strategy (add `class="dark"` to `<html>`)
- **Custom Colors**: Extended palette with slate-950, primary, destructive
- **Font**: System font stack
- **Spacing**: Default Tailwind scale

### Design Philosophy

- **Professional Dark Mode**: Slate/Blue theme with high contrast
- **Minimalist**: Clean, uncluttered interfaces
- **Accessible**: WCAG AA compliant color contrasts
- **Responsive**: Mobile-first design approach

---

## Environment Variables

### Server (`server/.env`)
```env
MONGODB_URI=mongodb://localhost:27017/kbm-logic-v4
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=kbm-logic.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kbm-logic
VITE_FIREBASE_STORAGE_BUCKET=kbm-logic.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Running the Application

### Quick Start
```powershell
cd kbm-logic-v4
.\start.ps1
```

### Manual Start
```powershell
# Install dependencies
npm run install:all

# Start both servers
npm run dev

# Or separately
npm run dev:server  # Backend on :5000
npm run dev:client  # Frontend on :5173
```

### Prerequisites
- Node.js 18+
- MongoDB running locally or MongoDB Atlas connection string
- Firebase project with Authentication enabled
- Firebase service account JSON file in `server/` directory

---

## Production Readiness

### Current Status
✅ **Production Ready** for local deployment

### Completed Features
- ✅ Authentication (Firebase + MongoDB sync)
- ✅ Project management (Create, Join, Delete)
- ✅ Task management (Kanban board, CRUD)
- ✅ Financial tracking (EVM, S-Curve, Transactions)
- ✅ Risk assessment (5×5 Matrix, Auto-scoring)
- ✅ RBAC (Role-based permissions)
- ✅ Security hardening (Helmet, CORS, Rate Limiting)
- ✅ Input validation (Joi schemas)
- ✅ Error handling (Centralized error handler)
- ✅ Logging (Winston logger)

### Known Limitations
- Drag & Drop on Kanban board (UI ready, logic pending)
- Real-time updates (WebSocket/Socket.io not implemented)
- File uploads (Not implemented)
- Email notifications (Not implemented)
- Advanced reporting (Basic stats only)

---

## Testing Checklist

- [x] User can sign in with Google
- [x] User can sign in with email/password
- [x] New users redirect to onboarding
- [x] Projects list loads from API
- [x] Create project works
- [x] Join project with password works
- [x] Dashboard shows real stats (EVM)
- [x] Tasks load in Kanban board
- [x] Timer starts/stops correctly
- [x] Transactions create successfully
- [x] Settings regenerate invite works
- [x] Settings delete project works
- [x] Risk scores auto-update
- [x] Budget S-curve calculates correctly
- [x] Role import works
- [x] Safe view for pending members works
- [x] Permission checks enforce correctly

---

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live task updates
2. **File Attachments**: Upload files to tasks/projects
3. **Email Notifications**: Notify users of task assignments, deadlines
4. **Advanced Reporting**: Custom reports, exports (PDF, Excel)
5. **Mobile App**: React Native version
6. **API Documentation**: Swagger/OpenAPI spec
7. **Unit Tests**: Jest test suite
8. **E2E Tests**: Playwright/Cypress tests

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Development Team

