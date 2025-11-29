# API Reference

Base URL: `http://localhost:5000/api`

All endpoints require authentication via Firebase JWT token in the `Authorization` header:
```
Authorization: Bearer <firebase-token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

## Authentication Endpoints

### Sync User
Sync Firebase Auth user to MongoDB.

**POST** `/auth/sync`

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "mongodb_id",
      "uid": "firebase_uid",
      "email": "user@example.com",
      "displayName": "John Doe",
      "avatar": "https://...",
      "role": "User"
    },
    "synced": true,
    "source": "firebase_auth",
    "destination": "mongodb"
  }
}
```

---

## Project Endpoints

### Get My Projects
Get all projects where the user is owner or member.

**GET** `/projects`

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "project_id",
      "name": "Project Name",
      "description": "Project description",
      "ownerId": { "_id": "...", "uid": "...", "displayName": "..." },
      "members": [...],
      "isOwner": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Project
Create a new project. Creator is automatically added as Owner.

**POST** `/projects`

**Headers**: `Authorization: Bearer <token>`

**Body**:
```json
{
  "name": "Project Name",
  "description": "Project description",
  "password": "access_password",
  "fixedCosts": [
    {
      "title": "Server Hosting",
      "amount": 200,
      "frequency": "monthly",
      "currency": "USD"
    }
  ],
  "importRolesFrom": "source_project_id" // Optional: import roles from another project
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "project_id",
    "name": "Project Name",
    "description": "Project description",
    "inviteCode": "generated_code",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "ownerId": "user_id",
    "members": [
      {
        "userId": "user_id",
        "roleName": "Owner",
        "permissions": ["can_view_dashboard", ...],
        "joinedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "_persistedToMongo": true
  }
}
```

### Get Project Details
Get project details. Returns "Safe View" for Guest/Pending users.

**GET** `/projects/:projectId`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`

**Response (Full Access)**:
```json
{
  "success": true,
  "data": {
    "id": "project_id",
    "name": "Project Name",
    "description": "Project description",
    "inviteCode": "code",
    "fixedCosts": [...],
    "roles": [
      {
        "name": "Admin",
        "permissions": [...]
      }
    ],
    "members": [...],
    "owner": {
      "name": "Owner Name",
      "avatar": "https://..."
    },
    "currentUserAccess": {
      "role": "Admin",
      "permissions": ["can_view_dashboard", ...],
      "isOwner": false,
      "isPending": false
    }
  }
}
```

**Response (Safe View - Guest/Pending)**:
```json
{
  "success": true,
  "data": {
    "id": "project_id",
    "name": "Project Name",
    "description": "Project description",
    "status": "Active",
    "role": "Guest",
    "isSafeView": true,
    "owner": {
      "name": "Owner Name",
      "avatar": "https://..."
    },
    "currentUserAccess": {
      "role": "Guest",
      "permissions": [],
      "isOwner": false,
      "isPending": true
    }
  }
}
```

### Join Project
Join a project using project ID and password. New members get "Guest" role with no permissions.

**POST** `/projects/join`

**Headers**: `Authorization: Bearer <token>`

**Body**:
```json
{
  "projectId": "project_id",
  "password": "access_password"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Joined project successfully. Please wait for the Project Manager to assign you a role.",
    "project": {
      "id": "project_id",
      "name": "Project Name"
    }
  }
}
```

### Update Project
Update project details (name, description, fixed costs).

**PUT** `/projects/:projectId`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_manage_settings')`

**Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "fixedCosts": [...]
}
```

### Delete Project
Delete a project (soft delete: sets `isDeleted: true`).

**DELETE** `/projects/:projectId`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_delete_project')`

### Regenerate Invite Code
Generate a new invite code for the project.

**POST** `/projects/:projectId/regenerate-invite`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_invite_users')`

**Response**:
```json
{
  "success": true,
  "data": {
    "inviteCode": "new_generated_code"
  }
}
```

### Get Project Roles
Get role definitions from a project (for import). Owner-only.

**GET** `/projects/:projectId/roles`

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "name": "Admin",
        "permissions": ["can_view_dashboard", ...]
      },
      {
        "name": "PM",
        "permissions": [...]
      }
    ],
    "projectName": "Project Name"
  }
}
```

### Update Member Role
Update a member's role and permissions.

**PUT** `/projects/:projectId/members/:memberId/role`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requireRoleManagement`

**Body**:
```json
{
  "roleName": "PM",
  "permissions": ["can_view_dashboard", "can_create_tasks", ...] // Optional: custom permissions
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Member role updated successfully",
    "member": {
      "userId": "user_id",
      "roleName": "PM",
      "permissions": [...]
    },
    "newRole": {
      "name": "PM",
      "permissions": [...]
    }
  }
}
```

---

## Task Endpoints

### Get Project Tasks
Get all tasks for a project.

**GET** `/projects/:projectId/tasks`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_view_tasks')`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "task_id",
      "title": "Task Title",
      "description": "Task description",
      "status": "In Progress",
      "priority": "High",
      "complexity": "Med",
      "assignees": [
        {
          "_id": "user_id",
          "displayName": "John Doe",
          "email": "john@example.com",
          "avatar": "https://..."
        }
      ],
      "deadline": "2024-01-15T00:00:00.000Z",
      "timeLogs": [...],
      "risk": {
        "probability": 3,
        "impact": 4,
        "auto_score": 12,
        "isAutoAdjusted": true,
        "autoAdjustReason": "Deadline approaching (< 2 days)"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Task
Create a new task.

**POST** `/projects/:projectId/tasks`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_create_tasks')`

**Body**:
```json
{
  "title": "Task Title",
  "description": "Task description",
  "status": "Todo",
  "priority": "High",
  "complexity": "Med",
  "assignees": ["user_id_1", "user_id_2"],
  "deadline": "2024-01-15T00:00:00.000Z",
  "risk": {
    "probability": 2,
    "impact": 3
  }
}
```

**Response**: Task object with populated assignees

### Update Task
Update task details. Risk is automatically recalculated.

**PUT** `/tasks/:taskId`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_edit_tasks')`

**Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "status": "In Progress",
  "priority": "Critical",
  "assignees": ["user_id"],
  "deadline": "2024-01-20T00:00:00.000Z"
}
```

**Response**: Updated task object

### Delete Task
Delete a task.

**DELETE** `/tasks/:taskId`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_delete_tasks')`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Task deleted successfully",
    "_persistedToMongo": true
  }
}
```

### Start Timer
Start time tracking for a task.

**POST** `/tasks/:taskId/start-timer`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_track_time')`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Timer started",
    "timeLog": {
      "userId": "user_id",
      "startTime": "2024-01-01T10:00:00.000Z",
      "duration": 0
    }
  }
}
```

### Stop Timer
Stop time tracking and save duration.

**POST** `/tasks/:taskId/stop-timer`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_track_time')`

**Body** (optional):
```json
{
  "description": "Worked on feature implementation"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Timer stopped",
    "timeLog": {
      "userId": "user_id",
      "startTime": "2024-01-01T10:00:00.000Z",
      "endTime": "2024-01-01T12:30:00.000Z",
      "duration": 9000, // seconds
      "description": "Worked on feature implementation"
    }
  }
}
```

---

## Financial Endpoints

### Get Dashboard Stats
Get EVM statistics (Planned Value S-Curve, Actual Cost, transactions, task summary).

**GET** `/projects/:projectId/stats`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_view_financial')`

**Response**:
```json
{
  "success": true,
  "data": {
    "actualCost": 15000,
    "plannedValueCurve": [
      {
        "date": "2024-01-01",
        "plannedValue": 1000
      },
      {
        "date": "2024-01-02",
        "plannedValue": 2500
      }
      // ... S-Curve data points
    ],
    "transactions": [
      {
        "_id": "transaction_id",
        "amount": 500,
        "type": "+",
        "source": "Client Payment",
        "date": "2024-01-01T00:00:00.000Z",
        "authorId": {
          "displayName": "John Doe"
        }
      }
    ],
    "tasksByStatus": {
      "Todo": 5,
      "In Progress": 3,
      "Review": 2,
      "Done": 10
    },
    "totalTasks": 20
  }
}
```

### Get Transactions
Get all transactions for a project.

**GET** `/projects/:projectId/transactions`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_view_financial')`

**Query Parameters**:
- `sort`: `asc` or `desc` (default: `desc`)
- `limit`: Number (default: all)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "transaction_id",
      "amount": 500,
      "type": "+",
      "source": "Client Payment",
      "date": "2024-01-01T00:00:00.000Z",
      "description": "Q1 payment received",
      "authorId": {
        "_id": "user_id",
        "displayName": "John Doe",
        "email": "john@example.com"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Transaction
Create a manual transaction (income or expense).

**POST** `/projects/:projectId/transactions`

**Headers**: `Authorization: Bearer <token>`

**Middleware**: `checkProjectMember`, `requirePermission('can_edit_budget')`

**Body**:
```json
{
  "amount": 500,
  "type": "+", // "+" for income, "-" for expense
  "source": "Client Payment",
  "date": "2024-01-01T00:00:00.000Z", // Optional: defaults to now
  "description": "Q1 payment received"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "transaction_id",
    "projectId": "project_id",
    "amount": 500,
    "type": "+",
    "source": "Client Payment",
    "date": "2024-01-01T00:00:00.000Z",
    "description": "Q1 payment received",
    "authorId": {
      "_id": "user_id",
      "displayName": "John Doe",
      "email": "john@example.com"
    },
    "_persistedToMongo": true
  }
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (missing permission or not a member) |
| 404 | Not Found (resource doesn't exist) |
| 500 | Internal Server Error |

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Header**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

**Last Updated**: 2024
