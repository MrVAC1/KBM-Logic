# Architecture and Setup

## Tech Stack

**KBM Logic v3.0** is built on the **MERN** stack:

- **MongoDB Atlas** - Cloud-hosted NoSQL database
- **Express.js** - Node.js web framework
- **React 18** - Frontend UI library with TypeScript
- **Node.js** - Backend runtime environment

### Frontend Technologies

- **React 18** with TypeScript for type safety
- **Vite** - Modern build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn UI** - Component library built on Radix UI
- **Recharts** - Data visualization for financial charts
- **Firebase Auth** - Authentication service
- **React Router** - Client-side routing

### Backend Technologies

- **Express.js** - RESTful API framework
- **Mongoose** - MongoDB object modeling
- **Firebase Admin SDK** - Token verification
- **bcryptjs** - Password hashing
- **express-rate-limit** - API rate limiting

## Database Architecture

### MongoDB Atlas Connection

The system connects to **MongoDB Atlas** using a connection string stored in the `MONGO_URI` environment variable:

```env
MONGO_URI=mongodb+srv://username:password@cluster0.xxx.mongodb.net/kbm-logic?retryWrites=true&w=majority
```

### Data Separation

The database architecture separates two distinct data types:

1. **Audit Data** - Stored in MongoDB for persistence and historical tracking
   - Projects, Tasks, Transactions, Users
   - Activity logs and audit trails
   - Financial snapshots for EVM calculations

2. **Financial Data** - Calculated on-demand with schedule-aware logic
   - PV (Planned Value) - Calculated from tasks and role rates
   - AC (Actual Cost) - Accrued based on working days only
   - EV (Earned Value) - Based on completed tasks

### Connection Handling

The system uses graceful connection handling:
- Server starts even if MongoDB is unavailable
- Database operations fail gracefully with error logging
- Connection retries handled by Mongoose

## Setup Instructions

### Prerequisites

- **Node.js** 18+ installed
- **MongoDB Atlas** account and cluster
- **Firebase** project for authentication
- Git (for cloning the repository)

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd kbm-logic-v0.1
```

### Step 2: Install Dependencies

Install dependencies for root, server, and client:

```bash
npm run install:all
```

Or install separately:

```bash
# Root dependencies
npm install

# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### Step 3: Environment Configuration

#### Server Environment (`server/.env`)

Create `server/.env` with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster0.xxx.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0

# Firebase Admin SDK (for token verification)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

**Important Notes:**
- `MONGO_URI` must include the database name (`kbm-logic`)
- Firebase private key must be wrapped in quotes and include `\n` for newlines
- `CORS_ORIGIN` should match your frontend URL

#### Client Environment (`client/.env`)

Create `client/.env` with Firebase configuration:

```env
# API Configuration
VITE_API_URL=http://localhost:5000

# Firebase Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Step 4: Firebase Service Account

Place your Firebase service account JSON file at:
```
server/firebase-service-account.json
```

This file is used by the backend for token verification.

### Step 5: Run Development Servers

**Option 1: Run Both Servers Together**

From the root directory:

```bash
npm run dev
```

This starts both the Express backend (port 5000) and Vite frontend (port 5173).

**Option 2: Run Separately**

Terminal 1 - Backend:
```bash
cd server
npm run dev
```

Terminal 2 - Frontend:
```bash
cd client
npm run dev
```

### Step 6: Verify Installation

1. **Backend Health Check:**
   ```
   GET http://localhost:5000/health
   ```
   Should return database connection status.

2. **Frontend:**
   Navigate to `http://localhost:5173`
   You should see the login page.

## Project Structure

```
kbm-logic-v0.1/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/           # Shadcn UI components
│   │   │   ├── settings/     # Settings components
│   │   │   └── modals/       # Modal dialogs
│   │   ├── pages/            # Route pages
│   │   │   ├── workspace/    # Main workspace pages
│   │   │   └── projects/    # Project listing
│   │   ├── contexts/         # React contexts (Auth, Project)
│   │   ├── services/         # API service layer
│   │   ├── lib/              # Utility functions
│   │   └── config/           # Configuration files
│   ├── public/               # Static assets
│   └── package.json
│
├── server/                    # Node.js backend
│   ├── controllers/          # Route handlers
│   ├── models/               # Mongoose schemas
│   ├── services/             # Business logic
│   │   ├── evmEngine.js     # EVM calculations
│   │   ├── budgetEngine.js  # Budget calculations
│   │   └── riskEngine.js    # Risk calculations
│   ├── middleware/           # Express middleware
│   │   ├── authMiddleware.js # Firebase token verification
│   │   ├── rbacMiddleware.js # Role-based access control
│   │   └── errorHandler.js  # Error handling
│   ├── routes/               # API route definitions
│   ├── scripts/              # Migration and utility scripts
│   ├── config/               # Configuration (DB, Firebase)
│   └── package.json
│
├── docs/                     # English documentation
│   └── *.md                  # Documentation files
│
├── docs_ukr/                 # Ukrainian documentation
│   └── *.md                  # Documentation files
│
└── README.md                  # Bilingual landing page
```

## Development Workflow

### Hot Reload

Both frontend and backend support hot reload:
- **Frontend:** Vite HMR (Hot Module Replacement)
- **Backend:** Nodemon watches for file changes

### API Development

The backend API follows RESTful conventions:
- `GET /api/projects/:projectId/tasks` - Fetch tasks
- `POST /api/projects/:projectId/tasks` - Create task
- `PUT /api/tasks/:taskId` - Update task
- `DELETE /api/tasks/:taskId` - Delete task

### Rate Limiting

Rate limiting is configured in `server/index.js`:
- **Development:** 1000 requests per 15 minutes (or disabled for localhost)
- **Production:** 100 requests per 15 minutes

## Troubleshooting

### MongoDB Connection Issues

**Error:** `Failed to connect to MongoDB`

**Solutions:**
1. Verify `MONGO_URI` is correct in `server/.env`
2. Check MongoDB Atlas IP whitelist (allow `0.0.0.0/0` for development)
3. Verify database user has read/write permissions
4. Check network connectivity

### Firebase Authentication Issues

**Error:** `Firebase token verification failed`

**Solutions:**
1. Verify `firebase-service-account.json` exists in `server/`
2. Check Firebase Admin SDK credentials in `.env`
3. Ensure Firebase project ID matches in both frontend and backend

### Port Already in Use

**Error:** `Port 5000 is already in use`

**Solutions:**
1. Change `PORT` in `server/.env` to another port (e.g., 5001)
2. Update `VITE_API_URL` in `client/.env` to match
3. Kill the process using the port: `lsof -ti:5000 | xargs kill`

## Next Steps

After setup, continue reading:
- **[Financial Engine](./02-financial-engine.md)** - Understanding PV, AC, EV calculations
- **[Roles and Permissions](./03-roles-and-permissions.md)** - RBAC system overview
- **[Tasks and Workflow](./04-tasks-and-workflow.md)** - Kanban board and task management
- **[Database Schema](./05-database-schema.md)** - Data models reference

