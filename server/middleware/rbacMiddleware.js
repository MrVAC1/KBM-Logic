import Project, { ALL_PERMISSIONS } from '../models/Project.js';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Check if user is a member of the project and load their permissions
 * Zero-Trust: Permissions are derived from the role assigned in the project
 */
export const checkProjectMember = async (req, res, next) => {
  try {
    // Get projectId from params or body
    const projectId = req.params.projectId || req.params.id || req.body.projectId;
    if (!projectId) {
      return sendError(res, 'Project ID required', 400);
    }
    
    const userId = req.dbUser._id;

    const project = await Project.findById(projectId);
    if (!project || project.isDeleted) {
      return sendError(res, 'Project not found', 404);
    }

    const member = project.members.find(
      m => m.userId.toString() === userId.toString()
    );

    // STRICT CHECK: User must be either owner OR a member
    // No partial access for non-members
    if (!member && project.ownerId.toString() !== userId.toString()) {
      logger.warn(`Access denied: User ${userId} attempted to access project ${projectId} without membership`);
      return sendError(res, 'Access denied: Not a project member. Please join the project first.', 403);
    }

    req.project = project;
    req.isOwner = project.ownerId.toString() === userId.toString();
    
    // Owner has ALL permissions
    if (req.isOwner) {
      req.memberRole = 'Owner';
      req.memberRoles = ['Owner'];
      req.memberPermissions = [...ALL_PERMISSIONS];
    } else if (member) {
      // Support multiple roles - get roles array or fallback to roleName
      const memberRoles = Array.isArray(member.roles) && member.roles.length > 0 
        ? member.roles 
        : (member.roleName ? [member.roleName] : ['Guest']);
      
      req.memberRoles = memberRoles;
      req.memberRole = memberRoles[0] || 'Guest'; // Primary role (for backward compatibility)
      
      // Aggregate permissions from all roles
      const aggregatedPermissions = new Set();
      
      // Add permissions directly stored on member (if any)
      if (Array.isArray(member.permissions)) {
        member.permissions.forEach(perm => aggregatedPermissions.add(perm));
      }
      
      // Get permissions from each role definition
      const defaultRoles = Project.getDefaultRoles();
      for (const roleName of memberRoles) {
        const roleDef = defaultRoles.find(r => r.name === roleName);
        if (roleDef && Array.isArray(roleDef.permissions)) {
          roleDef.permissions.forEach(perm => aggregatedPermissions.add(perm));
        }
        
        // Also check custom roles
        if (project.customRoles) {
          const customRole = project.customRoles.find(r => r.name === roleName);
          if (customRole && Array.isArray(customRole.permissions)) {
            customRole.permissions.forEach(perm => aggregatedPermissions.add(perm));
          }
        }
      }
      
      req.memberPermissions = Array.from(aggregatedPermissions);
    } else {
      req.memberRole = 'Guest';
      req.memberRoles = ['Guest'];
      req.memberPermissions = [];
    }

    next();
  } catch (error) {
    logger.error(`RBAC Error: ${error.message}`, { error });
    return sendError(res, 'Server error in RBAC', 500);
  }
};

/**
 * Require specific permission(s)
 * Can accept single permission or array of permissions (any match = pass)
 */
export const requirePermission = (permissions) => {
  const permissionList = Array.isArray(permissions) ? permissions : [permissions];
  
  return (req, res, next) => {
    // Owner always passes
    if (req.isOwner) {
      return next();
    }
    
    // Check if user has ANY of the required permissions
    const hasPermission = permissionList.some(
      permission => req.memberPermissions?.includes(permission)
    );
    
    if (!hasPermission) {
      return sendError(res, `Access denied: Missing required permission`, 403);
    }
    next();
  };
};

/**
 * Require ALL specified permissions
 */
export const requireAllPermissions = (permissions) => {
  const permissionList = Array.isArray(permissions) ? permissions : [permissions];
  
  return (req, res, next) => {
    // Owner always passes
    if (req.isOwner) {
      return next();
    }
    
    // Check if user has ALL required permissions
    const hasAllPermissions = permissionList.every(
      permission => req.memberPermissions?.includes(permission)
    );
    
    if (!hasAllPermissions) {
      return sendError(res, `Access denied: Missing required permissions`, 403);
    }
    next();
  };
};

/**
 * Require specific role (by name or hierarchy level)
 */
export const requireRole = (allowedRoles) => {
  const roleList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.memberRole || !roleList.includes(req.memberRole)) {
      return sendError(res, 'Access denied: Insufficient role', 403);
    }
    next();
  };
};

/**
 * Check if user can manage roles (Owner or Admin only)
 */
export const requireRoleManagement = (req, res, next) => {
  if (!req.isOwner && !req.memberPermissions?.includes('can_manage_roles')) {
    return sendError(res, 'Access denied: Only admins can manage roles', 403);
  }
  next();
};

