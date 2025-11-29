# KBM Logic v4 - Project Documentation

## Overview

KBM Logic is a full-stack project management application built with the MERN stack (MongoDB, Express, React, Node.js). It features task management with Kanban boards, financial tracking with EVM (Earned Value Management), risk assessment, and team collaboration.

## Architecture

```
kbm-logic-v4/
├── server/                 # Backend (Node.js + Express + MongoDB)
│   ├── config/             # Database & Firebase configuration
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Auth, RBAC, Validation
│   ├── models/             # Mongoose schemas (User, Project, Task, Transaction)
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic engines
│   └── utils/              # Helper functions
├── client/                 # Frontend (React + Vite + Tailwind)
│   └── src/
│       ├── components/     # UI components (70+ files)
│       │   ├── ui/         # Reusable UI primitives (Button, Card, Dialog...)
│       │   └── settings/   # Settings page tabs
│       ├── pages/          # Page components
│       ├── contexts/       # React contexts (Auth)
│       ├── services/       # API client
│       ├── config/         # Firebase config
│       └── lib/            # Utilities
├── docs/                   # Documentation
└── package.json            # Root workspace config
```

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK
- **Security**: Helmet, CORS, express-mongo-sanitize, express-rate-limit
- **Validation**: Joi
- **Password Hashing**: bcryptjs

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom theme
- **UI Components**: Radix UI primitives
- **Routing**: React Router DOM
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Notifications**: Sonner (toast)
- **Authentication**: Firebase Client SDK

## Core Features

### 1. Authentication
- Firebase Authentication (Email/Password + Google Sign-In)
- Auto token refresh on auth state change
- User sync to MongoDB on login
- Protected routes with auth check

### 2. Project Management
- Create projects with name, description, and access password
- Join projects using invite code + password
- Project members with roles (Owner, Admin, Member)
- Soft delete with restore capability

### 3. Task Management (Kanban)
- Task statuses: Todo → In Progress → Review → Done
- Priority levels: Low, Medium, High, Critical
- Complexity: Low, Medium, High
- Assignees (multi-select from project members)
- Deadline tracking
- Drag-and-drop board (UI ready)

### 4. Time Tracking
- Start/stop timer on tasks
- Time logs with duration calculation
- Permission-based (`can_track_time`)

### 5. Financial Management
- Transaction log (+/- funds)
- Fixed costs (salaries, overhead) - monthly/weekly/daily
- Budget dashboard with charts
- Planned vs Actual cost comparison

### 6. Risk Assessment
- 5x5 Risk Matrix (Probability × Impact)
- Auto-scoring based on:
  - Deadline proximity (< 2 days = higher probability)
  - Budget overrun (> 100% = higher probability)
- Visual risk matrix with task counts

### 7. Role-Based Access Control (RBAC)
Permissions per member:
- `can_track_time` - Start/stop timer
- `can_edit_budget` - Create transactions
- `can_manage_roles` - Edit member roles
- `can_invite_users` - Regenerate invite links
- `can_delete_tasks` - Delete tasks
- `can_edit_project` - Edit project settings

Owner has all permissions (locked).

## Business Logic Services

### Budget Engine (`server/services/budgetEngine.js`)
Calculates project financials using S-Curve:

**Planned Value (PV)**:
- Based on task deadlines and estimated hours
- Includes fixed costs (salaries, overhead)
- S-Curve distribution over time

**Actual Cost (AC)**:
- Time logs × hourly rate
- Transactions (+/-)

### Risk Engine (`server/services/riskEngine.js`)
Auto-updates risk scores:
- Checks deadline proximity
- Checks budget status
- Calculates: `risk_score = probability × impact`
- Triggers on task update

## Database Models

### User
```javascript
{
  uid: String,           // Firebase UID
  email: String,
  displayName: String,
  avatar: String,
  role: 'Pending' | 'User' | 'Admin',
  profile: {
    bio: String,
    location: String
  }
}
```

### Project
```javascript
{
  name: String,
  description: String,
  passwordHash: String,  // bcrypt
  ownerId: ObjectId,
  members: [{
    userId: ObjectId,
    role: String,
    permissions: Object,
    joinedAt: Date
  }],
  fixedCosts: [{
    title: String,
    amount: Number,
    frequency: 'monthly' | 'weekly' | 'daily',
    currency: String
  }],
  inviteCode: String,
  isDeleted: Boolean
}
```

### Task
```javascript
{
  title: String,
  description: String,
  project: ObjectId,
  status: 'Todo' | 'In Progress' | 'Review' | 'Done',
  priority: 'Low' | 'Medium' | 'High' | 'Critical',
  complexity: 'Low' | 'Med' | 'High',
  assignees: [ObjectId],
  deadline: Date,
  timeLogs: [{
    userId: ObjectId,
    startTime: Date,
    endTime: Date,
    duration: Number
  }],
  risk: {
    probability: Number,  // 1-5
    impact: Number,       // 1-5
    auto_score: Number
  },
  createdBy: ObjectId
}
```

### Transaction
```javascript
{
  project: ObjectId,
  amount: Number,
  type: '+' | '-',
  source: String,
  date: Date,           // Immutable
  description: String,
  authorId: ObjectId
}
```

## API Endpoints

Base URL: `http://localhost:5000/api`

All requests require: `Authorization: Bearer <firebase_token>`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/sync` | Sync Firebase user to MongoDB |

### Projects
| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/projects` | Create project | Authenticated |
| GET | `/projects` | Get my projects | Authenticated |
| GET | `/projects/:id` | Get project details | Member |
| POST | `/projects/join` | Join with password | Authenticated |
| PUT | `/projects/:id` | Update project | `can_edit_project` |
| POST | `/projects/:id/regenerate-invite` | New invite code | `can_invite_users` |
| DELETE | `/projects/:id` | Soft delete | Owner only |

### Tasks
| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/projects/:id/tasks` | Get project tasks | Member |
| POST | `/projects/:id/tasks` | Create task | `can_edit_project` |
| PUT | `/tasks/:id` | Update task | `can_edit_project` |
| DELETE | `/tasks/:id` | Delete task | `can_delete_tasks` |
| POST | `/tasks/:id/start-timer` | Start tracking | `can_track_time` |
| POST | `/tasks/:id/stop-timer` | Stop tracking | `can_track_time` |

### Financials
| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/projects/:id/stats` | Dashboard stats (EVM) | Member |
| GET | `/projects/:id/transactions` | Get transactions | Member |
| POST | `/projects/:id/transactions` | Create transaction | `can_edit_budget` |

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "stack": "..." // Development only
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (missing permission)
- `404` - Not Found
- `500` - Server Error

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing page |
| Login | `/login` | Firebase auth (Email + Google) |
| Onboarding | `/onboarding` | New user setup |
| Projects | `/projects` | Project portfolio |
| Financial | `/workspace/financial` | Budget dashboard |
| Kanban | `/workspace/kanban` | Task board |
| Risks | `/workspace/risks` | Risk matrix |
| Settings | `/workspace/settings` | Project settings |

## UI Components

The project includes 70+ UI components:

**Core UI** (`components/ui/`):
- Button, Card, Dialog, Input, Select, Tabs
- Toast, Tooltip, Dropdown, Popover
- Progress, Badge, Avatar, Separator
- And many more...

**Feature Components**:
- `app-sidebar.tsx` - Navigation sidebar
- `create-project-modal.tsx` - Project creation
- `create-task-modal.tsx` - Task creation
- `task-detail-modal.tsx` - Task editing + timer
- `manage-funds-modal.tsx` - Transactions
- `budget-breakdown-modal.tsx` - Cost details
- `fixed-costs-modal.tsx` - Fixed costs editor
- `risk-matrix-cell.tsx` - Risk matrix display
- `transaction-log-drawer.tsx` - Transaction history

**Settings Tabs** (`components/settings/`):
- `teams-tab.tsx` - Team members
- `roles-tab.tsx` - Role management
- `invites-tab.tsx` - Invite codes
- `danger-zone-tab.tsx` - Delete project

## Styling

### Theme System
Uses CSS custom properties with OKLCH color space:

```css
:root {
  --background: oklch(0.989 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.656 0.196 237.317);
  /* ... */
}

.dark {
  --background: oklch(0.145 0.005 264.052);
  --foreground: oklch(0.949 0.005 264.052);
  /* ... */
}
```

### Dark Mode
- Enabled via `darkMode: 'class'` in Tailwind config
- Add `class="dark"` to `<html>` element
- All components support dark mode

## Security Features

1. **Helmet** - HTTP security headers
2. **CORS** - Configured for frontend origin
3. **Rate Limiting** - 100 requests per 15 minutes
4. **Input Sanitization** - express-mongo-sanitize
5. **Firebase Token Verification** - All protected routes
6. **RBAC** - Permission checks on sensitive operations
7. **Password Hashing** - bcrypt for project passwords

## Environment Variables

### Server (`server/.env`)
```env
MONGODB_URI=mongodb://localhost:27017/kbm-logic-v4
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=kbm-logic.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kbm-logic
```

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
- MongoDB running locally or MongoDB Atlas
- Firebase project with Authentication enabled

## Testing Checklist

- [ ] User can sign in with Google
- [ ] User can sign in with email/password
- [ ] New users redirect to onboarding
- [ ] Projects list loads from API
- [ ] Create project works
- [ ] Join project with password works
- [ ] Dashboard shows real stats
- [ ] Tasks load in Kanban board
- [ ] Timer starts/stops correctly
- [ ] Transactions create successfully
- [ ] Settings regenerate invite works
- [ ] Settings delete project works
- [ ] Risk scores auto-update
- [ ] Budget S-curve calculates correctly


