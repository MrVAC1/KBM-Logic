import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { projects as projectsAPI } from '../services/api';

// All available permissions in the system
export const ALL_PERMISSIONS = [
  // View permissions
  'can_view_dashboard',
  'can_view_tasks',
  'can_view_risks',
  'can_view_financial',
  // Action permissions  
  'can_track_time',
  'can_create_tasks',
  'can_edit_tasks',
  'can_delete_tasks',
  'can_edit_budget',
  'can_manage_roles',
  'can_invite_users',
  'can_manage_settings',
  'can_delete_project',
];

const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
  const [currentProject, setCurrentProject] = useState(null);
  const [userAccess, setUserAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load a project and the user's access level
   */
  const loadProject = useCallback(async (projectId) => {
    if (!projectId) {
      setCurrentProject(null);
      setUserAccess(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await projectsAPI.getById(projectId);
      
      // Handle response structure: response.data.data or response.data
      const project = response.data?.data || response.data;
      
      if (!project) {
        throw new Error('Project data not found in response');
      }
      
      setCurrentProject(project);
      setUserAccess(project.currentUserAccess || {
        role: 'Guest',
        permissions: [],
        isOwner: false,
        isPending: project.isSafeView || project._isSafeView || false,
      });
    } catch (err) {
      // Handle 403 Access Denied - redirect to portfolio
      if (err._isAccessDenied || err.response?.status === 403) {
        // Clear active project
        localStorage.removeItem('activeProjectId');
        setCurrentProject(null);
        setUserAccess(null);
        // Redirect will be handled by WorkspaceLayout
        setError('ACCESS_DENIED');
        setLoading(false); // CRITICAL: Always set loading to false
        return;
      }
      
      console.error('Failed to load project:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load project');
      setCurrentProject(null);
      setUserAccess(null);
    } finally {
      // CRITICAL: Always set loading to false to stop spinner
      setLoading(false);
    }
  }, []);

  /**
   * Clear current project
   */
  const clearProject = useCallback(() => {
    setCurrentProject(null);
    setUserAccess(null);
    setError(null);
  }, []);

  /**
   * Check if user has a specific permission
   * @param {string} permission - The permission to check
   * @returns {boolean} - Whether user has the permission
   */
  const hasPermission = useCallback((permission) => {
    // Owner has all permissions
    if (userAccess?.isOwner) {
      return true;
    }
    
    // Check if permission exists in user's permissions array
    return userAccess?.permissions?.includes(permission) || false;
  }, [userAccess]);

  /**
   * Check if user has ANY of the specified permissions
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean} - Whether user has any of the permissions
   */
  const hasAnyPermission = useCallback((permissions) => {
    if (userAccess?.isOwner) {
      return true;
    }
    return permissions.some(p => userAccess?.permissions?.includes(p));
  }, [userAccess]);

  /**
   * Check if user has ALL of the specified permissions
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean} - Whether user has all permissions
   */
  const hasAllPermissions = useCallback((permissions) => {
    if (userAccess?.isOwner) {
      return true;
    }
    return permissions.every(p => userAccess?.permissions?.includes(p));
  }, [userAccess]);

  /**
   * Check if user is project owner
   */
  const isOwner = useCallback(() => {
    return userAccess?.isOwner || false;
  }, [userAccess]);

  /**
   * Check if user has any view permissions (not completely locked out)
   */
  const hasAnyAccess = useCallback(() => {
    if (userAccess?.isOwner) {
      return true;
    }
    const viewPermissions = [
      'can_view_dashboard',
      'can_view_tasks',
      'can_view_risks',
      'can_view_financial',
    ];
    return viewPermissions.some(p => userAccess?.permissions?.includes(p));
  }, [userAccess]);

  /**
   * Check if user is in "Safe View" mode (Guest/Pending - no permissions)
   */
  const isPendingAccess = useCallback(() => {
    return userAccess?.isPending || (!userAccess?.isOwner && (!userAccess?.permissions || userAccess.permissions.length === 0));
  }, [userAccess]);

  /**
   * Get user's role name
   */
  const getUserRole = useCallback(() => {
    return userAccess?.role || 'Guest';
  }, [userAccess]);

  /**
   * Update a member's role (requires can_manage_roles permission)
   */
  const updateMemberRole = useCallback(async (memberId, roleId) => {
    if (!currentProject) {
      throw new Error('No project loaded');
    }

    try {
      await projectsAPI.updateMemberRole(currentProject.id, memberId, roleId);
      // Reload project to get updated data
      await loadProject(currentProject.id);
    } catch (err) {
      throw new Error(err.message || 'Failed to update member role');
    }
  }, [currentProject, loadProject]);

  const value = {
    // State
    currentProject,
    userAccess,
    loading,
    error,
    
    // Actions
    loadProject,
    clearProject,
    updateMemberRole,
    
    // Permission helpers
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyAccess,
    isPendingAccess,
    isOwner,
    getUserRole,
    
    // Constants
    ALL_PERMISSIONS,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
};

export default ProjectContext;

