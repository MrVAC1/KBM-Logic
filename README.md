# KBM Logic

A Hybrid Project Management System combining Kanban simplicity with Enterprise Financial Control.

---

## Overview

KBM Logic is a full-stack MERN application designed for teams that need both agile task management (Kanban boards) and sophisticated financial tracking (S-Curve budgeting, Earned Value Management). The system features dynamic risk calculation, role-based access control, and real-time activity tracking.

### Key Features

- **Kanban Task Management** - Visual task boards with drag-and-drop workflow
- **Dynamic Risk Engine** - Auto-adjusting risk scores based on deadlines and budget
- **S-Curve Budgeting** - Planned Value curves with actual cost tracking
- **Access Gateway** - Guest/Pending member states with safe view mode
- **Role-Based Access Control** - Granular permissions per project member
- **Time Tracking** - Logged hours with cost calculation
- **Activity Feed** - Real-time project activity tracking

---

## Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization (budget curves, charts)
- **Firebase Auth** - Authentication
- **React Router** - Navigation
- **Shadcn UI** - Component library

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Firebase Admin** - Token verification
- **bcryptjs** - Password hashing

---

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (local or cloud instance)
- Firebase project (for authentication)

### Installation

1. **Install all dependencies** (root, server, and client):
```bash
npm run install:all
```

2. **Set up environment variables**:

Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/kbm-logic
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
```

### Run Development Servers

**Option 1: Run both server and client together**
```bash
npm run dev
```

**Option 2: Run separately**

Terminal 1 - Server:
```bash
npm run dev:server
```

Terminal 2 - Client:
```bash
npm run dev:client
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

---

## Project Structure

```
kbm-logic-v0.1/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── contexts/       # React contexts
│   │   ├── services/       # API services
│   │   └── lib/            # Utilities
│   └── package.json
├── server/                 # Node.js backend
│   ├── controllers/        # Route handlers
│   ├── models/             # Mongoose schemas
│   ├── services/           # Business logic (Risk, Budget engines)
│   ├── middleware/         # Express middleware
│   ├── routes/             # API routes
│   └── package.json
├── docs/                   # Documentation
│   ├── BUSINESS_LOGIC.md   # Risk & Budget engines
│   ├── DATABASE_SCHEMA.md  # MongoDB schemas
│   └── USER_GUIDE.md       # End-user guide
└── package.json            # Root package.json
```

---

## Documentation

- **[Business Logic](./docs/BUSINESS_LOGIC.md)** - Dynamic Risk Engine, S-Curve Budgeting, Access Gateway
- **[Database Schema](./docs/DATABASE_SCHEMA.md)** - MongoDB models and relationships
- **[User Guide](./docs/USER_GUIDE.md)** - Onboarding, workspace usage, settings

---

## License

Private - All rights reserved

