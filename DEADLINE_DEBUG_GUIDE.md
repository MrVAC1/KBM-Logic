# 🔍 Deadline Update Debugging Guide

## 📋 Problem
User has `can_manage_deadline` permission, but still gets "Failed to update project" error when saving deadline.

## 🔧 Enhanced Logging Added

### Backend Logging (`server/controllers/projectController.js`)

The following detailed logs are now added to help diagnose the issue:

1. **Request Received Log:**
   ```
   [Deadline Update] Request received: { projectId, userId, rawDeadline, deadlineType, isNull, isEmpty }
   ```

2. **Date Parsing Log:**
   ```
   [Deadline Update] Parsed string "..." to: ISO string
   ```

3. **Date Comparison Log:**
   ```
   [Deadline Update] Date comparison: { deadline, createdAt, deadlineTime, createdAtTime, isValid }
   ```

4. **Before Save Log:**
   ```
   [Deadline Update] Project state before save: { deadline, deadlineType, deadlineIsDate, deadlineValue }
   ```

5. **Save Error Log:**
   ```
   [Deadline Update] Save error: { errorName, errorMessage, errorStack, deadlineValue, deadlineType, ... }
   ```

### Frontend Logging (`client/src/pages/workspace/project-info/page.tsx`)

1. **Before Send Log:**
   ```
   [Frontend] Sending deadline update: { originalDeadline, isoString, dateObject }
   ```

2. **Success Log:**
   ```
   [Frontend] Deadline update successful: response.data
   ```

3. **Error Log:**
   ```
   [Frontend] Failed to update deadline: { error, status, statusText, data, message, deadlineSent }
   ```

---

## 🧪 How to Debug

### Step 1: Check Server Logs

After attempting to save the deadline, check the server terminal for:

1. **Look for `[Deadline Update]` logs** - These show the entire flow
2. **Check for error messages** - Look for:
   - `ValidationError` - Schema validation failed
   - `CastError` - Date format cannot be parsed
   - `TypeError` - Unexpected data type

### Step 2: Check Browser Console

1. **Open Developer Tools** (F12)
2. **Go to Console tab**
3. **Look for `[Frontend]` logs** - These show what's being sent
4. **Check Network tab** - Verify the request payload

### Step 3: Common Issues & Solutions

#### Issue 1: CastError - "Cast to Date failed"

**Symptoms:**
- Server log shows: `CastError: Cast to Date failed for value "..." at path "deadline"`

**Cause:**
- Date string format is invalid
- Date is being sent as an object instead of string

**Solution:**
- Frontend now ensures `deadline.toISOString()` is called
- Backend now handles multiple formats and normalizes to Date object

#### Issue 2: ValidationError - "Deadline must be after createdAt"

**Symptoms:**
- Server log shows: `ValidationError: Deadline validation failed`

**Cause:**
- Selected date is before or equal to project creation date

**Solution:**
- Frontend calendar already disables invalid dates
- Backend validation now provides clear Ukrainian error message

#### Issue 3: TypeError - "Cannot read property of undefined"

**Symptoms:**
- Server log shows: `TypeError: Cannot read property 'createdAt' of undefined`

**Cause:**
- Project object is not properly loaded

**Solution:**
- Check that `req.project` is set by middleware
- Verify project exists in database

---

## 📊 Expected Log Flow (Success)

### Backend:
```
[Deadline Update] Request received: { projectId: '...', userId: '...', rawDeadline: '2024-12-31T00:00:00.000Z', deadlineType: 'string', isNull: false, isEmpty: false }
[Deadline Update] Parsed string "2024-12-31T00:00:00.000Z" to: 2024-12-31T00:00:00.000Z
[Deadline Update] Date comparison: { deadline: '2024-12-31T00:00:00.000Z', createdAt: '2024-01-01T00:00:00.000Z', deadlineTime: 1735689600000, createdAtTime: 1704067200000, isValid: true }
[Deadline Update] Deadline validated and normalized: 2024-12-31T00:00:00.000Z
[Deadline Update] Applying update: { before: null, after: 2024-12-31T00:00:00.000Z, afterType: 'object', afterIsDate: true }
[Deadline Update] Project state before save: { deadline: 2024-12-31T00:00:00.000Z, deadlineType: 'object', deadlineIsDate: true, deadlineValue: 'Mon Dec 31 2024 00:00:00 GMT+0000 (UTC)' }
[Deadline Update] Project saved successfully: { deadline: 2024-12-31T00:00:00.000Z, deadlineType: 'object' }
```

### Frontend:
```
[Frontend] Sending deadline update: { originalDeadline: Date, isoString: '2024-12-31T00:00:00.000Z', dateObject: Date }
[Frontend] Deadline update successful: { id: '...', deadline: '2024-12-31T00:00:00.000Z', ... }
```

---

## 📊 Expected Log Flow (Error)

### Backend:
```
[Deadline Update] Request received: { ... }
[Deadline Update] Save error: { errorName: 'ValidationError', errorMessage: '...', ... }
[Deadline Update] Validation error: Deadline must be after project creation date
```

### Frontend:
```
[Frontend] Sending deadline update: { ... }
[Frontend] Failed to update deadline: { error: {...}, status: 400, data: { message: 'Дедлайн не може бути...' }, ... }
```

---

## 🔍 What to Look For

### In Server Logs:

1. **Check `rawDeadline` value:**
   - Should be an ISO string like `"2024-12-31T00:00:00.000Z"`
   - If it's an object `{}`, that's the problem

2. **Check `deadlineType`:**
   - Should be `"string"` (from frontend)
   - If it's `"object"`, the date wasn't stringified

3. **Check `deadlineIsDate` after parsing:**
   - Should be `true` after normalization
   - If `false`, the date parsing failed

4. **Check `errorName` in save error:**
   - `ValidationError` = Schema validation failed
   - `CastError` = Date format invalid
   - `TypeError` = Unexpected data type

### In Browser Console:

1. **Check `isoString` in "Sending deadline update":**
   - Should be a valid ISO 8601 string
   - Format: `YYYY-MM-DDTHH:mm:ss.sssZ`

2. **Check Network tab request payload:**
   - Open Network tab → Find PUT request to `/api/projects/:id`
   - Check Request Payload → `deadline` field
   - Should be a string, not an object

---

## 🛠️ Quick Fixes

### If you see "CastError":

**Problem:** Date format is invalid

**Fix:** Ensure frontend sends ISO string:
```typescript
deadline: deadline ? deadline.toISOString() : null
```

### If you see "ValidationError":

**Problem:** Date validation failed

**Fix:** Check that:
1. Deadline is after `project.createdAt`
2. Dates are normalized to start of day
3. Comparison uses `>` not `>=`

### If you see "TypeError":

**Problem:** Project object is undefined

**Fix:** Check middleware:
```javascript
// Ensure project is loaded by middleware
const project = await Project.findById(projectId);
if (!project) return sendError(res, 'Project not found', 404);
req.project = project;
```

---

## 📝 Next Steps

1. **Run the application** and attempt to save a deadline
2. **Copy the server logs** (all `[Deadline Update]` entries)
3. **Copy the browser console logs** (all `[Frontend]` entries)
4. **Share the logs** for further diagnosis

The enhanced logging will reveal exactly where the issue occurs!

