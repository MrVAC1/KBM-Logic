# User Guide

## Getting Started

### Creating an Account

1. Navigate to the login page
2. Click **"Sign up"** link
3. Fill in:
   - **Display Name**: Your full name
   - **Email**: Your email address
   - **Password**: At least 6 characters
   - **Confirm Password**: Re-enter password
4. Click **"Sign up"** button
5. You'll be automatically logged in and redirected to the Projects page

**Alternative**: Sign up with Google using the **"Sign up with Google"** button.

### Signing In

1. Enter your **Email** and **Password**
2. Click **"Sign in"** button

**Forgot Password?**
- Click **"Forgot password?"** link
- Enter your email
- Check your inbox for reset link

---

## Onboarding

### Creating Your First Project

1. On the **Projects** page, click **"Create Project"** button
2. Fill in:
   - **Project Name**: e.g., "Website Redesign"
   - **Description**: Brief project overview
   - **Access Password**: Password for team members to join
   - **Copy Settings From** (optional): Import roles from an existing project
3. Click **"Create Project"**
4. You'll be automatically added as **Owner** with full permissions

### Joining an Existing Project

1. On the **Projects** page, click **"Join Project"** button
2. Enter:
   - **Project ID**: Provided by project owner
   - **Access Password**: Provided by project owner
3. Click **"Join Project"**
4. You'll be added as a **Guest** with no permissions
5. Wait for the Project Manager to assign you a role

**Note**: As a Guest, you'll see a limited "Access Pending" view until your role is assigned.

---

## Workspace Guide

### Dashboard (Financial)

The Dashboard provides **Earned Value Management (EVM)** insights.

#### Reading the Burn-Down Chart

The chart shows two lines:
- **Planned (Blue)**: S-Curve of expected spending over time
- **Actual (Orange)**: Real spending from time logs and transactions

**Interpretation**:
- **Actual above Planned**: Over budget (red zone)
- **Actual below Planned**: Under budget (green zone)
- **Gap widening**: Budget risk increasing

#### Budget Overview Cards

- **Total Budget**: Project budget limit
- **Actual Spent**: Current spending
- **Remaining**: Budget left
- **Fixed Costs/Month**: Recurring monthly expenses

#### Managing Funds

1. Click **"Manage Funds"** button
2. **Add Income**:
   - Amount
   - Source (e.g., "Client Payment")
   - Date
   - Description
3. **Add Expense**:
   - Amount
   - Source (e.g., "Software License")
   - Date
   - Description
4. Click **"Save"**

#### Fixed Costs

1. Click **"Fixed Costs"** button
2. Add recurring costs:
   - **Title**: e.g., "Server Hosting"
   - **Amount**: Monthly cost
   - **Frequency**: Monthly, Weekly, Yearly, or One-time
3. Click **"Add"**
4. Fixed costs are automatically included in Planned Value calculations

---

### Kanban Board

The Kanban board visualizes task workflow: **Todo → In Progress → Review → Done**.

#### Task States

- **Todo**: Not started
- **In Progress**: Currently being worked on
- **Review**: Awaiting approval
- **Done**: Completed

#### Viewing Tasks

- **All Tasks**: See all project tasks
- **My Tasks**: Filter to tasks assigned to you

#### Task Card Information

Each card shows:
- **Title** and **Description**
- **Assignees**: Avatars of assigned team members
- **Risk Badge**: Color-coded risk level
- **Time Logged**: Total hours tracked
- **Deadline**: Due date (if set)

#### Opening Task Details

Click any task card to open the **Task Detail Modal**.

#### Task Detail Modal

**Manager View** (default):
- Full financial stats (Estimated Cost, Actual Cost)
- Time tracking controls
- Cost calculation breakdown
- Risk assessment controls

**Developer View**:
- Personal time tracking only
- Other members' earnings hidden
- Task assignment info

**Switch Views**: Use the **"View Mode"** dropdown.

#### Creating a Task

1. Click **"Create Task"** button (top right)
2. Fill in:
   - **Title**: Task name
   - **Description**: Detailed description
   - **Status**: Todo (default)
   - **Priority**: Low, Medium, High, Critical
   - **Complexity**: Low, Med, High
   - **Assignees**: Select team members
   - **Deadline**: Due date
   - **Risk**: Probability (1-5) and Impact (1-5)
3. Click **"Create Task"**

#### Task Workflow Actions

**From "Todo"**:
- Click **"Claim"** button → Assigns you and moves to "In Progress"

**From "In Progress"**:
- Click **"Finish"** button → Moves to "Review"

**From "Review"** (Reviewer role only):
- **"Approve"** → Moves to "Done"
- **"Request Changes"** → Moves back to "In Progress" with comment

**Note**: Developers cannot move tasks directly to "Done" (must go through Review).

#### Time Tracking

1. Open task detail modal
2. Click **"Start Tracking"** button
3. Work on the task
4. Click **"Stop Tracking"** button
5. Time is automatically logged and calculated into Actual Cost

**Permission Required**: `can_track_time`

#### Editing Tasks

1. Open task detail modal
2. Modify fields (title, description, status, priority, etc.)
3. Changes save automatically

**Permission Required**: `can_edit_tasks`

---

### Risks Module

The Risks module provides a **5x5 Risk Matrix** for project risk assessment.

#### Reading the Risk Matrix

**Axes**:
- **X-Axis (Impact)**: 1 (Minimal) to 5 (Critical)
- **Y-Axis (Probability)**: 1 (Very Low) to 5 (Very High)

**Risk Score**: `Probability × Impact` (1-25 scale)

**Color Coding**:
- **Green (1-5)**: Low Risk
- **Yellow (6-10)**: Medium Risk
- **Orange (11-15)**: High Risk
- **Red (16-20)**: Very High Risk
- **Dark Red (21-25)**: Critical Risk

#### Viewing Tasks in Risk Buckets

1. Click any cell in the matrix
2. **Risk Detail Modal** opens showing:
   - All tasks in that risk bucket
   - Task titles, descriptions, assignees
   - Deadlines
   - Auto-adjustment indicators

#### Auto-Adjusted Risks

Tasks with **"Auto"** badge are automatically adjusted by the Risk Engine:

**Triggers**:
1. **Deadline < 2 days**: Probability increases by +1
2. **Budget Overrun** (future): Probability increases by +1

**Indicator**: Badge shows **"Auto"** with reason (e.g., "Deadline approaching (< 2 days)")

#### Risk Register Table

Below the matrix, a table lists all tasks with:
- Task title
- Current risk score
- Probability and Impact values
- Auto-adjustment status
- Assignees

#### Setting Task Risk

1. Open task detail modal
2. Scroll to **"Risk Assessment"** section
3. Set **Probability** (1-5):
   - 1: Very Low
   - 2: Low
   - 3: Medium
   - 4: High
   - 5: Very High
4. Set **Impact** (1-5):
   - 1: Minimal
   - 2: Minor
   - 3: Moderate
   - 4: Major
   - 5: Critical
5. Risk score updates automatically: `Probability × Impact`

---

### Settings

**Access**: Only users with `can_manage_settings` permission can view Settings.

#### General Tab

- **Project Name**: Edit project name
- **Description**: Edit project description
- **Fixed Costs**: Manage recurring costs (see Dashboard section)

#### Members Tab

View all project members:
- **Name** and **Avatar**
- **Role**: Owner, Admin, PM, Developer, Guest
- **Joined Date**

#### Roles Tab

View role definitions:
- **Role Name**: Owner, Admin, PM, Developer, Guest
- **Permissions**: List of permissions per role
- **Custom Roles**: Imported or custom role definitions

#### Invites Tab

**Generate Invite Link**:
1. Click **"Regenerate Invite Code"** button
2. Copy the generated code
3. Share with team members

**Invite Options** (future):
- One-time use
- Temporary (15 minutes)
- Permanent

#### Owner Zone (Owner Only)

**Change Project Password**:
1. Enter new password
2. Confirm password
3. Click **"Update Password"**

**Delete Project**:
1. Click **"Delete Project"** button
2. Confirm deletion
3. Project is soft-deleted (`isDeleted: true`)

---

## Role-Based Features

### Owner
- Full access to all features
- Can delete project
- Can change project password
- Can manage all members and roles

### Admin
- View all modules (Dashboard, Kanban, Risks, Financial)
- Create, edit, delete tasks
- Manage roles and invite users
- Edit budget and transactions
- Cannot delete project

### PM (Project Manager)
- View all modules
- Create and edit tasks
- Invite users
- Track time
- Cannot delete tasks or manage roles

### Developer
- View Tasks and Risks
- Track time
- Create and edit own tasks
- Cannot view Financial Dashboard
- Cannot move tasks directly to "Done" (must go through Review)

### Guest
- No permissions
- See only "Access Pending" view
- Cannot access any workspace features
- Must wait for role assignment

---

## Tips & Best Practices

### Time Tracking
- Start timer when beginning work
- Stop timer when taking breaks
- Add descriptions to time logs for better reporting

### Risk Management
- Set risk scores when creating tasks
- Monitor "Auto-Adjusted" risks for deadline issues
- Review high-risk tasks (15+) regularly

### Budget Management
- Add fixed costs at project start
- Log all transactions (income and expenses)
- Monitor Actual vs Planned on Dashboard
- Set realistic deadlines to avoid auto-risk adjustments

### Task Organization
- Use consistent priority levels
- Set deadlines for time-sensitive tasks
- Assign tasks to appropriate team members
- Use "My Tasks" filter to focus on your work

---

## Troubleshooting

### Can't See Project Data
- Check if you're a project member
- Verify your role has required permissions
- Contact project owner if you see "Access Pending"

### Timer Not Working
- Ensure you have `can_track_time` permission
- Check if task is assigned to you
- Refresh page and try again

### Can't Create Tasks
- Verify you have `can_create_tasks` permission
- Check if you're a project member (not Guest)
- Contact project admin

### Budget Not Updating
- Ensure time logs are being saved
- Check if transactions are being created
- Refresh Dashboard to see latest data

---

**Need Help?** Contact your Project Manager or system administrator.

**Last Updated**: 2024

