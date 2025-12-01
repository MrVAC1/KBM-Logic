# Roles and Permissions System

## Overview

The Roles and Permissions system implements a **Discord-style hierarchical role management** with granular permissions. It allows project owners and administrators to create custom roles, assign specific permissions, and control access through a strict hierarchy that prevents privilege escalation.

---

## 1. Role Structure

### Default Roles

Every new project starts with **two default roles**:

#### **Owner** (Hierarchy: 0)
- **Status**: Protected, cannot be deleted or modified
- **Permissions**: All permissions automatically granted
- **Color**: Red (`#ef4444`)
- **Position**: Always pinned at the top of the role list
- **Special Rules**:
  - Cannot be dragged or reordered
  - Critical permissions cannot be disabled
  - Only one Owner per project (the project creator)

#### **Guest** (Hierarchy: 99)
- **Status**: Protected, cannot be deleted
- **Permissions**: Zero permissions by default (must be granted explicitly)
- **Color**: Gray (`#6b7280`)
- **Position**: Bottom of the hierarchy
- **Purpose**: Default role for new members or users without specific permissions

### Custom Roles

- Created manually by users with `can_manage_roles` permission
- Start with **zero permissions** (must be granted explicitly)
- Assigned a **color** from a predefined palette
- Automatically placed at the **bottom of the hierarchy** (highest hierarchy number)
- Can be deleted if not assigned to any members

---

## 2. Hierarchy System

### Hierarchy Values

The hierarchy uses **numeric values** where **lower numbers = higher priority**:

- **0**: Owner (highest priority)
- **10-98**: Custom roles (ordered by creation or drag-and-drop)
- **99**: Guest (lowest priority)

### Hierarchy Rules

1. **Strict Hierarchy Enforcement**:
   - Users can only modify roles **below** them in the hierarchy
   - A user with hierarchy `50` cannot modify roles with hierarchy `10`, `30`, or `0`
   - Only roles with hierarchy `60+` can be modified

2. **No Privilege Escalation**:
   - Users cannot grant permissions they don't possess themselves
   - A user cannot reorder roles to place themselves above higher-priority roles
   - Backend validates all hierarchy changes before applying them

3. **Owner Protection**:
   - Owner role is always at hierarchy `0`
   - Owner cannot be deleted, modified, or moved
   - Owner bypasses all permission checks

---

## 3. Permissions System

### Available Permissions

The system supports **14 granular permissions**, organized into 4 categories:

#### **Administration** (Critical)
- `can_delete_project`: Delete the entire project (Owner only)
- `can_manage_settings`: Modify project settings
- `can_manage_roles`: Create and modify roles
- `can_edit_budget`: Manage financial data and transactions

#### **Management**
- `can_invite_users`: Invite new members to the project
- `can_delete_tasks`: Remove tasks from the project

#### **Operations**
- `can_create_tasks`: Create new tasks
- `can_edit_tasks`: Modify existing tasks
- `can_track_time`: Log time on tasks

#### **Access** (View-only)
- `can_view_financial`: View budget and financial reports
- `can_view_risks`: View risk assessments
- `can_view_dashboard`: Access the project dashboard
- `can_view_tasks`: Browse tasks in the Kanban board

### Permission Inheritance Rules

1. **No Inheritance**:
   - Permissions must be explicitly granted to each role
   - There is no automatic inheritance from parent roles

2. **Permission Escalation Prevention**:
   - Users can only grant permissions they possess
   - Example: If a Project Manager doesn't have `can_delete_project`, they cannot grant it to others
   - Owner bypasses this check

3. **Hard Limits**:
   - `can_delete_project` is **ONLY** available to the Owner role
   - Backend enforces this even if frontend allows the toggle
   - Other roles cannot be granted this permission

---

## 4. Drag and Drop Functionality

### Visual Feedback

The drag-and-drop system provides rich visual feedback:

1. **Drag Handle**: 
   - Visible only for draggable roles (not Owner)
   - Icon: Vertical grip (6 dots)
   - Appears on the left side of the role card

2. **While Dragging**:
   - Original card becomes **50% opaque** (faded)
   - **DragOverlay** shows a full-card preview with shadow
   - Movement is **restricted to vertical axis only** (no horizontal drift)

3. **Container Alignment**:
   - DragOverlay width matches the list container exactly
   - Dragged item "slides" within the container boundaries
   - Visual alignment ensures the item doesn't appear to "pop out"

### Technical Implementation

#### Frontend (`roles-tab.tsx`)

```typescript
// Vertical axis restriction
<DndContext
  modifiers={[restrictToVerticalAxis]}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>

// Sortable context for drag-and-drop
<SortableContext
  items={sortableRoleIds}
  strategy={verticalListSortingStrategy}
>

// DragOverlay with width matching
<DragOverlay
  style={{
    width: containerWidth ? `${containerWidth}px` : 'auto',
  }}
>
```

#### Drag Flow

1. **Drag Start** (`handleDragStart`):
   - Sets `activeId` to track which role is being dragged
   - DragOverlay becomes visible

2. **Drag End** (`handleDragEnd`):
   - Calculates new order using `arrayMove()`
   - **Optimistic UI**: Immediately updates local state
   - Sends API request to backend
   - On error: Reverts to previous state

3. **Backend Validation**:
   - Validates hierarchy rules
   - Checks for privilege escalation attempts
   - Prevents Owner from being moved
   - Updates hierarchy values based on new order

### Restrictions

- **Owner Role**: Cannot be dragged (disabled in `useSortable`)
- **Vertical Only**: Horizontal movement blocked by `restrictToVerticalAxis`
- **Container Boundaries**: Overlay respects container padding and width

---

## 5. Security Mechanisms

### Backend Security (Server-side)

#### 1. Hierarchy Validation

```javascript
function canModifyRole(project, requesterUserId, targetRoleName) {
  const requesterHierarchy = getUserRoleHierarchy(project, requesterUserId);
  const targetHierarchy = getRoleHierarchy(targetRoleName, project);
  
  // Requester must have lower hierarchy number (higher priority)
  return requesterHierarchy < targetHierarchy;
}
```

#### 2. Permission Escalation Prevention

```javascript
function hasPermissionToGrant(userPermissions, permissionsToGrant) {
  // User cannot grant permissions they don't have
  for (const permission of permissionsToGrant) {
    if (!userPermissions.includes(permission)) {
      return false;
    }
  }
  return true;
}
```

#### 3. Owner Protection

- Owner role permissions cannot be modified
- Owner role cannot be deleted
- Owner role cannot be assigned to other users
- Hardcoded checks in all role management endpoints

#### 4. Role Deletion Safety

- Cannot delete Owner or Guest roles
- Cannot delete roles assigned to members
- Must reassign members before deletion

### Frontend Security (Client-side)

#### 1. Permission Checks

- UI elements are conditionally rendered based on permissions
- Toggles are disabled if user lacks permission to grant them
- Visual indicators show locked permissions

#### 2. Optimistic UI with Rollback

- Immediate UI updates for better UX
- Automatic rollback on API failure
- Error messages inform users of failures

---

## 6. API Endpoints

### Get Roles
```
GET /api/projects/:projectId/roles
```
- Returns all roles with permissions and hierarchy
- Requires: `can_manage_roles` permission

### Update Role Permissions
```
PUT /api/projects/:projectId/roles/:roleName
Body: { permissions: string[] }
```
- Updates permissions for all members with a specific role
- Validates hierarchy and permission escalation
- Requires: `can_manage_roles` permission

### Update Role Order
```
PUT /api/projects/:projectId/roles/order
Body: { roleOrder: string[] }
```
- Reorders roles in the hierarchy
- Validates privilege escalation attempts
- Requires: `can_manage_roles` permission

### Create Custom Role
```
POST /api/projects/:projectId/roles
Body: { name: string, color: string }
```
- Creates a new custom role with zero permissions
- Places it at the bottom of the hierarchy
- Requires: `can_manage_roles` permission

### Delete Custom Role
```
DELETE /api/projects/:projectId/roles/:roleName
```
- Deletes a custom role
- Validates no members are assigned
- Requires: `can_manage_roles` permission

---

## 7. User Interface

### Role Card Structure

Each role card displays:

1. **Header**:
   - Drag handle (if draggable)
   - Color indicator (small circle)
   - Role name
   - Owner badge (if applicable)
   - Hierarchy level number
   - Expand/collapse button

2. **Expanded Content**:
   - Permissions grouped by category
   - Toggle switches for each permission
   - Lock icons for protected permissions
   - Descriptions for each permission
   - Delete role button (if deletable)

### Permission Toggle States

1. **Enabled**: Switch is ON, permission is granted
2. **Disabled**: Switch is OFF, permission not granted
3. **Locked**: Switch disabled with lock icon (Owner critical permissions)
4. **Blocked**: Switch disabled, user lacks permission to grant it

### Visual Feedback

- **Color-coded roles**: Each role has a unique color
- **Left border**: Matches role color for quick identification
- **Hierarchy indicator**: Shows numeric hierarchy level
- **Loading states**: Shows "Updating..." during API calls
- **Error states**: Toast notifications for failures

---

## 8. Workflow Examples

### Creating a New Role

1. User clicks "Create Role" button
2. Modal opens with:
   - Role name input
   - Color picker (7 predefined colors)
3. User submits → Confirmation dialog appears
4. On confirmation → API creates role with:
   - Zero permissions
   - Highest hierarchy number (bottom of list)
   - Selected color
5. UI refreshes to show new role

### Granting Permissions

1. User expands role card
2. User toggles permission switch
3. **Optimistic UI**: Switch immediately changes
4. API call updates all members with that role
5. On success: Toast confirmation
6. On failure: Switch reverts + error toast

### Reordering Roles

1. User drags role card using grip handle
2. Visual feedback shows drag overlay
3. User drops role in new position
4. **Optimistic UI**: List immediately reorders
5. API call validates and updates hierarchy
6. On success: Toast confirmation
7. On failure: List reverts + error toast

### Deleting a Role

1. User expands role card
2. User clicks "Delete Role" button
3. Confirmation dialog appears
4. User confirms deletion
5. API validates:
   - Role is not Owner or Guest
   - No members are assigned
6. Role is deleted
7. UI refreshes

---

## 9. Data Model

### Role Structure (Frontend)

```typescript
interface Role {
  name: string;              // Role name (e.g., "Admin", "Developer")
  permissions: string[];     // Array of permission IDs
  hierarchy: number;         // Hierarchy value (0-200)
  color: string;             // Hex color code
  isOwner?: boolean;         // True if Owner role
}
```

### Role Storage (Backend)

Roles are stored in two ways:

1. **Member Inline Data**:
   - Each member has `roleName` and `permissions` array
   - Permissions are stored directly on the member
   - Allows per-member customization if needed

2. **Custom Roles Array**:
   - Project has `customRoles` array
   - Stores custom role definitions (name, color, hierarchy)
   - Default roles (Owner, Guest) are not stored here

### Permission Storage

Permissions are stored as **string arrays**:

```javascript
{
  roleName: "Admin",
  permissions: [
    "can_create_tasks",
    "can_edit_tasks",
    "can_delete_tasks",
    "can_manage_roles"
  ]
}
```

---

## 10. Best Practices

### For Project Owners

1. **Start Conservative**: Begin with minimal permissions, grant more as needed
2. **Use Custom Roles**: Create roles matching your team structure (PM, Dev, QA)
3. **Document Roles**: Use clear role names that indicate purpose
4. **Regular Audits**: Review role permissions periodically

### For Developers

1. **Always Validate**: Never trust frontend-only permission checks
2. **Use Middleware**: Leverage `requirePermission` middleware
3. **Log Changes**: All role/permission changes should be logged
4. **Error Handling**: Provide clear error messages for permission denials

---

## 11. Common Issues and Solutions

### Issue: "Permission toggle doesn't update"

**Cause**: API call failed or state not synced  
**Solution**: Check network tab, verify backend logs, ensure optimistic UI rollback works

### Issue: "Cannot drag role"

**Cause**: Role is Owner, or user lacks `can_manage_roles` permission  
**Solution**: Owner cannot be dragged by design. Verify user permissions.

### Issue: "Cannot delete role"

**Cause**: Role is Owner/Guest, or assigned to members  
**Solution**: Reassign members first, then delete role

### Issue: "Permission toggle is disabled"

**Cause**: User lacks permission to grant that permission  
**Solution**: User must first be granted the permission themselves (hierarchy rule)

---

## 12. Future Enhancements

Potential improvements:

1. **Role Templates**: Pre-configured role sets for common team structures
2. **Permission Presets**: Quick sets like "Read-only", "Editor", "Admin"
3. **Audit Log**: Track all permission changes with timestamps
4. **Role Copying**: Duplicate existing roles as templates
5. **Bulk Operations**: Assign roles to multiple members at once
6. **Permission Groups**: Organize permissions into named groups

---

## Summary

The Roles and Permissions system provides:

- ✅ **Granular Control**: 14 specific permissions for fine-tuned access
- ✅ **Hierarchy Security**: Prevents privilege escalation through strict rules
- ✅ **Visual Management**: Drag-and-drop interface with real-time feedback
- ✅ **Flexibility**: Custom roles adapt to any team structure
- ✅ **Safety**: Multiple layers of validation prevent accidental privilege grants
- ✅ **User Experience**: Optimistic UI with instant feedback and error recovery

This system ensures that project access is controlled securely while remaining intuitive and flexible for project administrators.

