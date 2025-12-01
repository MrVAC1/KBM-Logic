# User Guide

This guide explains how to use KBM Logic from an end-user perspective, covering onboarding, workspace features, and common workflows.

---

## Table of Contents

1. [Onboarding](#onboarding)
2. [Workspace Overview](#workspace-overview)
3. [Kanban Board](#kanban-board)
4. [Project Settings](#project-settings)
5. [Troubleshooting](#troubleshooting)

---

## Onboarding

### Creating an Account

1. Sign up using Firebase Authentication
2. You'll be redirected to the Projects page
3. Your account is automatically created in the system

### Joining a Project

To join an existing project, you need:
- **Project ID**: The unique identifier for the project
- **Project Password**: The password set by the project owner

**Steps**:

1. Click the **"Join Project"** button on the Projects page
2. Enter the **Project ID**
3. Enter the **Project Password**
4. Click **"Join"**

**What Happens Next**:

- You are added to the project as a **Guest** member
- You have **zero permissions** initially
- You'll see a "Safe View" screen with a message:
  > "You have successfully joined. Please wait for the Project Manager to assign you a role."

- The Project Owner or Admin must assign you a role before you can access tasks and data

### Safe View (Guest/Pending Members)

When you first join a project, you'll see a limited view that shows only:
- Project name and description
- Project owner information
- A message indicating you're waiting for role assignment

**You cannot**:
- See tasks
- See budget/financial data
- See other members (except owner)
- Access workspace features

**You can**:
- View basic project information
- Wait for role assignment

Once an Owner/Admin assigns you a role (Developer, PM, etc.), you'll gain access to the full workspace.

---

## Workspace Overview

Once you have an active role, you'll see the full workspace with a sidebar navigation.

### Sidebar Navigation

- **Overview** - Project summary and activity feed
- **Kanban Board** - Task management
- **Dashboard** - Financial overview and charts
- **Project Info** - Project details and members
- **Settings** - Project configuration (Owner/Admin only)

### Overview Page

The Overview page shows:

#### Project Info Card
- Project name and description
- Project owner
- Number of members
- Your current role

#### Recent Activity Feed

Shows the latest project events:
- Task created/updated
- Member added/removed
- Transaction added
- Role changes

*(Note: Activity feed is currently a placeholder and will show "Activity feed coming soon")*

---

## Kanban Board

The Kanban Board is the main task management interface. Tasks flow through columns: **Todo** → **In Progress** → **Review** → **Done**.

### Task Cards

Each task card displays:
- **Title** - Task name (bold, truncated if long)
- **Description** - 2 lines maximum with "..." if longer
- **Assignee** - Avatar and name (or "Unassigned")
- **Priority/Risk Badge** - Color-coded risk indicator
- **Deadline** - Due date (month and day)

### Task Workflow

#### 1. Todo Column

**Unassigned Tasks**:
- Show a **"Claim"** button
- Click "Claim" to assign the task to yourself
- Task moves to "In Progress" and you become the assignee

**Assigned Tasks**:
- Show assignee avatar and name
- No action buttons (wait for assignee to start)

#### 2. In Progress Column

**Your Tasks**:
- Show a **"Finish"** button
- Click "Finish" when work is complete
- Task moves to "Review" column

**Other People's Tasks**:
- Show assignee information
- No action buttons for you

#### 3. Review Column

**Tasks Ready for Review**:
- Show **"Approve"** button (if you can move to Done)
- Show **"Changes"** button (to request revisions)
- Approve moves task to "Done"
- Changes sends task back to "In Progress" with feedback

**Who Can Approve**:
- Project Owners
- Admins
- PMs
- Not Developers (they can only request changes)

#### 4. Done Column

- Completed tasks
- Read-only
- Shows final state and assignee

### Viewing Task Details

Click any task card to open the **Task Detail Modal** showing:
- Full task description
- Assignees
- Time tracking
- Risk assessment
- Financial data (if you have permission)
- Status and deadline

### Creating Tasks

**Required Permissions**: `can_create_tasks`

1. Click **"Create Task"** button on the Kanban Board
2. Fill in:
   - **Title** (required)
   - **Description** (required)
   - **Complexity Level**: Low / Medium / High
   - **Assignees**: Select users (based on complexity)
   - **Deadline**: Optional date picker
3. Click **"Create"**

**Complexity Rules**:
- **Low**: Max 1 user can be assigned
- **Medium**: Multiple users allowed
- **High**: Multiple users or department assignment allowed

### Time Tracking

**Required Permissions**: `can_track_time`

1. Open a task (click the task card)
2. In the Task Detail Modal, find the **Time Tracking** section
3. Click **"Start Tracking"** to begin logging time
4. Click **"Stop Tracking"** when finished
5. Time is automatically logged and cost is calculated

**Cost Calculation**:
- Hours logged × Your hourly rate = Task cost
- Contributes to project Actual Cost

### My Tasks Filter

Use the **"My Tasks"** toggle on the Kanban Board to filter:
- **On**: Shows only tasks assigned to you
- **Off**: Shows all tasks in the project

---

## Project Settings

**Required Permissions**: Owner or `can_manage_settings`

### Accessing Settings

1. Click **"Settings"** in the sidebar
2. Navigate through tabs:
   - **General** - Project name, description
   - **Members** - Member management
   - **Invites** - Invite link management
   - **Budget** - Fixed costs configuration

### Regenerate Invite Link

**Required Permissions**: Owner or `can_invite_users`

**Purpose**: Generate a new invite code for security or if the old one was compromised.

**Steps**:

1. Go to **Settings** → **Invites** tab
2. Click **"Regenerate Invite Link"** button
3. Confirm the action
4. New invite code is generated immediately
5. Old invite code becomes invalid

**Security Note**: Only regenerate if necessary, as it invalidates all previous invite links.

### Owner Safety Locks

**Purpose**: Protect critical project actions from accidental deletion or modification.

**Available Locks**:

1. **Project Deletion Lock**
   - Prevents accidental project deletion
   - Requires explicit unlock before deletion
   - Owner must confirm twice

2. **Member Removal Protection**
   - Warns before removing members
   - Prevents removing yourself as owner
   - Requires confirmation for member removal

3. **Role Modification Protection**
   - Confirms before changing member roles
   - Prevents removing owner privileges
   - Shows impact of role changes

**How to Use**:

- Locks are automatically enabled for safety
- You'll see confirmation dialogs before critical actions
- Review the warning message carefully
- Confirm only if you're sure

---

## Common Workflows

### Workflow 1: Starting Work on a Task

1. Go to **Kanban Board**
2. Find task in **Todo** column
3. Click **"Claim"** button
4. Task is assigned to you and moves to **In Progress**
5. Open task and click **"Start Tracking"** to log time
6. Complete the work
7. Click **"Finish"** button
8. Task moves to **Review** column

### Workflow 2: Reviewing a Task

1. Task appears in **Review** column
2. Open the task to review work
3. Choose one:
   - **Approve** → Task moves to **Done** (if you have permission)
   - **Changes** → Request revisions, task moves back to **In Progress**

### Workflow 3: Requesting Changes

1. Open task in **Review** column
2. Click **"Changes"** button
3. Enter feedback/change request
4. Task moves back to **In Progress**
5. Original assignee sees the feedback and can update the task

### Workflow 4: Inviting a Team Member

**Required**: Owner or `can_invite_users` permission

1. Get the **Invite Link** from Settings → Invites
2. Share the link with the person you want to invite
3. They click the link and enter the **Project Password**
4. They join as **Guest** (zero permissions)
5. Go to **Settings** → **Members**
6. Find the new member
7. Click **"Change Role"**
8. Select a role (Developer, PM, etc.)
9. Member gains appropriate permissions

---

## Permissions Reference

Different roles have different capabilities:

### Owner
- ✅ All permissions
- Can delete project
- Can manage all settings
- Cannot be removed

### Admin
- ✅ View all data
- ✅ Manage members and roles
- ✅ Edit tasks and budget
- ❌ Cannot delete project

### PM (Project Manager)
- ✅ View all data
- ✅ Create/edit tasks
- ✅ Invite users
- ❌ Cannot edit budget
- ❌ Cannot manage all roles

### Developer
- ✅ View tasks and risks
- ✅ Create/edit tasks
- ✅ Track time
- ❌ Cannot view financial data
- ❌ Cannot approve tasks (can only request changes)

### Guest
- ❌ No permissions
- Sees only Safe View
- Must wait for role assignment

---

## Troubleshooting

### "Access Denied" Error

**Cause**: You don't have permission to perform this action.

**Solution**:
- Check your role in the project
- Contact Project Owner or Admin to grant permissions
- Ensure you're a member of the project

### "Unknown" Assignee

**Cause**: User data not loaded correctly.

**Solution**:
- Refresh the page
- Contact administrator if issue persists
- The system should automatically populate assignee names

### Can't See Tasks

**Possible Causes**:
1. You're still a Guest (no permissions)
   - **Solution**: Wait for Owner/Admin to assign you a role
2. You don't have `can_view_tasks` permission
   - **Solution**: Request permission from Owner/Admin
3. Project has no tasks
   - **Solution**: Create tasks or ask someone with `can_create_tasks` permission

### Can't Claim Tasks

**Cause**: Task is already assigned or you don't have permission.

**Solution**:
- Check if task already has an assignee
- Ensure you have `can_view_tasks` permission
- Only unassigned tasks in Todo column show Claim button

### Safe View Won't Go Away

**Cause**: You're still a Guest or have zero permissions.

**Solution**:
- Owner/Admin must assign you a role
- Check with project owner about your access
- You should see a message: "Waiting for Project Manager to assign you a role"

---

## Tips & Best Practices

### For Developers

1. **Claim tasks before starting work** - This ensures proper assignment
2. **Use time tracking** - Log hours to help with budget calculations
3. **Move tasks through workflow** - Todo → In Progress → Review → Done
4. **Request changes clearly** - Provide specific feedback when using "Changes" button

### For Project Managers

1. **Assign roles promptly** - New members wait in Guest state
2. **Review tasks regularly** - Keep the Review column moving
3. **Monitor risk scores** - High risk tasks need attention
4. **Use My Tasks filter** - Focus on your assigned work

### For Owners/Admins

1. **Protect invite codes** - Only regenerate when necessary
2. **Grant permissions carefully** - Follow principle of least privilege
3. **Monitor budget** - Check Dashboard for actual vs planned costs
4. **Review member roles** - Ensure appropriate access levels

---

## Keyboard Shortcuts

*(Coming soon - keyboard shortcuts will be added in future updates)*

---

## Support

For technical issues or questions:
- Check the [Troubleshooting](#troubleshooting) section above
- Review your role and permissions
- Contact your Project Owner or Admin
- Check the project's activity feed for recent changes

---

**Last Updated**: Based on KBM Logic v0.1 codebase

