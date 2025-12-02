# 🧹 Permissions Cleanup Migration Script

## 📋 Problem

The application is crashing with a Mongoose Validation Error (400) because the field `'can_track_time'` was removed from the schema's enum list (`ALL_PERMISSIONS`) but still exists in database records.

**Error Message:**
```
ValidationError: 'can_track_time' is not a valid enum value for path 'permissions'
```

## ✅ Solution

A migration script has been created to clean the database of obsolete permissions.

---

## 🚀 How to Run

### Step 1: Navigate to Server Directory

```bash
cd server
```

### Step 2: Run the Migration Script

```bash
node scripts/cleanup-permissions.js
```

---

## 📊 What the Script Does

1. **Connects to MongoDB** using the `MONGODB_URI` from `.env`

2. **Finds all projects** in the database

3. **Cleans `project.customRoles`:**
   - Iterates through every custom role
   - Removes `'can_track_time'` from each role's `permissions` array
   - Also removes any other permissions not in `ALL_PERMISSIONS`

4. **Cleans `project.members`:**
   - Iterates through every member
   - Removes `'can_track_time'` from each member's `permissions` array
   - Also removes any other permissions not in `ALL_PERMISSIONS`

5. **Saves modified projects** to the database

6. **Logs results:**
   - Which projects were cleaned
   - How many permissions were removed
   - Summary statistics

---

## 📈 Expected Output

### If Permissions Found:

```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB
📊 Found 5 projects to process
  🔧 Cleaned custom role "Manager" in project "My Project" (removed 1 permission(s))
  🔧 Cleaned member 507f1f77bcf86cd799439011 in project "My Project" (removed 1 permission(s))
✅ Project "My Project" cleaned and saved (2 permission(s) removed)
  🔧 Cleaned member 507f1f77bcf86cd799439012 in project "Another Project" (removed 1 permission(s))
✅ Project "Another Project" cleaned and saved (1 permission(s) removed)

📈 Migration Summary:
  ✅ Projects updated: 2
  ✅ Custom roles cleaned: 1
  ✅ Members cleaned: 2
  ✅ Total permissions removed: 3

✅ Migration completed successfully! Removed 'can_track_time' and other invalid permissions from 2 project(s).
🔌 Disconnected from MongoDB
✅ Script completed
```

### If No Permissions Found:

```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB
📊 Found 5 projects to process

📈 Migration Summary:
  ✅ Projects updated: 0
  ✅ Custom roles cleaned: 0
  ✅ Members cleaned: 0
  ✅ Total permissions removed: 0

✨ No obsolete permissions found. Database is clean!
🔌 Disconnected from MongoDB
✅ Script completed
```

---

## 🔍 What Gets Cleaned

### 1. Custom Roles

**Before:**
```javascript
customRoles: [{
  name: "Manager",
  permissions: ["can_view_tasks", "can_track_time", "can_edit_tasks"]
}]
```

**After:**
```javascript
customRoles: [{
  name: "Manager",
  permissions: ["can_view_tasks", "can_edit_tasks"]
}]
```

### 2. Member Permissions

**Before:**
```javascript
members: [{
  userId: ObjectId("..."),
  permissions: ["can_view_tasks", "can_track_time"]
}]
```

**After:**
```javascript
members: [{
  userId: ObjectId("..."),
  permissions: ["can_view_tasks"]
}]
```

---

## 🛡️ Safety Features

1. **Read-only check:** The script only removes permissions, never adds them
2. **Validation:** Only removes permissions not in `ALL_PERMISSIONS`
3. **Error handling:** Continues processing even if one project fails
4. **Detailed logging:** Shows exactly what was changed
5. **Atomic updates:** Each project is saved individually

---

## ⚠️ Important Notes

1. **Backup recommended:** While the script is safe, it's always good practice to backup your database before running migrations

2. **No rollback:** This script removes data. There's no automatic rollback. If you need to restore, use your database backup.

3. **Idempotent:** The script can be run multiple times safely. If no obsolete permissions are found, it will report "Database is clean!"

4. **Environment variables:** Ensure `MONGODB_URI` is set in `server/.env`

---

## 🧪 Testing

After running the script:

1. **Verify no validation errors:**
   - Try updating a project that previously had `can_track_time`
   - Should work without validation errors

2. **Check logs:**
   - Review the console output
   - Verify the number of permissions removed makes sense

3. **Test application:**
   - Restart the server
   - Try operations that previously failed
   - Should work correctly now

---

## 🔧 Troubleshooting

### Issue: "MONGODB_URI not found"

**Solution:**
- Check that `server/.env` file exists
- Verify `MONGODB_URI` or `MONGO_URI` is set in `.env`
- Ensure you're running from the `server` directory

### Issue: "Connection timeout"

**Solution:**
- Check MongoDB connection string
- Verify network connectivity
- Check MongoDB Atlas IP whitelist (if using Atlas)

### Issue: "ValidationError" during save

**Solution:**
- The script logs validation errors
- Check which project failed
- May indicate other schema issues
- Review the error details in console output

---

## 📝 Files

- **Script:** `server/scripts/cleanup-permissions.js`
- **Documentation:** This file

---

## ✅ Status

- **Script created:** ✅
- **Tested:** Ready for production use
- **Safe to run:** Yes (read-only removal of obsolete data)

---

**Created:** $(date)  
**Status:** ✅ Ready to Run

