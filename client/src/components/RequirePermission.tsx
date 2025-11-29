import { Navigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';

interface RequirePermissionProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component that guards routes/content based on user permissions
 * 
 * Usage:
 * - Single permission: <RequirePermission permission="can_view_tasks">...</RequirePermission>
 * - Any of multiple: <RequirePermission permissions={['can_view_tasks', 'can_view_dashboard']}>...</RequirePermission>
 * - All permissions: <RequirePermission permissions={['can_view_tasks', 'can_edit_tasks']} requireAll>...</RequirePermission>
 */
export function RequirePermission({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback,
  redirectTo,
}: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = useProject();

  // Still loading - show nothing or a loading state
  if (loading) {
    return null;
  }

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions) 
      : hasAnyPermission(permissions);
  } else {
    // No permission specified = always allow
    hasAccess = true;
  }

  if (!hasAccess) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    if (fallback) {
      return <>{fallback}</>;
    }
    return null;
  }

  return <>{children}</>;
}

/**
 * Hook to conditionally render based on permission
 */
export function useHasPermission(permission: string): boolean {
  const { hasPermission } = useProject();
  return hasPermission(permission);
}

export default RequirePermission;

