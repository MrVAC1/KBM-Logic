# MongoDB Atlas Setup Instructions

## Quick Start

### Step 1: Create `.env` File

**⚠️ CRITICAL:** Your current `.env` file is missing:
1. Database name in URI (currently connects to `test` database)
2. Required Atlas parameters (`retryWrites=true&w=majority`)

Create or update the file named `.env` in the `server/` directory with the following content:

```env
MONGODB_URI=mongodb+srv://MrVAC:bOvw1g9nyjeyu0AL@cluster0.bj58rji.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

**⚠️ Current Issue:** Your URI is missing:
- Database name: `/kbm-logic` (add before `?`)
- Parameters: `retryWrites=true&w=majority` (add after database name)

**Correct Format:**
```
mongodb+srv://USER:PASS@CLUSTER.mongodb.net/DATABASE_NAME?retryWrites=true&w=majority&appName=Cluster0
                                                      ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                      Required!         Required for Atlas!
```

**Quick Fix:** Update your `server/.env` file:
1. Add `/kbm-logic` after `.net` and before `?`
2. Add `retryWrites=true&w=majority&` after the database name

**Template:** See `ENV_FILE_TEMPLATE.txt` for the complete template.

**Important Notes:**
- The connection string MUST include the database name: `kbm-logic`
- Atlas-specific parameters are REQUIRED: `retryWrites=true&w=majority`
- Never commit this file to version control (it should be in `.gitignore`)

### Step 2: Verify Connection

Run the connection test script:

```bash
cd server
node scripts/test-atlas-connection.js
```

Expected output:
```
✅ Connection Successful!
   Host: cluster0-shard-00-00.bj58rji.mongodb.net
   Database: kbm-logic
```

### Step 3: Run Full Security Audit

```bash
cd server
node scripts/atlas-migration-audit.js
```

This will verify:
- ✅ Environment variables are set correctly
- ✅ Connection to Atlas is successful
- ✅ No local MongoDB fallbacks in code
- ✅ No hardcoded credentials

### Step 4: Start the Server

```bash
cd server
npm start
```

Check the logs for:
```
✅ MongoDB Connected: cluster0-shard-00-00.bj58rji.mongodb.net
✅ Database: kbm-logic
```

---

## MongoDB Atlas Configuration Checklist

### Network Access
- [ ] Your IP address is whitelisted in Atlas Network Access
- [ ] For development, you can temporarily use `0.0.0.0/0` (allow all IPs)
- [ ] For production, use specific IP addresses only

### Database User
- [ ] Database user `MrVAC` exists in Atlas
- [ ] User has appropriate permissions (read/write to `kbm-logic` database)
- [ ] Password is correct: `bOvw1g9nyjeyu0AL`

### Database
- [ ] Database name: `kbm-logic`
- [ ] Database exists in Atlas cluster

---

## Troubleshooting

### Error: "MONGODB_URI is not set"
**Solution:** Create `server/.env` file with the connection string.

### Error: "authentication failed"
**Solution:** 
- Verify username and password in connection string
- Check database user exists in Atlas
- Verify user has permissions for the database

### Error: "ENOTFOUND" or "getaddrinfo"
**Solution:**
- Check internet connection
- Verify cluster hostname is correct
- Check if IP address is whitelisted in Atlas Network Access

### Error: "timeout"
**Solution:**
- Check if IP address is whitelisted in Atlas Network Access
- Verify firewall settings
- Check network connectivity

---

## Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority&appName=<appName>
```

**Your Connection String:**
```
mongodb+srv://MrVAC:bOvw1g9nyjeyu0AL@cluster0.bj58rji.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0
```

**Components:**
- `MrVAC` - Username
- `bOvw1g9nyjeyu0AL` - Password
- `cluster0.bj58rji.mongodb.net` - Cluster hostname
- `kbm-logic` - Database name
- `retryWrites=true` - Enable retryable writes (required for Atlas)
- `w=majority` - Write concern (required for replica sets)
- `appName=Cluster0` - Application name

---

## Security Best Practices

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use different credentials** for development/staging/production
3. **Rotate credentials** if exposed or compromised
4. **Use IP whitelisting** - Restrict access to known IP addresses
5. **Use least-privilege** - Database user should have minimal required permissions
6. **Monitor access logs** - Regularly check Atlas access logs for suspicious activity

---

## Files Modified for Atlas Migration

All files have been updated to:
- ✅ Require `MONGODB_URI` environment variable (no local fallback)
- ✅ Use Atlas-optimized connection options
- ✅ Warn if local MongoDB is detected
- ✅ Support `mongodb+srv://` connection strings

**Updated Files:**
- `server/config/db.js`
- `server/scripts/seed-demo.js`
- `server/scripts/seed-scenarios.js`
- `server/scripts/debug-ev.js`
- `server/scripts/verify-demo.js`
- `server/seed.js`

**New Files:**
- `server/scripts/test-atlas-connection.js` - Connection test script
- `server/scripts/atlas-migration-audit.js` - Security audit script

---

## Verification Commands

```bash
# Test connection
node server/scripts/test-atlas-connection.js

# Run full audit
node server/scripts/atlas-migration-audit.js

# Check server health
curl http://localhost:5000/health

# Check API health
curl http://localhost:5000/api/health
```

---

## Support

If you encounter issues:
1. Check the audit report: `ATLAS_MIGRATION_AUDIT_REPORT.md`
2. Run the connection test: `node server/scripts/test-atlas-connection.js`
3. Check MongoDB Atlas dashboard for connection logs
4. Verify Network Access settings in Atlas

