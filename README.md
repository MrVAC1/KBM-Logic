# KBM Logics v0.0 - Pre-UI-Upgrade State

## Overview

This directory contains the **pre-UI-upgrade stable version** of the KBM Logic project with a clean, flat design.

### Design Philosophy
- ✅ **Flat/Clean Design** - No gradients, no framer-motion animations
- ✅ **Simple Navigation** - Flat list view sidebar, no dropdown menus or collapsible groups
- ✅ **Minimal Styling** - Clean, functional UI without neon badges

## ⚠️ Setup Required

Due to file system encoding issues, you need to run the setup script to complete the installation.

### Step 1: Complete File Copy

Run this PowerShell script from the **parent directory** (верстка):

```powershell
# Navigate to parent directory
cd "C:\Users\Максим\Desktop\МАГА\сайт\верстка"

# Copy remaining files from kbm-logic-v0 (which has all files)
robocopy "kbm-logic-v0\client\src" "kbm-logics-v0.0\client\src" /E /XD node_modules
robocopy "kbm-logic-v0\server" "kbm-logics-v0.0\server" /E /XD node_modules
robocopy "kbm-logic-v0\docs" "kbm-logics-v0.0\docs" /E

# Copy root files
copy "kbm-logic-v0\.gitignore" "kbm-logics-v0.0\"
copy "kbm-logic-v0\start.ps1" "kbm-logics-v0.0\"
```

### Step 2: Install Dependencies

```powershell
cd kbm-logics-v0.0

# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install server dependencies
cd server
npm install
cd ..
```

### Step 3: Run the Project

```powershell
npm run dev
```

Or run separately:

**Terminal 1 - Server:**
```powershell
cd server
npm run dev
```

**Terminal 2 - Client:**
```powershell
cd client
npm run dev
```

## Project Structure

```
kbm-logics-v0.0/
├── client/              # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/  # UI components (simplified)
│   │   ├── pages/       # Page components (flat design)
│   │   ├── contexts/    # React contexts
│   │   ├── services/    # API services
│   │   └── lib/         # Utilities
│   └── package.json
├── server/              # Node.js backend (Express)
│   ├── controllers/     # Route handlers
│   ├── models/          # Mongoose models
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   └── package.json
├── docs/                # Documentation
└── package.json         # Root package.json
```

## Key Changes from v4

| Feature | v0.0 (This) | v4 (Upgraded) |
|---------|-------------|---------------|
| Project Cards | Flat, simple | Gradients, animations |
| Sidebar | Simple list | Dropdown, collapsible |
| Animations | None | framer-motion |
| Design | Clean, minimal | Enhanced, modern |

## What Was Removed

1. **Projects Page** (`client/src/pages/projects/page.tsx`)
   - Removed: `group`, `transition-all`, `hover:border-primary/50`, `hover:shadow-lg`
   - Removed: `group-hover:text-primary transition-colors`
   - Result: Clean, flat project cards

2. **Sidebar** (`client/src/components/app-sidebar.tsx`)
   - Simple list view (no dropdown menus)
   - No collapsible groups
   - Direct navigation links

3. **Dependencies**
   - No framer-motion
   - Only essential packages

## Status

✅ **Ready for setup** - Run the commands above to complete installation.


