# 🚀 How to Start the Project

## 🎯 Easiest Way: Use the Startup Script

**Just run this from the project root:**

```powershell
.\start.ps1
```

This script will:
1. ✅ Install all dependencies (if not already installed)
2. ✅ Create `.env` files with default values
3. ✅ Start both server and client

---

## Manual Setup (Alternative)

### Step 1: Install All Dependencies

From the project root (`kbm-logic-v4`):

```powershell
npm run install:all
```

This installs dependencies for:
- Root workspace
- Server (backend)
- Client (frontend)

### Step 2: Set Up Environment Variables

#### Server Environment (`server/.env`)

Create `server/.env` file with:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/kbm-logic-v4

# Server Port
PORT=5000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# Firebase Admin SDK (Optional - if not using service account file)
# The server will use firebase-service-account.json if it exists
# Otherwise, set these:
FIREBASE_PROJECT_ID=kbm-logic
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@kbm-logic.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_X509_CERT_URL=your-cert-url
```

**Note**: The server already has `firebase-service-account.json`, so Firebase env vars are optional.

#### Client Environment (`client/.env`)

Create `client/.env` file with:

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=AIzaSyAd7TDc3tzlPsBztVnT-7RXD52L94o4FH0
VITE_FIREBASE_AUTH_DOMAIN=kbm-logic.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kbm-logic
VITE_FIREBASE_STORAGE_BUCKET=kbm-logic.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=849449889272
VITE_FIREBASE_APP_ID=1:849449889272:web:ced9009c32f01dbb8a7a0d
VITE_FIREBASE_MEASUREMENT_ID=G-7P371KVDHV
```

**Note**: Firebase config is already set in `client/src/config/firebase.js` with fallback values, so `.env` is optional.

### Step 3: Start MongoDB

Make sure MongoDB is running on your system:

**Option A: Local MongoDB**
```powershell
# If MongoDB is installed as a service, it should start automatically
# Check if it's running:
mongosh --eval "db.version()"
```

**Option B: MongoDB Atlas (Cloud)**
- Update `MONGODB_URI` in `server/.env` with your Atlas connection string

**Option C: Docker**
```powershell
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Step 4: Start Development Servers

From the project root:

```powershell
npm run dev
```

This starts both:
- **Backend Server**: `http://localhost:5000`
- **Frontend Client**: `http://localhost:5173`

### Alternative: Start Separately

**Start Server Only:**
```powershell
npm run dev:server
```

**Start Client Only:**
```powershell
npm run dev:client
```

## Troubleshooting

### PostCSS Error
If you see PostCSS errors, clean and reinstall:

```powershell
cd client
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
cd ..
```

### MongoDB Connection Error
- Check if MongoDB is running: `mongosh --eval "db.version()"`
- Verify `MONGODB_URI` in `server/.env`
- For Atlas, ensure your IP is whitelisted

### Port Already in Use
- Change `PORT` in `server/.env` (default: 5000)
- Change Vite port in `client/vite.config.js` (default: 5173)

### Firebase Errors
- Verify `firebase-service-account.json` exists in `server/`
- Check Firebase project settings in Firebase Console
- Ensure Firebase client config matches your project

## What's Next?

1. Open `http://localhost:5173` in your browser
2. Sign in with Firebase (Google or Email/Password)
3. Create your first project
4. Start tracking tasks and time!

## Project Structure

```
kbm-logic-v4/
├── server/          # Backend API (Express + MongoDB)
├── client/          # Frontend (React + Vite)
└── package.json     # Root workspace config
```

## Available Scripts

- `npm run dev` - Start both server and client
- `npm run dev:server` - Start only backend
- `npm run dev:client` - Start only frontend
- `npm run install:all` - Install all dependencies

