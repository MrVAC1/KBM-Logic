# Roles and Permissions

## Overview

KBM Logic v3.0 implements a **Role-Based Access Control (RBAC)** system with hierarchical roles and granular permissions. Salaries are attached to **Roles**, not individual users, enabling flexible team management and accurate financial calculations.

## RBAC System

### Role Hierarchy

Roles are organized in a hierarchical structure:

1. **Owner** (Index 0) - Highest privilege, cannot be deleted or reordered
2. **Custom Roles** (Index 1-N) - User-defined roles, sortable
3. **Guest** (Last Index) - Lowest privilege, default for new members

### Role Structure

Each role contains:
- **Name** - Unique identifier (e.g., "Developer", "Manager")
- **Color** - Visual identifier (hex color code)
- **Permissions** - Array of permission strings
- **Position** - Hierarchy index (0 = highest)
- **Current Rate** - Monthly salary for the role
- **Salary History** - Historical rate changes

## Permissions

### View Permissions

| Permission | Description |
|------------|-------------|
| `can_view_dashboard` | Access project dashboard with overview statistics |
| `can_view_tasks` | See and browse tasks in the Kanban board |
| `can_view_risks` | Access risk assessments and risk scores |
| `can_view_financial` | View budget, transactions, and financial reports |

### Action Permissions

| Permission | Description |
|------------|-------------|
| `can_create_tasks` | Create new tasks in the project |
| `can_edit_tasks` | Modify existing tasks |
| `can_delete_tasks` | Remove tasks from the project |
| `can_edit_budget` | Manage project finances and transactions |
| `can_manage_roles` | Create and modify user roles and permissions |
| `can_invite_users` | Invite new members to the project |
| `can_manage_settings` | Modify project settings and configuration |
| `can_manage_salaries` | Edit role salaries in the Costs section |
| `can_manage_work_schedule` | Configure project working hours and days per week |
| `can_manage_deadline` | Change target completion date for the project |
| `can_delete_project` | Permanently delete the project (Owner only) |
| `can_generate_reports` | Generate investor reports |

### Notification Permissions

| Permission | Description |
|------------|-------------|
| `notify_on_financial_risk` | Receive notifications about budget overruns |
| `notify_on_task_assignment` | Receive notifications when assigned to tasks |
| `notify_on_role_change` | Receive notifications when role/permissions are updated |

## Permission Rules

### Hierarchy Rule

Users can only grant permissions they possess themselves. A user cannot assign `can_delete_project` to another role if they don't have it.

### Subset Rule

When updating role permissions, the system validates that:
- The requester has all permissions they're trying to grant
- The requester's role is higher in hierarchy than the target role

### Owner Protection

The **Owner** role has special protections:
- Cannot be deleted
- Cannot be reordered (always at index 0)
- Critical permissions (`can_delete_project`, `can_manage_roles`, `can_edit_budget`) cannot be disabled
- Always has all permissions (even if not explicitly listed)

### Delete Project Restriction

The `can_delete_project` permission is **reserved for Owner only**. Even if granted to another role, it will be automatically removed.

## Compensation Model

### Role-Based Salaries

**Key Concept:** Salaries are attached to **Roles**, not Users.

This design enables:
- **Flexibility:** Multiple users can share the same role and salary
- **Accuracy:** Financial calculations use role rates, not individual user rates
- **History:** Rate changes are tracked per role, preserving historical accuracy

### Role Compensation Schema

```javascript
{
  name: "Developer",
  currentRate: 5000,  // Monthly salary in USD
  salaryHistory: [
    {
      rate: 4500,
      effectiveDate: ISODate("2024-01-01")
    },
    {
      rate: 5000,
      effectiveDate: ISODate("2024-03-15")
    }
  ]
}
```

### Salary History

When a role's `currentRate` is updated:

1. **New Entry Added:** Current rate is added to `salaryHistory` with `effectiveDate = today`
2. **History Preserved:** Previous rates remain in history
3. **Financial Accuracy:** AC calculations use historical rates based on date

#### Example

```
Role: "Developer"
- Jan 1: Rate = $4,500/month (added to history)
- Mar 15: Rate updated to $5,000/month

Salary History:
[
  { rate: 4500, effectiveDate: 2024-01-01 },
  { rate: 5000, effectiveDate: 2024-03-15 }
]

AC Calculation:
- Jan 1 - Mar 14: Uses $4,500/month
- Mar 15 - Today: Uses $5,000/month
```

### Rate Resolution

The system resolves role rates for historical dates using `resolveRoleRateForDate()`:

```javascript
// Get rate for a specific date
const rate = resolveRoleRateForDate(project, "Developer", new Date("2024-02-01"));
// Returns: $4,500 (rate effective on that date)
```

**Algorithm:**
1. Sort `salaryHistory` by `effectiveDate` (ascending)
2. Find the latest entry where `effectiveDate <= targetDate`
3. Return that entry's `rate`
4. If no history entry found, return `currentRate`

## Role Management

### Creating Roles

**UI:** Settings → Roles → Create Role

**Required Fields:**
- **Role Name** - Unique identifier
- **Monthly Salary** - Initial rate (USD)
- **Color** - Visual identifier

**Backend Process:**
1. Validates role name doesn't conflict with default roles
2. Creates entry in `project.customRoles`
3. Creates entry in `project.roles` (compensation)
4. Initializes `salaryHistory` with current rate

### Editing Role Rates

**UI:** Settings → Roles → Edit (pencil icon)

**Process:**
1. Opens modal pre-filled with role name and current rate
2. User updates monthly salary
3. Backend adds new entry to `salaryHistory`
4. Updates `currentRate` field

**Note:** Role name and permissions cannot be edited via this modal. Use the permissions panel for permission changes.

### Deleting Roles

**Restrictions:**
- **Owner** role cannot be deleted
- **Guest** role cannot be deleted
- Roles with assigned members cannot be deleted (must reassign first)

**Process:**
1. System checks for members with this role
2. If members exist, deletion is blocked
3. If no members, role is removed from `customRoles` and `roles` arrays

### Reordering Roles

**UI:** Drag and drop roles in Settings → Roles

**Rules:**
- Owner always at top (index 0)
- Guest always at bottom (last index)
- Only custom roles can be reordered
- Hierarchy affects permission granting

## Member Role Assignment

### Multiple Roles Support

Members can have **multiple roles**:

```javascript
member: {
  roles: ["Developer", "Reviewer"],  // Array of role names
  roleName: "Developer"              // Legacy field (first role)
}
```

### Permission Aggregation

When a member has multiple roles, permissions are **aggregated** (union):

```javascript
// Member has roles: ["Developer", "Reviewer"]
// Developer permissions: ["can_view_tasks", "can_create_tasks"]
// Reviewer permissions: ["can_view_tasks", "can_edit_tasks"]

// Aggregated permissions:
["can_view_tasks", "can_create_tasks", "can_edit_tasks"]
```

### Role Rate Resolution

For financial calculations, the system uses the **first role** in the `roles` array:

```javascript
const roleName = member.roles[0] || member.roleName;
const rate = resolveRoleRateForDate(project, roleName, targetDate);
```

## Best Practices

1. **Define Roles Early:** Create roles before adding team members
2. **Set Realistic Salaries:** Use accurate monthly rates for financial accuracy
3. **Update Rates Promptly:** When salaries change, update role rates immediately
4. **Use Hierarchy:** Organize roles by privilege level (higher = more permissions)
5. **Document Permissions:** Keep a record of what each role can do
6. **Review Regularly:** Audit role permissions periodically for security

## API Endpoints

### Role Management

```
GET    /api/projects/:projectId/roles           # List all roles
POST   /api/projects/:projectId/roles           # Create role
PUT    /api/projects/:projectId/roles/:roleName/rate  # Update role rate
PUT    /api/projects/:projectId/roles/:roleName       # Update permissions
PUT    /api/projects/:projectId/roles/order           # Reorder roles
DELETE /api/projects/:projectId/roles/:roleName       # Delete role
```

### Member Role Assignment

```
PUT    /api/projects/:projectId/members/:memberId/role  # Assign roles to member
```

## Related Documentation

- **[Financial Engine](./02-financial-engine.md)** - How role rates affect PV/AC calculations
- **[Database Schema](./05-database-schema.md)** - Role and Member schemas
- **[Architecture](./01-architecture-and-setup.md)** - System overview

