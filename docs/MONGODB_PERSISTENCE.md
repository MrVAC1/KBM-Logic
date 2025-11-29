8ш# MongoDB Persistence & Data Replication

## Overview

This document describes how all important data is persisted to MongoDB and how Firebase data is replicated to MongoDB.

## Core Principle

**MongoDB is the source of truth for all business data.** All important data (user data, project data, tasks, transactions, payment history) is stored in MongoDB.

## Data Flow Architecture

```
┌─────────────────┐
│  Firebase Auth  │ ──┐
└─────────────────┘   │
                      │
┌─────────────────┐   │    ┌──────────────────┐
│  Client (React) │ ──┼───▶│  Express API     │
└─────────────────┘   │    └──────────────────┘
                      │              │
                      │              ▼
                      │    ┌──────────────────┐
                      └───▶│  MongoDB         │ ◀─── All Business Data
                           │  (Source of Truth)│
                           └──────────────────┘
```

## Data Categories

### 1. User Data

**Source:** Firebase Authentication  
**Destination:** MongoDB `users` collection  
**Sync Mechanism:** Automatic sync on login/registration via `/api/auth/sync`

**MongoDB Schema:**
```javascript
{
  uid: String,              // Firebase UID (unique)
  email: String,
  displayName: String,
  avatar: String,
  role: 'Pending' | 'User' | 'Admin',
  profile: {
    bio: String,
    location: String
  },
  emailVerified: Boolean,
  phoneNumber: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Sync Process:**
- User authenticates via Firebase Auth
- Frontend calls `/api/auth/sync` with Firebase token
- Backend extracts user data from Firebase token
- `syncUserToMongo()` service ensures data is in MongoDB
- All user profile updates are synced to MongoDB

### 2. Project Data

**Source:** Direct API calls (no Firebase)  
**Destination:** MongoDB `projects` collection  
**Persistence:** Immediate write to MongoDB

**MongoDB Schema:**
```javascript
{
  name: String,
  description: String,
  passwordHash: String,
  ownerId: ObjectId (ref: User),
  members: [{
    userId: ObjectId,
    role: String,
    roleId: ObjectId,
    hourlyRate: Number,
    joinedAt: Date
  }],
  roles: [{
    name: String,
    color: String,
    hierarchy: Number,
    permissions: [String]
  }],
  fixedCosts: [{
    title: String,
    amount: Number,
    frequency: String,
    currency: String
  }],
  inviteCode: String,
  isDeleted: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Persistence:**
- All project operations (create, update, delete) write directly to MongoDB
- Operations are logged via `logDataOperation()` for audit trail
- No Firebase replication needed (MongoDB is primary)

### 3. Task Data

**Source:** Direct API calls  
**Destination:** MongoDB `tasks` collection  
**Persistence:** Immediate write to MongoDB

**MongoDB Schema:**
```javascript
{
  projectId: ObjectId (ref: Project),
  title: String,
  description: String,
  status: 'Todo' | 'In Progress' | 'Review' | 'Done',
  priority: 'Low' | 'Medium' | 'High' | 'Critical',
  complexity: 'Low' | 'Med' | 'High',
  assignees: [ObjectId (ref: User)],
  deadline: Date,
  timeLogs: [{
    userId: ObjectId,
    startTime: Date,
    endTime: Date,
    duration: Number (seconds),
    description: String
  }],
  risk: {
    probability: Number (1-5),
    impact: Number (1-5),
    auto_score: Number,
    isAutoAdjusted: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Persistence:**
- All task operations write directly to MongoDB
- Time tracking data is stored in MongoDB
- Risk calculations are persisted to MongoDB

### 4. Transaction/Payment History Data

**Source:** Direct API calls  
**Destination:** MongoDB `transactions` collection  
**Persistence:** Immediate write to MongoDB

**MongoDB Schema:**
```javascript
{
  projectId: ObjectId (ref: Project),
  amount: Number,
  type: '+' | '-',
  source: String,
  date: Date (immutable),
  authorId: ObjectId (ref: User),
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Persistence:**
- All financial transactions are stored in MongoDB
- Payment history is maintained in MongoDB
- Transaction dates are immutable for audit compliance

## Sync Services

### `mongoSync.js`

Central service for ensuring MongoDB persistence:

- **`syncUserToMongo(firebaseUser)`** - Syncs Firebase Auth data to MongoDB
- **`ensureProjectInMongo(projectData)`** - Verifies project exists in MongoDB
- **`ensureTaskInMongo(taskData)`** - Verifies task exists in MongoDB
- **`ensureTransactionInMongo(transactionData)`** - Verifies transaction exists in MongoDB
- **`logDataOperation(operation, collection, documentId, userId, metadata)`** - Audit logging
- **`verifyDataIntegrity(projectId)`** - Validates data consistency

### `mongoPersistence.js` Middleware

Middleware for automatic persistence logging:

- **`ensureMongoCreate(collectionName)`** - Logs create operations
- **`ensureMongoUpdate(collectionName)`** - Logs update operations
- **`ensureMongoDelete(collectionName)`** - Logs delete operations
- **`ensureMongoPersistence(collectionName)`** - General persistence middleware

## Implementation Details

### User Sync Flow

1. User logs in/registers via Firebase Auth
2. Frontend receives Firebase token
3. Frontend calls `/api/auth/sync` with token
4. Backend middleware (`authMiddleware.js`) verifies token and extracts user data
5. `syncUser()` controller calls `syncUserToMongo()`
6. User data is created/updated in MongoDB
7. Operation is logged via `logDataOperation()`

### Project/Task/Transaction Flow

1. Client makes API request (create/update/delete)
2. Request authenticated via Firebase token
3. Controller processes request
4. Data written directly to MongoDB
5. Operation logged via `logDataOperation()`
6. Response includes `_persistedToMongo: true` flag

## Audit Logging

All important data operations are logged with:

- **Operation type:** create, update, delete, sync
- **Collection name:** users, projects, tasks, transactions
- **Document ID:** MongoDB document ID
- **User ID:** Who performed the operation
- **Metadata:** Additional context (project ID, changes made, etc.)

## Data Integrity

### Verification

Use `verifyDataIntegrity(projectId)` to check:

- All project members exist in MongoDB
- All tasks reference valid projects
- All transactions reference valid projects
- All user references are valid

### Consistency Checks

- User IDs in projects must exist in `users` collection
- Project IDs in tasks must exist in `projects` collection
- Project IDs in transactions must exist in `projects` collection
- All foreign key relationships are maintained

## Firebase Replication Strategy

### Current Implementation

- **Firebase Auth:** Used only for authentication
- **User Data:** Synced from Firebase Auth to MongoDB on every login
- **No Firestore/Realtime DB:** All business data is in MongoDB only

### Future Considerations

If Firebase Firestore or Realtime Database is added:

1. Create Firebase listeners for data changes
2. Replicate all writes to MongoDB via `mongoSync` service
3. MongoDB remains source of truth
4. Firebase becomes read cache (optional)

## Best Practices

1. **Always write to MongoDB first** - MongoDB is the source of truth
2. **Log all operations** - Use `logDataOperation()` for audit trail
3. **Verify data integrity** - Run `verifyDataIntegrity()` periodically
4. **Handle sync failures** - Retry logic for Firebase-to-MongoDB sync
5. **Monitor sync status** - Track sync success/failure rates

## Error Handling

### Sync Failures

If Firebase-to-MongoDB sync fails:

1. Error is logged via `logger.error()`
2. User receives error response
3. Operation can be retried
4. No data loss (Firebase Auth data remains in Firebase)

### MongoDB Write Failures

If MongoDB write fails:

1. Transaction is rolled back (if applicable)
2. Error is logged
3. User receives error response
4. Operation must be retried by client

## Monitoring

### Key Metrics

- MongoDB write success rate
- Firebase sync success rate
- Data integrity check results
- Operation audit log volume

### Alerts

- MongoDB connection failures
- Sync failures exceeding threshold
- Data integrity violations
- Missing foreign key references

## Summary

✅ **All user data** is synced from Firebase Auth to MongoDB  
✅ **All project data** is stored in MongoDB  
✅ **All task data** is stored in MongoDB  
✅ **All transaction/payment data** is stored in MongoDB  
✅ **All operations are logged** for audit trail  
✅ **MongoDB is the source of truth** for all business data  
✅ **Firebase is used only for authentication** - data is replicated to MongoDB

