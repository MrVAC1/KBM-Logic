# Project Click Flow Documentation

## Overview
This document describes the complete flow of what happens when a user clicks on a project card in the Project Portfolio page (`/projects`).

---

## Flow Diagram

```
User Clicks Project Card
    ↓
handleEnterProject(projectId)
    ↓
Store projectId in localStorage
    ↓
Navigate to /workspace/info?project={projectId}
    ↓
WorkspaceLayout Mounts
    ↓
Extract projectId from URL params
    ↓
loadProject(projectId) via ProjectContext
    ↓
API Call: GET /api/projects/:projectId
    ↓
Project Data Loaded into Context
    ↓
Permission Check (isPendingAccess)
    ↓
[Branch A: Pending/Guest User] → ProjectOverview Component (No Sidebar)
[Branch B: Active Member] → WorkspaceLayout with Sidebar + Outlet
    ↓
Default Route Redirect: /workspace → /workspace/info
    ↓
ProjectInfoPage Renders (always accessible, no permission required)
```

---

## Step-by-Step Flow

### 1. **Initial Click Event** (`client/src/pages/projects/page.tsx`)

**Location**: Line 273
```typescript
<Card
  key={projectId}
  className="cursor-pointer"
  onClick={() => handleEnterProject(projectId)}
>
```

**Handler Function**: `handleEnterProject` (Lines 147-152)
```typescript
const handleEnterProject = useCallback((projectId: string) => {
  // Store active project ID
  localStorage.setItem('activeProjectId', projectId)
  // Navigate to workspace Project Info page with project ID in URL
  navigate(`/workspace/info?project=${projectId}`)
}, [navigate])
```

**Actions**:
- Stores `projectId` in `localStorage` under key `'activeProjectId'`
- Navigates to `/workspace/info?project={projectId}` (Project Info page)

---

### 2. **Route Matching** (`client/src/App.jsx`)

**Route Definition**: Lines 145-152
```jsx
<Route
  path="/workspace"
  element={
    <ProtectedRoute>
      <WorkspaceLayout />
    </ProtectedRoute>
  }
>
```

**ProtectedRoute Check**:
- Verifies user is authenticated
- If not authenticated → redirects to `/login`
- If authenticated → renders `WorkspaceLayout`

---

### 3. **WorkspaceLayout Initialization** (`client/src/components/WorkspaceLayout.tsx`)

**Component Mount**: Lines 8-11
```typescript
const navigate = useNavigate()
const [searchParams] = useSearchParams()
const { loadProject, currentProject, loading, error, isPendingAccess } = useProject()
```

**Project Loading Effect**: Lines 13-31
```typescript
useEffect(() => {
  // Get active project from URL search params or localStorage
  const projectIdFromUrl = searchParams.get('project')
  const activeProjectId = projectIdFromUrl || localStorage.getItem('activeProjectId')
  
  if (activeProjectId && !currentProject && !loading) {
    // Store in localStorage for persistence
    if (!localStorage.getItem('activeProjectId')) {
      localStorage.setItem('activeProjectId', activeProjectId)
    }
    loadProject(activeProjectId).catch((err) => {
      console.error('Failed to load project:', err)
    })
  } else if (!activeProjectId && !loading) {
    // No project selected, redirect to projects list
    navigate('/projects')
  }
}, [loadProject, currentProject, loading, navigate, searchParams])
```

**Actions**:
1. Extracts `projectId` from URL query parameter `?project={id}`
2. Falls back to `localStorage.getItem('activeProjectId')` if URL param missing
3. Calls `loadProject(activeProjectId)` from ProjectContext
4. If no projectId found → redirects to `/projects`

---

### 4. **Project Data Loading** (`client/src/contexts/ProjectContext.jsx`)

**loadProject Function**: Lines 34-83
```typescript
const loadProject = useCallback(async (projectId) => {
  setLoading(true)
  setError(null)

  try {
    const response = await projectsAPI.getById(projectId)
    const project = response.data?.data || response.data
    
    setCurrentProject(project)
    setUserAccess(project.currentUserAccess || {
      role: 'Guest',
      permissions: [],
      isOwner: false,
      isPending: project.isSafeView || project._isSafeView || false,
    })
  } catch (err) {
    if (err._isAccessDenied || err.response?.status === 403) {
      setError('ACCESS_DENIED')
      // Redirect handled by WorkspaceLayout
    } else {
      setError(err.response?.data?.message || err.message || 'Failed to load project')
    }
  } finally {
    setLoading(false)
  }
}, [])
```

**API Call**: `GET /api/projects/:projectId`
- Requires authentication token
- Requires project membership (enforced by `checkProjectMember` middleware)
- Returns project data with user's access information

**State Updates**:
- `currentProject`: Full project object
- `userAccess`: User's role, permissions, and access status
- `loading`: Set to `false` when complete
- `error`: Set if request fails

---

### 5. **Access Control & Rendering Decision** (`WorkspaceLayout.tsx`)

**Loading State**: Lines 44-52
```typescript
if (loading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    </div>
  )
}
```

**Error Handling**: Lines 33-41, 55-69
- **ACCESS_DENIED**: Shows toast error, redirects to `/projects`
- **Other Errors**: Shows error message with "Go to Projects" button

**Access Branching**: Lines 77-86
```typescript
// Show Project Overview for pending/guest users (Safe View)
if (isPendingAccess() || currentProject?.isSafeView) {
  return (
    <div className="min-h-screen bg-background">
      <ProjectOverview project={currentProject} />
    </div>
  )
}

// Active members see full workspace with sidebar
return (
  <div className="flex min-h-screen bg-background">
    <AppSidebar />
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
  </div>
)
```

**Two Paths**:
1. **Pending/Guest Users**: Renders `ProjectOverview` component (no sidebar, limited view)
2. **Active Members**: Renders `WorkspaceLayout` with `AppSidebar` + `<Outlet />` for child routes

---

### 6. **Default Route Redirect** (`App.jsx`)

**Index Route**: Line 199
```jsx
<Route index element={<Navigate to="info" replace />} />
```

**Current Behavior**:
- When accessing `/workspace` (or `/workspace?project={id}`), the index route redirects to `/workspace/info` (Project Info page)
- This happens **after** the project is loaded and access is verified
- The `handleEnterProject` function also navigates directly to `/workspace/info?project={id}`
- Both paths lead to the Project Info page as the default landing page

---

### 7. **Final Page Rendering**

**For Active Members**:
1. `WorkspaceLayout` renders with `AppSidebar` on the left
2. `<Outlet />` renders the matched child route:
   - `/workspace/kanban` → `KanbanPage` (requires `can_view_tasks`)
   - `/workspace/info` → `ProjectInfoPage` (no permission required)
   - `/workspace/financial` → `FinancialPage` (requires `can_view_financial`)
   - etc.

**For Pending/Guest Users**:
- `ProjectOverview` component renders (full-screen, no sidebar)
- Shows "Waiting for Access Approval" message
- Displays project information card
- Shows "What's Next?" instructions

---

## Key Components Involved

### 1. **ProjectsPage** (`client/src/pages/projects/page.tsx`)
- Displays project cards in a grid
- Handles project click via `handleEnterProject`
- Navigates to `/workspace/info?project={id}` (Project Info page)

### 2. **WorkspaceLayout** (`client/src/components/WorkspaceLayout.tsx`)
- Wrapper for all workspace routes
- Loads project data on mount
- Handles access control and error states
- Conditionally renders sidebar based on user access

### 3. **ProjectContext** (`client/src/contexts/ProjectContext.jsx`)
- Manages current project state
- Provides `loadProject()` function
- Tracks user permissions and access level
- Exposes helper functions: `hasPermission()`, `getUserRole()`, `isPendingAccess()`

### 4. **App.jsx** (`client/src/App.jsx`)
- Defines routing structure
- Sets up protected routes
- Configures default redirects

---

## Data Flow

```
localStorage: activeProjectId
    ↓
URL Query: ?project={id}
    ↓
WorkspaceLayout extracts projectId
    ↓
ProjectContext.loadProject(projectId)
    ↓
API: GET /api/projects/:projectId
    ↓
Backend: projectController.getProjectDetails()
    ↓
Response: { project, currentUserAccess }
    ↓
ProjectContext updates state
    ↓
WorkspaceLayout reads currentProject
    ↓
Conditional rendering based on access
```

---

## Permission System

### Permission Checks
- **Owner**: Has all permissions automatically
- **Active Members**: Permissions checked via `hasPermission(permission)`
- **Pending/Guest Users**: `isPendingAccess()` returns `true`, limited view only

### Permission-Based Route Access
- Routes wrapped in `<PermissionRoute>` check permissions before rendering
- Missing permission → shows `AccessDeniedPage`
- `ProjectInfoPage` has no permission requirement (always accessible)

---

## Default Landing Page

**Current Configuration**:
- Default route redirect: `/workspace` → `/workspace/info`
- Project click navigation: `/workspace/info?project={id}`
- Both paths lead to the Project Info page as the default landing page

**Implementation**:
- `App.jsx` line 199: `<Route index element={<Navigate to="info" replace />} />`
- `ProjectsPage.tsx` line 151: `navigate(\`/workspace/info?project=${projectId}\`)`

---

## Error Scenarios

1. **Access Denied (403)**:
   - User is not a member of the project
   - Shows toast error
   - Redirects to `/projects`

2. **Project Not Found (404)**:
   - Project ID doesn't exist
   - Shows error message
   - Provides "Go to Projects" button

3. **Network Error**:
   - API request fails
   - Shows error message
   - User can retry or navigate away

---

## Summary

When a user clicks a project:
1. Project ID is stored in localStorage
2. Navigation occurs to `/workspace/info?project={id}` (Project Info page)
3. `WorkspaceLayout` loads the project data
4. Access is verified (member check)
5. Based on access level:
   - **Pending/Guest**: Shows `ProjectOverview` (no sidebar)
   - **Active Member**: Shows `WorkspaceLayout` with sidebar
6. Default route redirects to `/workspace/info` (Project Info page)
7. Final page renders: `ProjectInfoPage` for active members, `ProjectOverview` for pending users

**Current Configuration**: Both the click handler and default redirect point to the Project Info page (`/workspace/info`), making it the default landing page for all project workspaces.

