# Integration Guide - Connecting UI to Backend

This guide shows how to wire the copied UI components to the backend API.

## 1. Authentication Flow

### Login Page (`client/src/pages/LoginPage.jsx`)

```javascript
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { auth as authAPI } from '../services/api';

// Email/Password Login
const handleEmailLogin = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    localStorage.setItem('firebaseToken', token);
    
    // Sync user to backend
    await authAPI.sync();
    
    // Check if new user -> redirect to onboarding
    // Otherwise -> redirect to projects
    navigate('/projects');
  } catch (error) {
    console.error('Login error:', error);
  }
};

// Google Login
const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const token = await result.user.getIdToken();
    localStorage.setItem('firebaseToken', token);
    
    await authAPI.sync();
    navigate('/projects');
  } catch (error) {
    console.error('Google login error:', error);
  }
};
```

## 2. Project Portfolio

### Load Projects (`client/src/pages/ProjectsPage.jsx`)

```javascript
import { projects } from '../services/api';
import { useEffect, useState } from 'react';

const [projectsList, setProjectsList] = useState([]);

useEffect(() => {
  loadProjects();
}, []);

const loadProjects = async () => {
  try {
    const response = await projects.getAll();
    setProjectsList(response.data.data);
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
};
```

### Create Project Modal

```javascript
const handleCreateProject = async (formData) => {
  try {
    const response = await projects.create({
      name: formData.name,
      description: formData.description,
      password: formData.password,
      fixedCosts: formData.fixedCosts || [],
    });
    
    // Refresh projects list
    await loadProjects();
    setCreateModalOpen(false);
  } catch (error) {
    console.error('Failed to create project:', error);
  }
};
```

## 3. Dashboard

### Load Stats (`client/src/pages/DashboardPage.jsx`)

```javascript
import { financials } from '../services/api';

const [stats, setStats] = useState(null);

useEffect(() => {
  loadStats();
}, [projectId]);

const loadStats = async () => {
  try {
    const response = await financials.getStats(projectId);
    setStats(response.data.data);
    
    // Use stats.actualCost, stats.plannedValueCurve for charts
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
};
```

### Manage Funds Modal

```javascript
const handleCreateTransaction = async (transactionData) => {
  try {
    await financials.createTransaction(projectId, {
      amount: transactionData.amount,
      type: transactionData.type, // '+' or '-'
      source: transactionData.source,
      description: transactionData.description,
    });
    
    // Refresh stats
    await loadStats();
    setManageFundsModalOpen(false);
  } catch (error) {
    console.error('Failed to create transaction:', error);
  }
};
```

## 4. Kanban Board

### Load Tasks (`client/src/pages/BoardPage.jsx`)

```javascript
import { tasks } from '../services/api';

const [tasksList, setTasksList] = useState([]);

useEffect(() => {
  loadTasks();
}, [projectId]);

const loadTasks = async () => {
  try {
    const response = await tasks.getByProject(projectId);
    setTasksList(response.data.data);
  } catch (error) {
    console.error('Failed to load tasks:', error);
  }
};
```

### Task Modal - Save

```javascript
const handleSaveTask = async (taskData) => {
  try {
    if (taskId) {
      // Update existing task
      await tasks.update(taskId, {
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        complexity: taskData.complexity,
        assignees: taskData.assignees, // Array of user IDs
        deadline: taskData.deadline,
        risk: {
          probability: taskData.risk.probability,
          impact: taskData.risk.impact,
        },
      });
    } else {
      // Create new task
      await tasks.create(projectId, taskData);
    }
    
    await loadTasks();
    setTaskModalOpen(false);
  } catch (error) {
    console.error('Failed to save task:', error);
  }
};
```

### Timer - Start/Stop

```javascript
const handleStartTimer = async () => {
  try {
    await tasks.startTimer(taskId);
    setIsTimerRunning(true);
  } catch (error) {
    console.error('Failed to start timer:', error);
  }
};

const handleStopTimer = async () => {
  try {
    await tasks.stopTimer(taskId);
    setIsTimerRunning(false);
    await loadTasks(); // Refresh to get updated time logs
  } catch (error) {
    console.error('Failed to stop timer:', error);
  }
};
```

## 5. Settings

### Regenerate Invite Link

```javascript
import { projects } from '../services/api';

const handleRegenerateInvite = async () => {
  try {
    const response = await projects.regenerateInvite(projectId);
    setInviteCode(response.data.data.inviteCode);
  } catch (error) {
    console.error('Failed to regenerate invite:', error);
  }
};
```

### Delete Project (Danger Zone)

```javascript
const handleDeleteProject = async () => {
  if (!confirm('Are you sure? This action cannot be undone.')) return;
  
  try {
    await projects.delete(projectId);
    navigate('/projects');
  } catch (error) {
    console.error('Failed to delete project:', error);
  }
};
```

## 6. Multi-Select Assignees

In Task Modal, populate assignees dropdown from project members:

```javascript
const [availableUsers, setAvailableUsers] = useState([]);

useEffect(() => {
  loadProjectMembers();
}, [projectId]);

const loadProjectMembers = async () => {
  try {
    const response = await projects.getById(projectId);
    const members = response.data.data.members;
    setAvailableUsers(members.map(m => m.userId));
  } catch (error) {
    console.error('Failed to load members:', error);
  }
};

// In Task Modal JSX
<Select
  multiple
  value={selectedAssignees}
  onChange={setSelectedAssignees}
>
  {availableUsers.map(user => (
    <SelectItem key={user._id} value={user._id}>
      {user.displayName}
    </SelectItem>
  ))}
</Select>
```

## 7. Error Handling Pattern

Create a consistent error handler:

```javascript
const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error
    const message = error.response.data?.message || 'An error occurred';
    toast.error(message);
  } else if (error.request) {
    // Request made but no response
    toast.error('Network error. Please check your connection.');
  } else {
    // Something else happened
    toast.error('An unexpected error occurred');
  }
};

// Use in all API calls
try {
  await api.call();
} catch (error) {
  handleAPIError(error);
}
```

## 8. Loading States

Always show loading states during API calls:

```javascript
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  setLoading(true);
  try {
    await api.call();
  } catch (error) {
    handleAPIError(error);
  } finally {
    setLoading(false);
  }
};

// In JSX
<Button disabled={loading}>
  {loading ? 'Loading...' : 'Submit'}
</Button>
```

## Summary

1. Replace all `useState` mock data with API calls
2. Use `localStorage.getItem('firebaseToken')` for auth (handled by interceptor)
3. Handle loading and error states
4. Refresh data after mutations (create/update/delete)
5. Use project members for assignee dropdowns
6. Connect timer buttons to start/stop endpoints
7. Connect all modals to their respective API endpoints


