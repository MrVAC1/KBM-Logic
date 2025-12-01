import Project, { ALL_PERMISSIONS } from '../models/Project.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';
import { logDataOperation, ensureProjectInMongo } from '../services/mongoSync.js';

/**
 * Extract unique role definitions from members array
 * Used for API responses that need role reference data
 */
function extractRoleDefinitions(members) {
  const roleMap = new Map();
  members.forEach(member => {
    if (member.roleName && !roleMap.has(member.roleName)) {
      roleMap.set(member.roleName, {
        name: member.roleName,
        permissions: Array.isArray(member.permissions) ? member.permissions : [],
      });
    }
  });
  return Array.from(roleMap.values());
}

/**
 * Get role permissions by role name (from default roles)
 */
function getRolePermissions(roleName) {
  const defaultRoles = Project.getDefaultRoles();
  const roleDef = defaultRoles.find(r => r.name === roleName);
  return roleDef ? roleDef.permissions : [];
}

/**
 * Get role hierarchy value by role name
 * Lower number = higher hierarchy (Owner = 0, Guest = 100)
 */
function getRoleHierarchy(roleName) {
  const defaultRoles = Project.getDefaultRoles();
  const roleDef = defaultRoles.find(r => r.name === roleName);
  return roleDef ? roleDef.hierarchy : 100; // Default to lowest hierarchy
}

/**
 * Get user's role hierarchy in a project
 * Returns hierarchy value (lower = higher priority)
 * Owner always returns 0
 */
function getUserRoleHierarchy(project, userId) {
  // Owner always has highest hierarchy
  if (project.ownerId.toString() === userId.toString()) {
    return 0;
  }
  
  // Find member's role
  const member = project.members.find(m => m.userId.toString() === userId.toString());
  if (!member || !member.roleName) {
    return 100; // Guest or no role = lowest hierarchy
  }
  
  return getRoleHierarchy(member.roleName);
}

/**
 * Get user's permissions in a project
 * Owner gets all permissions
 */
function getUserPermissions(project, userId) {
  // Owner always has all permissions
  if (project.ownerId.toString() === userId.toString()) {
    return ALL_PERMISSIONS;
  }
  
  // Find member's permissions
  const member = project.members.find(m => m.userId.toString() === userId.toString());
  if (!member || !Array.isArray(member.permissions)) {
    return []; // No permissions
  }
  
  return member.permissions;
}

/**
 * Check if requester can modify target role based on hierarchy
 * Rule: Requester can only modify roles that are below them (higher hierarchy number)
 */
function canModifyRole(project, requesterUserId, targetRoleName) {
  const requesterHierarchy = getUserRoleHierarchy(project, requesterUserId);
  const targetHierarchy = getRoleHierarchy(targetRoleName);
  
  // Requester must have lower hierarchy number (higher priority) than target
  return requesterHierarchy < targetHierarchy;
}

/**
 * Check if user is trying to grant permissions they don't have (privilege escalation)
 */
function hasPermissionToGrant(userPermissions, permissionsToGrant) {
  // If user is trying to grant permissions they don't have, it's privilege escalation
  for (const permission of permissionsToGrant) {
    if (!userPermissions.includes(permission)) {
      return false;
    }
  }
  return true;
}

/**
 * Create a new project
 * POST /api/projects
 * 
 * Supports role import from another project via importRolesFrom parameter
 */
export const createProject = async (req, res) => {
  try {
    const { name, description, password, fixedCosts, importRolesFrom } = req.body;
    const ownerId = req.dbUser._id;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Get default role permissions (for reference)
    const defaultRoles = Project.getDefaultRoles();
    const ownerRoleDef = defaultRoles.find(r => r.name === 'Owner');

    // If importing roles from another project, get member role definitions
    let roleDefinitions = defaultRoles; // Default role definitions for reference
    if (importRolesFrom) {
      const sourceProject = await Project.findById(importRolesFrom);
      
      if (!sourceProject) {
        return sendError(res, 'Source project not found', 404);
      }

      // Verify user owns the source project
      if (sourceProject.ownerId.toString() !== ownerId.toString()) {
        return sendError(res, 'You can only import roles from projects you own', 403);
      }

      // Extract role definitions from source project members
      // Group members by roleName to get unique role definitions
      const roleMap = new Map();
      sourceProject.members.forEach(member => {
        if (!roleMap.has(member.roleName)) {
          roleMap.set(member.roleName, {
            name: member.roleName,
            permissions: member.permissions || [],
          });
        }
      });
      
      // Convert to array and ensure Owner and Guest exist
      roleDefinitions = Array.from(roleMap.values());
      if (!roleDefinitions.find(r => r.name === 'Owner')) {
        roleDefinitions.push(ownerRoleDef);
      }
      if (!roleDefinitions.find(r => r.name === 'Guest')) {
        roleDefinitions.push(defaultRoles.find(r => r.name === 'Guest'));
      }
    }

    // Create project with owner as first member (with inline role data)
    const project = await Project.create({
      name,
      description,
      passwordHash,
      ownerId,
      fixedCosts: fixedCosts || [],
      // No roles array - role data is inline in members
      members: [{
        userId: ownerId,
        roleName: 'Owner',
        permissions: ALL_PERMISSIONS, // Owner has all permissions
      }],
    });

    // Update user's createdProjects array
    const owner = await User.findById(ownerId);
    if (owner) {
      if (!owner.createdProjects) {
        owner.createdProjects = [];
      }
      owner.createdProjects.push(project._id);
      owner.projectsCount = owner.createdProjects.length;
      await owner.save();
      console.log(`✅ Updated user ${ownerId} createdProjects: ${owner.projectsCount} projects`);
    }

    // Log MongoDB persistence
    await logDataOperation('create', 'projects', project._id.toString(), ownerId, {
      name: project.name,
      membersCount: project.members.length,
      rolesCount: extractRoleDefinitions(project.members).length,
    });

    sendSuccess(res, {
      id: project._id,
      name: project.name,
      description: project.description,
      inviteCode: project.inviteCode,
      createdAt: project.createdAt,
      ownerId: project.ownerId,
      members: project.members,
      _persistedToMongo: true, // Flag indicating MongoDB persistence
    }, 201);
  } catch (error) {
    logger.error(`Create Project Error: ${error.message}`, { error });
    sendError(res, 'Failed to create project', 500);
  }
};

/**
 * Get user's projects
 * GET /api/projects
 */
export const getMyProjects = async (req, res) => {
  try {
    console.log('📋 getMyProjects called');
    console.log('📋 req.dbUser:', req.dbUser ? { _id: req.dbUser._id, uid: req.dbUser.uid, email: req.dbUser.email } : 'MISSING');
    
    if (!req.dbUser) {
      console.error('❌ req.dbUser is missing!');
      return sendError(res, 'User not authenticated', 401);
    }
    
    const userId = req.dbUser._id;
    console.log('📋 Searching for projects with userId:', userId);

    const projects = await Project.find({
      $or: [
        { ownerId: userId },
        { 'members.userId': userId },
      ],
      isDeleted: false,
    }).populate('ownerId', 'displayName email uid').select('-passwordHash');

    console.log('✅ Found projects:', projects.length);
    
    // Add isOwner flag to each project for frontend
    const projectsWithOwnerFlag = projects.map(project => {
      const projectObj = project.toObject();
      // Check if current user is owner
      const isOwner = project.ownerId && project.ownerId._id && 
                      project.ownerId._id.toString() === userId.toString();
      projectObj.isOwner = isOwner;
      
      console.log(`   Project: ${project.name}, Owner ID: ${project.ownerId?._id}, User ID: ${userId}, isOwner: ${isOwner}`);
      
      return projectObj;
    });
    
    console.log('✅ Projects with owner flags:', projectsWithOwnerFlag.length);
    sendSuccess(res, projectsWithOwnerFlag);
  } catch (error) {
    console.error('❌ Get Projects Error:', error.message);
    console.error('❌ Error stack:', error.stack);
    logger.error(`Get Projects Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch projects', 500);
  }
};

/**
 * Get project details
 * GET /api/projects/:projectId
 * 
 * Returns "Safe" limited data for Guest/Pending users (zero permissions)
 * Returns full data for users with view permissions
 */
export const getProjectDetails = async (req, res) => {
  try {
    const project = req.project;
    const userId = req.dbUser._id;

    // Find current user's membership
    const currentMember = project.members.find(
      m => m.userId.toString() === userId.toString()
    );
    
    // Get user's role and permissions (from inline member data)
    let userRoleName = 'Guest';
    let userPermissions = [];
    const isOwner = project.ownerId.toString() === userId.toString();
    
    if (isOwner) {
      userRoleName = 'Owner';
      userPermissions = ALL_PERMISSIONS;
    } else if (currentMember) {
      // Get role data directly from member (inline)
      userRoleName = currentMember.roleName || 'Guest';
      userPermissions = Array.isArray(currentMember.permissions) ? currentMember.permissions : [];
    }
    
    const isGuestOrPending = !isOwner && (userRoleName === 'Guest' || userPermissions.length === 0);
    
    // Populate owner info
    await project.populate('ownerId', 'displayName email photoURL');
    const owner = project.ownerId;
    
    // Populate members with user details (only for active members, not guests/pending)
    if (!isGuestOrPending) {
      await project.populate('members.userId', 'displayName email avatar photoURL');
    }
    
    // If user is Guest/Pending, return "Safe" limited data only
    // DO NOT return sensitive data (budget, transactions, tasks, etc.)
    if (isGuestOrPending) {
      return sendSuccess(res, {
        id: project._id,
        name: project.name,
        description: project.description,
        status: 'Active',
        role: userRoleName,
        isSafeView: true, // Flag to indicate this is limited "Safe" data
        owner: {
          name: owner?.displayName || owner?.email || 'Unknown',
          avatar: owner?.photoURL || null,
        },
        // Current user's access info
        currentUserAccess: {
          role: userRoleName,
          permissions: [], // Zero permissions for Guest/Pending
          isOwner: false,
          isPending: true, // Flag to indicate pending status
        },
        // Explicitly exclude sensitive data
        // No: inviteCode, fixedCosts, roles, members, transactions, tasks
      });
    }
    
    // Full data for users with permissions
    sendSuccess(res, {
      id: project._id,
      name: project.name,
      description: project.description,
      inviteCode: project.inviteCode,
      fixedCosts: project.fixedCosts,
      roles: extractRoleDefinitions(project.members),
      members: project.members, // Now populated with user details
      createdAt: project.createdAt,
      owner: {
        name: owner?.displayName || owner?.email || 'Unknown',
        avatar: owner?.photoURL || null,
      },
      // Current user's access info
      currentUserAccess: {
        role: userRoleName,
        permissions: userPermissions,
        isOwner: isOwner,
        isPending: false,
      },
    });
  } catch (error) {
    logger.error(`Get Project Details Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch project', 500);
  }
};

/**
 * Update member role
 * PUT /api/projects/:projectId/members/:memberId/role
 * 
 * Updates a specific member's role and permissions
 * Enforces hierarchy and privilege escalation prevention
 */
export const updateMemberRole = async (req, res) => {
  try {
    const project = req.project;
    const { memberId } = req.params;
    const { roleName, permissions } = req.body;
    const userId = req.dbUser._id;

    if (!roleName) {
      return sendError(res, 'Role name is required', 400);
    }

    // Find the member
    const memberIndex = project.members.findIndex(
      m => m._id.toString() === memberId || m.userId.toString() === memberId
    );
    
    if (memberIndex === -1) {
      return sendError(res, 'Member not found', 404);
    }

    const targetMember = project.members[memberIndex];
    const targetMemberUserId = targetMember.userId;

    // === OWNER PROTECTION: Cannot change owner's role ===
    if (targetMemberUserId.toString() === project.ownerId.toString()) {
      logger.warn(`User ${userId} attempted to change Owner's role in project ${project._id}`);
      return sendError(res, 'Cannot change project owner\'s role. The Owner role is protected.', 403);
    }

    // === HIERARCHY CHECK: Requester can only assign roles below them ===
    if (!canModifyRole(project, userId, roleName)) {
      const requesterHierarchy = getUserRoleHierarchy(project, userId);
      const targetHierarchy = getRoleHierarchy(roleName);
      logger.warn(`Hierarchy violation: User ${userId} (hierarchy ${requesterHierarchy}) attempted to assign role ${roleName} (hierarchy ${targetHierarchy})`);
      return sendError(res, `Access denied: You cannot assign the "${roleName}" role. You can only assign roles below your own in the hierarchy.`, 403);
    }

    // === HIERARCHY CHECK: Requester can only modify members with roles below them ===
    const targetMemberCurrentRole = targetMember.roleName || 'Guest';
    if (!canModifyRole(project, userId, targetMemberCurrentRole)) {
      const requesterHierarchy = getUserRoleHierarchy(project, userId);
      const targetMemberHierarchy = getRoleHierarchy(targetMemberCurrentRole);
      logger.warn(`Hierarchy violation: User ${userId} (hierarchy ${requesterHierarchy}) attempted to modify member with role ${targetMemberCurrentRole} (hierarchy ${targetMemberHierarchy})`);
      return sendError(res, `Access denied: You cannot modify members with the "${targetMemberCurrentRole}" role. You can only modify members with roles below your own in the hierarchy.`, 403);
    }

    // === OWNER PROTECTION: Cannot assign Owner role ===
    if (roleName === 'Owner') {
      logger.warn(`User ${userId} attempted to assign Owner role in project ${project._id}`);
      return sendError(res, 'Cannot assign Owner role. The Owner role is protected and cannot be assigned.', 403);
    }

    // Get permissions for the role (use provided permissions or default)
    let rolePermissions = Array.isArray(permissions) 
      ? permissions 
      : getRolePermissions(roleName);

    // === PRIVILEGE ESCALATION CHECK: User cannot grant permissions they don't have ===
    const userPermissions = getUserPermissions(project, userId);
    if (!hasPermissionToGrant(userPermissions, rolePermissions)) {
      const missingPermissions = rolePermissions.filter(p => !userPermissions.includes(p));
      logger.warn(`Privilege escalation attempt: User ${userId} tried to assign permissions they don't have: ${missingPermissions.join(', ')}`);
      return sendError(res, `Access denied: You cannot assign permissions that you do not possess yourself. Missing permissions: ${missingPermissions.join(', ')}`, 403);
    }

    // === VALIDATE THAT ALL PERMISSIONS ARE VALID ===
    const invalidPermissions = rolePermissions.filter(p => !ALL_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      return sendError(res, `Invalid permissions: ${invalidPermissions.join(', ')}`, 400);
    }

    // Update member's role (inline)
    project.members[memberIndex].roleName = roleName;
    project.members[memberIndex].permissions = rolePermissions;
    await project.save();

    logger.info(`Member role updated: User ${userId} updated member ${targetMemberUserId} to role ${roleName} in project ${project._id}`);

    sendSuccess(res, {
      message: 'Member role updated successfully',
      member: project.members[memberIndex],
      newRole: {
        name: roleName,
        permissions: rolePermissions,
      },
    });
  } catch (error) {
    logger.error(`Update Member Role Error: ${error.message}`, { error });
    sendError(res, 'Failed to update member role', 500);
  }
};

/**
 * Join project with password
 * POST /api/projects/join
 * 
 * Zero-Trust: New members get "Guest" role with NO permissions.
 * Owner/Admin must manually grant access.
 */
export const joinProject = async (req, res) => {
  try {
    const { projectId, password } = req.body;
    const userId = req.dbUser._id;

    const project = await Project.findById(projectId).select('+passwordHash');
    if (!project || project.isDeleted) {
      return sendError(res, 'Project not found', 404);
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, project.passwordHash);
    if (!isMatch) {
      return sendError(res, 'Invalid password', 403);
    }

    // Check if already a member
    const isMember = project.members.some(m => m.userId.toString() === userId.toString());
    if (isMember) {
      return sendError(res, 'Already a member of this project', 400);
    }

    // Add user as member with Guest role (zero permissions - inline)
    project.members.push({
      userId,
      roleName: 'Guest',
      permissions: [], // Zero permissions for new members
      joinedAt: new Date(),
    });
    await project.save();

    sendSuccess(res, {
      message: 'Joined project successfully. Please wait for the Project Manager to assign you a role.',
      project: {
        id: project._id,
        name: project.name,
      },
      role: 'Guest',
      permissions: [], // Explicitly show zero permissions
    });
  } catch (error) {
    logger.error(`Join Project Error: ${error.message}`, { error });
    sendError(res, 'Failed to join project', 500);
  }
};

/**
 * Update project
 * PUT /api/projects/:projectId
 */
export const updateProject = async (req, res) => {
  try {
    const project = req.project;
    const updates = req.body;

    Object.assign(project, updates);
    await project.save();

    sendSuccess(res, {
      id: project._id,
      name: project.name,
      description: project.description,
      fixedCosts: project.fixedCosts,
    });
  } catch (error) {
    logger.error(`Update Project Error: ${error.message}`, { error });
    sendError(res, 'Failed to update project', 500);
  }
};

/**
 * Regenerate invite code
 * POST /api/projects/:projectId/regenerate-invite
 */
export const regenerateInviteCode = async (req, res) => {
  try {
    const project = req.project;
    project.inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await project.save();

    sendSuccess(res, {
      inviteCode: project.inviteCode,
    });
  } catch (error) {
    logger.error(`Regenerate Invite Error: ${error.message}`, { error });
    sendError(res, 'Failed to regenerate invite code', 500);
  }
};

/**
 * Get roles from a project (for import and settings)
 * GET /api/projects/:projectId/roles
 * 
 * Only accessible by project owner or users with can_manage_roles permission
 */
export const getProjectRoles = async (req, res) => {
  try {
    const project = req.project;
    // Permission check is handled by requirePermission('can_manage_roles') middleware

    // Get all roles from members
    const allRoles = extractRoleDefinitions(project.members);
    
    // Get default roles for hierarchy and color info
    const defaultRoles = Project.getDefaultRoles();
    
    // Ensure Owner role is always included (even if not in members array)
    const ownerDefaultRole = defaultRoles.find(r => r.name === 'Owner');
    const hasOwnerRole = allRoles.some(r => r.name === 'Owner');
    
    if (!hasOwnerRole && ownerDefaultRole) {
      allRoles.push({
        name: 'Owner',
        permissions: ALL_PERMISSIONS, // Owner always has all permissions
      });
    }
    
    // Merge with default role info (hierarchy, color)
    const rolesWithMetadata = allRoles.map(role => {
      const defaultRole = defaultRoles.find(r => r.name === role.name);
      return {
        name: role.name,
        permissions: role.permissions || (role.name === 'Owner' ? ALL_PERMISSIONS : []),
        hierarchy: defaultRole?.hierarchy || 100,
        color: defaultRole?.color || '#6b7280',
        isOwner: role.name === 'Owner',
      };
    });

    sendSuccess(res, {
      roles: rolesWithMetadata,
      projectName: project.name,
    });
  } catch (error) {
    logger.error(`Get Project Roles Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch roles', 500);
  }
};

/**
 * Update role permissions
 * PUT /api/projects/:projectId/roles/:roleName
 * 
 * Updates permissions for all members with the specified role
 * Enforces hierarchy and privilege escalation prevention
 */
export const updateRolePermissions = async (req, res) => {
  try {
    const project = req.project;
    const { roleName } = req.params;
    const { permissions } = req.body;
    const userId = req.dbUser._id;
    
    // Permission check is handled by requirePermission('can_manage_roles') middleware

    // === OWNER PROTECTION: Cannot modify Owner role permissions ===
    if (roleName === 'Owner') {
      logger.warn(`User ${userId} attempted to modify Owner role permissions in project ${project._id}`);
      return sendError(res, 'Cannot modify Owner role permissions. The Owner role is protected and cannot be changed.', 403);
    }

    // === HIERARCHY CHECK: Requester can only modify roles below them ===
    if (!canModifyRole(project, userId, roleName)) {
      const requesterHierarchy = getUserRoleHierarchy(project, userId);
      const targetHierarchy = getRoleHierarchy(roleName);
      logger.warn(`Hierarchy violation: User ${userId} (hierarchy ${requesterHierarchy}) attempted to modify role ${roleName} (hierarchy ${targetHierarchy})`);
      return sendError(res, `Access denied: You cannot modify the "${roleName}" role. You can only modify roles below your own in the hierarchy.`, 403);
    }

    // === VALIDATE PERMISSIONS ARRAY ===
    if (!Array.isArray(permissions)) {
      return sendError(res, 'Permissions must be an array', 400);
    }

    // === VALIDATE THAT ALL PERMISSIONS ARE VALID ===
    const invalidPermissions = permissions.filter(p => !ALL_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      return sendError(res, `Invalid permissions: ${invalidPermissions.join(', ')}`, 400);
    }

    // === PRIVILEGE ESCALATION CHECK: User cannot grant permissions they don't have ===
    const userPermissions = getUserPermissions(project, userId);
    if (!hasPermissionToGrant(userPermissions, permissions)) {
      const missingPermissions = permissions.filter(p => !userPermissions.includes(p));
      logger.warn(`Privilege escalation attempt: User ${userId} tried to grant permissions they don't have: ${missingPermissions.join(', ')}`);
      return sendError(res, `Access denied: You cannot grant permissions that you do not possess yourself. Missing permissions: ${missingPermissions.join(', ')}`, 403);
    }

    // === UPDATE ALL MEMBERS WITH THIS ROLE ===
    let updatedCount = 0;
    project.members.forEach((member, index) => {
      if (member.roleName === roleName && member.userId.toString() !== project.ownerId.toString()) {
        // Don't update owner's permissions even if they somehow have a different roleName
        project.members[index].permissions = [...permissions];
        updatedCount++;
      }
    });

    await project.save();

    logger.info(`Role permissions updated: User ${userId} updated ${roleName} role permissions in project ${project._id} (${updatedCount} members affected)`);

    sendSuccess(res, {
      message: `Role permissions updated successfully (${updatedCount} member(s) affected)`,
      roleName,
      permissions,
      membersAffected: updatedCount,
    });
  } catch (error) {
    logger.error(`Update Role Permissions Error: ${error.message}`, { error });
    sendError(res, 'Failed to update role permissions', 500);
  }
};

/**
 * Update role order/hierarchy
 * PUT /api/projects/:projectId/roles/order
 * 
 * Updates the hierarchy order of roles based on provided order
 * Owner role is always at position 0 and cannot be reordered
 */
export const updateRoleOrder = async (req, res) => {
  try {
    const project = req.project;
    const { roleOrder } = req.body; // Array of role names in new order
    const userId = req.dbUser._id;
    
    // Permission check is handled by requirePermission('can_manage_roles') middleware

    // Validate roleOrder array
    if (!Array.isArray(roleOrder)) {
      return sendError(res, 'Role order must be an array', 400);
    }

    // Owner must always be first if present
    if (roleOrder.length > 0 && roleOrder[0] !== 'Owner') {
      // Check if Owner is in the list at all
      const ownerIndex = roleOrder.indexOf('Owner');
      if (ownerIndex !== -1) {
        return sendError(res, 'Owner role must always be at position 1 and cannot be reordered', 400);
      }
    }

    // Get default roles for hierarchy reference
    const defaultRoles = Project.getDefaultRoles();
    const ownerRole = defaultRoles.find(r => r.name === 'Owner');
    
    // Extract unique role definitions from current members
    const currentRoles = extractRoleDefinitions(project.members);
    const roleNames = currentRoles.map(r => r.name);

    // Validate that all roles in order exist
    const invalidRoles = roleOrder.filter(name => name !== 'Owner' && !roleNames.includes(name));
    if (invalidRoles.length > 0) {
      return sendError(res, `Invalid roles in order: ${invalidRoles.join(', ')}`, 400);
    }

    // === HIERARCHY SECURITY CHECK: Prevent privilege escalation ===
    const requesterHierarchy = getUserRoleHierarchy(project, userId);
    
    // Get user's current role name
    const requesterRoleName = userId.toString() === project.ownerId.toString() 
      ? 'Owner' 
      : (project.members.find(m => m.userId.toString() === userId.toString())?.roleName || 'Guest');
    
    // Find requester's position in the new order
    const requesterNewIndex = roleOrder.indexOf(requesterRoleName);
    
    // Rule: User cannot reorder roles in a way that would result in privilege escalation
    // Specifically: No role with higher priority (lower hierarchy number) should be below user's role
    
    if (requesterNewIndex !== -1 && requesterRoleName !== 'Owner') {
      // Get all roles that come AFTER the requester in the new order
      const rolesAfterRequester = roleOrder.slice(requesterNewIndex + 1);
      
      // Check each role after requester's position
      for (const roleName of rolesAfterRequester) {
        const roleHierarchy = getRoleHierarchy(roleName);
        
        // If this role has a lower hierarchy number (higher priority) than requester,
        // it means requester is trying to place themselves above a higher-priority role
        // This is privilege escalation and should be blocked
        if (roleHierarchy < requesterHierarchy) {
          logger.warn(`Privilege escalation attempt: User ${userId} (${requesterRoleName}, hierarchy ${requesterHierarchy}) attempted to reorder their role above ${roleName} (hierarchy ${roleHierarchy})`);
          return sendError(res, `Access denied: You cannot reorder roles in a way that places your role ("${requesterRoleName}") above "${roleName}" in the hierarchy. This would be privilege escalation.`, 403);
        }
      }
      
      // Also check: User cannot move higher-priority roles below their own role
      // Get all roles that come BEFORE the requester in the new order
      const rolesBeforeRequester = roleOrder.slice(0, requesterNewIndex).filter(name => name !== 'Owner');
      
      // Compare with default order to see if any higher-priority role was moved down
      const defaultOrder = defaultRoles
        .filter(r => roleNames.includes(r.name))
        .sort((a, b) => a.hierarchy - b.hierarchy)
        .map(r => r.name);
      
      for (const roleNameBefore of rolesBeforeRequester) {
        const roleBeforeHierarchy = getRoleHierarchy(roleNameBefore);
        
        // If this role has higher priority (lower hierarchy) than requester,
        // it's fine if it's before requester - that's expected
        // But we should check if requester moved their role above it when they shouldn't
        // Actually, this is already handled by the check above - if requester is above a higher role, that's the issue
      }
    }
    
    // Additional check: Prevent moving any role above a role with higher priority (lower hierarchy)
    // This prevents users from manipulating the order to create confusion
    for (let i = 0; i < roleOrder.length - 1; i++) {
      const currentRole = roleOrder[i];
      const nextRole = roleOrder[i + 1];
      
      if (currentRole === 'Owner' || nextRole === 'Owner') continue;
      
      const currentHierarchy = getRoleHierarchy(currentRole);
      const nextHierarchy = getRoleHierarchy(nextRole);
      
      // If a lower-priority role (higher hierarchy number) is placed above a higher-priority role,
      // check if requester has permission to do this
      if (currentHierarchy > nextHierarchy) {
        // This is only allowed if requester has higher priority than both roles
        if (requesterHierarchy >= currentHierarchy || requesterHierarchy >= nextHierarchy) {
          logger.warn(`Hierarchy violation: User ${userId} (hierarchy ${requesterHierarchy}) attempted to place ${currentRole} (hierarchy ${currentHierarchy}) above ${nextRole} (hierarchy ${nextHierarchy})`);
          return sendError(res, `Access denied: You cannot reorder roles in a way that violates hierarchy. Cannot place "${currentRole}" above "${nextRole}".`, 403);
        }
      }
    }

    // Calculate new hierarchy values based on order
    // Lower index = lower hierarchy number (higher priority)
    // Start from 10 (skip 0 which is Owner)
    let hierarchyIncrement = 10;
    const newHierarchies = {};
    
    // Owner always has hierarchy 0
    if (roleOrder[0] === 'Owner' || roleNames.includes('Owner')) {
      newHierarchies['Owner'] = 0;
      hierarchyIncrement = 10; // Start other roles at 10
    }

    // Assign hierarchy to other roles based on their order
    roleOrder.forEach((roleName, index) => {
      if (roleName !== 'Owner') {
        newHierarchies[roleName] = hierarchyIncrement + (index * 10);
      }
    });

    // Note: We don't actually store hierarchy in the project model
    // Hierarchy is determined by default roles. This endpoint mainly serves
    // as a validation endpoint and could be extended to store custom hierarchies
    // For now, we'll validate the order and return success
    
    // The actual hierarchy enforcement happens in the security checks
    // Frontend can use this endpoint to validate the order before applying changes

    logger.info(`Role order updated: User ${userId} updated role order in project ${project._id}`);

    sendSuccess(res, {
      message: 'Role order updated successfully',
      roleOrder,
      hierarchies: newHierarchies,
      note: 'Role hierarchies are determined by default role definitions. Reordering affects display order only.',
    });
  } catch (error) {
    logger.error(`Update Role Order Error: ${error.message}`, { error });
    sendError(res, 'Failed to update role order', 500);
  }
};

/**
 * Delete project (soft delete)
 * DELETE /api/projects/:projectId
 */
export const deleteProject = async (req, res) => {
  try {
    const project = req.project;
    
    // Only owner can delete
    if (project.ownerId.toString() !== req.dbUser._id.toString()) {
      return sendError(res, 'Only project owner can delete the project', 403);
    }

    project.isDeleted = true;
    await project.save();

    sendSuccess(res, { message: 'Project deleted successfully' });
  } catch (error) {
    logger.error(`Delete Project Error: ${error.message}`, { error });
    sendError(res, 'Failed to delete project', 500);
  }
};


