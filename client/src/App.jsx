import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { Toaster } from './components/ui/sonner';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import HomePage from './pages/page';
import LoginPage from './pages/login/page';
import OnboardingPage from './pages/onboarding/page';
import ProjectsPage from './pages/projects/page';
import OverviewPage from './pages/workspace/overview/page';
import FinancialPage from './pages/workspace/financial/page';
import KanbanPage from './pages/workspace/kanban/page';
import RisksPage from './pages/workspace/risks/page';
import SettingsPage from './pages/workspace/settings/page';
import AccessDeniedPage from './pages/access-denied/page';

// Layouts
import WorkspaceLayout from './components/WorkspaceLayout';
import ProjectsLayout from './components/ProjectsLayout';

// Protected Route Component (requires authentication)
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user exists and has required properties (prevent race condition)
  if (!user || !user.uid) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Permission-protected Route Component
function PermissionRoute({ children, permission, permissions, requireAll = false }) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = useProject();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions) 
      : hasAnyPermission(permissions);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
}

// Root redirect component - redirects based on auth state
function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is logged in, redirect to projects
  if (user) {
    return <Navigate to="/projects" replace />;
  }

  // If user is not logged in, show home page
  return <HomePage />;
}

function AppRoutes() {
  const { loading } = useAuth();

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<RootRedirect />} />
      <Route 
        path="/login" 
        element={
          // Redirect to projects if already logged in
          <LoginPage />
        } 
      />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      
      {/* Projects list (always accessible when authenticated) */}
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProjectsPage />} />
      </Route>

      {/* Workspace routes (permission-protected) */}
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            <WorkspaceLayout />
          </ProtectedRoute>
        }
      >
        {/* Overview - always accessible (no permission required) */}
        <Route 
          path="overview" 
          element={<OverviewPage />} 
        />
        
        {/* Financial - requires can_view_financial */}
        <Route 
          path="financial" 
          element={
            <PermissionRoute permission="can_view_financial">
              <FinancialPage />
            </PermissionRoute>
          } 
        />
        
        {/* Kanban - requires can_view_tasks */}
        <Route 
          path="kanban" 
          element={
            <PermissionRoute permission="can_view_tasks">
              <KanbanPage />
            </PermissionRoute>
          } 
        />
        
        {/* Risks - requires can_view_risks */}
        <Route 
          path="risks" 
          element={
            <PermissionRoute permission="can_view_risks">
              <RisksPage />
            </PermissionRoute>
          } 
        />
        
        {/* Settings - requires can_manage_settings */}
        <Route 
          path="settings" 
          element={
            <PermissionRoute permission="can_manage_settings">
              <SettingsPage />
            </PermissionRoute>
          } 
        />

        {/* Default workspace redirect - go to overview */}
        <Route index element={<Navigate to="overview" replace />} />
      </Route>

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ProjectProvider>
            <AppRoutes />
            <Toaster />
          </ProjectProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;


