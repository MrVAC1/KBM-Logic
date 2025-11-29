# Troubleshooting Guide

## Common Issues and Solutions

---

## 1. PostCSS / Tailwind Errors

### Error: "Cannot find module '../lib/statuses'"
**Cause**: Corrupted `caniuse-lite` package

**Solution**:
```powershell
cd client
npm cache clean --force
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

### Error: "It looks like you're trying to use 'tailwindcss' directly as a PostCSS plugin"
**Cause**: Incorrect PostCSS config syntax

**Solution**: Update `client/postcss.config.js`:
```javascript
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [tailwindcss, autoprefixer],
};
```

### Error: "The `outline-ring/50` class does not exist"
**Cause**: Invalid Tailwind class syntax

**Solution**: Update `client/src/index.css`, replace:
```css
@apply border-border outline-ring/50;
```
With:
```css
@apply border-border;
```

### Styles Not Loading (White Screen)
**Steps**:
1. Clear Vite cache:
   ```powershell
   Remove-Item -Recurse -Force client\node_modules\.vite
   ```
2. Hard refresh browser: `Ctrl+Shift+R`
3. Verify `index.css` is imported in `main.jsx`

---

## 2. Module Not Found Errors

### Error: "Failed to resolve import '@radix-ui/react-progress'"
**Cause**: Missing Radix UI package

**Solution**:
```powershell
npm --prefix client install @radix-ui/react-progress
```

### Error: "Could not resolve 'lodash/isFunction'" (or other lodash errors)
**Cause**: Recharts requires lodash but it's not installed

**Solution**:
```powershell
npm --prefix client install lodash
```

### Error: "Failed to resolve import '@/lib/utils'"
**Cause**: Path alias not configured

**Solution**: Verify `client/vite.config.js` has:
```javascript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
},
```

---

## 3. TypeScript Errors

### Error: "Unexpected token, expected ','" on type annotation
**Cause**: TypeScript syntax in `.jsx` file

**Solution**: Either:
1. Rename file to `.tsx`
2. Or remove type annotations:
   ```javascript
   // Change this:
   function Component({ children }: { children: React.ReactNode }) {}
   
   // To this:
   function Component({ children }) {}
   ```

---

## 4. MongoDB Errors

### Error: "MongoDB connection failed"
**Check**:
1. MongoDB is running: `mongosh --eval "db.version()"`
2. Connection string in `server/.env` is correct
3. For Atlas: IP is whitelisted

### Error: "Duplicate schema index"
**Cause**: Index defined twice (in schema + with `schema.index()`)

**Status**: Warning only, does not affect functionality

---

## 5. Firebase Errors

### Error: "Firebase Admin SDK failed to initialize"
**Check**:
1. `server/firebase-service-account.json` exists
2. File contains valid JSON
3. Project ID matches your Firebase project

### Error: "Invalid Firebase token"
**Check**:
1. User is logged in on frontend
2. Token is stored in localStorage as `firebaseToken`
3. Token is sent in `Authorization: Bearer <token>` header

### Error: "auth/configuration-not-found"
**Check**:
1. Firebase config in `client/src/config/firebase.js` is correct
2. Authentication providers enabled in Firebase Console

---

## 6. Server Errors

### Port Already in Use
**Solution**:
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill process
taskkill /PID <pid> /F

# Or change port in server/.env
PORT=5001
```

### CORS Errors
**Check** `server/.env`:
```env
CORS_ORIGIN=http://localhost:5173
```

---

## 7. Build Errors

### Clean Build
```powershell
# Client
cd client
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force node_modules\.vite
Remove-Item -Force package-lock.json
npm install

# Server
cd ..\server
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

### Full Reset
```powershell
cd kbm-logic-v4
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force client\node_modules
Remove-Item -Recurse -Force server\node_modules
Remove-Item -Force package-lock.json
Remove-Item -Force client\package-lock.json
Remove-Item -Force server\package-lock.json
npm run install:all
```

---

## Quick Fix Scripts

### Clear Vite Cache
```powershell
# From project root
.\clear-cache.ps1
```

### Fix PostCSS
```powershell
# From project root
.\fix-postcss.ps1
```

### Fix Tailwind (in client/)
```powershell
cd client
.\fix-tailwind.ps1
```

---

## Getting Help

If issues persist:
1. Check browser console for errors (F12)
2. Check server logs for errors
3. Verify all environment variables are set
4. Ensure MongoDB is running
5. Ensure Firebase Auth is enabled in console


