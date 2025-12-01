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
 * Get ordered role list for position-based hierarchy
 * Returns array: [Owner, ...customRoles, Guest]
 * Index 0 = Highest power (Owner)
 * Last Index = Lowest power (Guest)
 */
function getOrderedRoleList(project) {
  const orderedRoles = [];
  
  // Owner is always at index 0
  orderedRoles.push({ name: 'Owner', isDefault: true });
  
  // Add custom roles in their current order (from customRoles array)
  if (project.customRoles && project.customRoles.length > 0) {
    project.customRoles.forEach(customRole => {
      orderedRoles.push({ name: customRole.name, isDefault: false });
    });
  }
  
  // Guest is always at the last index
  orderedRoles.push({ name: 'Guest', isDefault: true });
  
  return orderedRoles;
}

/**
 * Get role index in the ordered role list (position-based hierarchy)
 * Returns -1 if role not found
 * Index 0 = Highest power (Owner)
 * Last Index = Lowest power (Guest)
 */
function getRoleIndex(roleName, project) {
  const orderedRoles = getOrderedRoleList(project);
  const roleIndex = orderedRoles.findIndex(r => r.name === roleName);
  return roleIndex;
}

/**
 * Get user's role index in a project (position-based hierarchy)
 * Returns index (0 = Owner = highest power, last = Guest = lowest power)
 * Returns -1 if user not found
 */
function getUserRoleIndex(project, userId) {
  // Owner always at index 0
  if (project.ownerId.toString() === userId.toString()) {
    return 0;
  }
  
  // Find member's role
  const member = project.members.find(m => m.userId.toString() === userId.toString());
  if (!member || !member.roleName) {
    // Guest or no role = last index (lowest power)
    const orderedRoles = getOrderedRoleList(project);
    return orderedRoles.length - 1; // Last index (Guest)
  }
  
  return getRoleIndex(member.roleName, project);
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
 * Check if requester can modify target role based on position-based hierarchy
 * Rule: Requester can only modify roles that are below them (higher index)
 * Index 0 = Highest power, Last Index = Lowest power
 */
function canModifyRole(project, requesterUserId, targetRoleName) {
  const requesterIndex = getUserRoleIndex(project, requesterUserId);
  const targetIndex = getRoleIndex(targetRoleName, project);
  
  // If either role not found, deny access
  if (requesterIndex === -1 || targetIndex === -1) {
    return false;
  }
  
  // Requester must have lower index (higher power) than target
  // Cannot modify roles at same or higher power level
  // Example: Index 0 (Owner) can modify Index 1, 2, 3...
  // Example: Index 1 can modify Index 2, 3, 4... but NOT Index 0
  return requesterIndex < targetIndex;
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
      const requesterIndex = getUserRoleIndex(project, userId);
      const targetIndex = getRoleIndex(roleName, project);
      logger.warn(`Hierarchy violation: User ${userId} (index ${requesterIndex}) attempted to assign role ${roleName} (index ${targetIndex})`);
      return sendError(res, `Access denied: You cannot assign the "${roleName}" role. You can only assign roles below your own in the hierarchy.`, 403);
    }

    // === HIERARCHY CHECK: Requester can only modify members with roles below them ===
    const targetMemberCurrentRole = targetMember.roleName || 'Guest';
    if (!canModifyRole(project, userId, targetMemberCurrentRole)) {
      const requesterIndex = getUserRoleIndex(project, userId);
      const targetMemberIndex = getRoleIndex(targetMemberCurrentRole, project);
      logger.warn(`Hierarchy violation: User ${userId} (index ${requesterIndex}) attempted to modify member with role ${targetMemberCurrentRole} (index ${targetMemberIndex})`);
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
    
    // Add custom roles that may not be assigned yet
    if (project.customRoles && project.customRoles.length > 0) {
      project.customRoles.forEach(customRole => {
        const existsInRoles = allRoles.some(r => r.name === customRole.name);
        if (!existsInRoles) {
          allRoles.push({
            name: customRole.name,
            permissions: Array.isArray(customRole.permissions) ? customRole.permissions : [],
          });
        }
      });
    }
    
    // Build ordered role list: Owner (index 0), custom roles, Guest (last index)
    const orderedRoleList = getOrderedRoleList(project);
    
    // Merge with role info and metadata
    const rolesWithMetadata = orderedRoleList.map((roleItem, index) => {
      const roleName = roleItem.name;
      
      // Find role data from members or custom roles
      const roleData = allRoles.find(r => r.name === roleName);
      
      // Get default role info for Owner/Guest
      const defaultRole = defaultRoles.find(r => r.name === roleName);
      
      // Get custom role info if applicable
      const customRole = project.customRoles?.find(r => r.name === roleName);
      
      // Determine permissions
      let permissions = [];
      if (roleName === 'Owner') {
        permissions = ALL_PERMISSIONS;
      } else if (roleData) {
        permissions = roleData.permissions || [];
      } else if (customRole) {
        permissions = Array.isArray(customRole.permissions) ? customRole.permissions : [];
      } else if (defaultRole) {
        permissions = defaultRole.permissions || [];
      }
      
      // Determine color
      let color = '#6b7280';
      if (defaultRole) {
        color = defaultRole.color;
      } else if (customRole) {
        color = customRole.color || '#6b7280';
      }
      
      return {
        name: roleName,
        permissions,
        color,
        isOwner: roleName === 'Owner',
        isDefault: roleItem.isDefault,
        // Position in the hierarchy (index-based)
        position: index,
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
      const requesterIndex = getUserRoleIndex(project, userId);
      const targetIndex = getRoleIndex(roleName, project);
      logger.warn(`Hierarchy violation: User ${userId} (index ${requesterIndex}) attempted to modify role ${roleName} (index ${targetIndex})`);
      return sendError(res, `Access denied: You cannot modify the "${roleName}" role. You can only modify roles below your own in the hierarchy.`, 403);
    }

    // === SUBSET RULE: User cannot grant permissions they don't have ===
    const userPermissions = getUserPermissions(project, userId);
    if (!hasPermissionToGrant(userPermissions, permissions)) {
      const missingPermissions = permissions.filter(p => !userPermissions.includes(p));
      logger.warn(`Subset rule violation: User ${userId} tried to grant permissions they don't have: ${missingPermissions.join(', ')}`);
      return sendError(res, `Access denied: You cannot grant permissions that you do not possess yourself. Missing permissions: ${missingPermissions.join(', ')}`, 403);
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

    // === HARD LIMIT: can_delete_project is ONLY for Owner role ===
    if (roleName !== 'Owner' && permissions.includes('can_delete_project')) {
      logger.warn(`Security violation: User ${userId} attempted to assign can_delete_project to role ${roleName}`);
      // Remove can_delete_project from permissions array
      permissions = permissions.filter(p => p !== 'can_delete_project');
      logger.info(`Removed can_delete_project from ${roleName} role permissions`);
    }

    // === SUBSET RULE: User cannot grant permissions they don't have (already checked above) ===
    // This check is redundant but kept for clarity

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
 * Update role order/hierarchy (Position-Based)
 * PUT /api/projects/:projectId/roles/order
 * 
 * Updates the order of custom roles in the project
 * Owner (index 0) and Guest (last index) are pinned and cannot be reordered
 * Only custom roles between them can be reordered
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

    // Owner must always be at index 0 - enforce this strictly
    if (roleOrder.length === 0) {
      return sendError(res, 'Role order cannot be empty', 400);
    }
    
    // Force Owner to be at index 0 (fix if frontend sent wrong order)
    if (roleOrder[0] !== 'Owner') {
      // Check if Owner is in the list
      const ownerIndex = roleOrder.indexOf('Owner');
      if (ownerIndex !== -1) {
        // Move Owner to position 0
        roleOrder.splice(ownerIndex, 1);
        roleOrder.unshift('Owner');
        logger.info(`Fixed role order: Moved Owner from index ${ownerIndex} to index 0`);
      } else {
        // Owner not in list - add it at the beginning
        roleOrder.unshift('Owner');
        logger.info(`Fixed role order: Added Owner at index 0`);
      }
    }

    // Guest must always be at the last index - enforce this strictly
    const guestIndex = roleOrder.indexOf('Guest');
    if (guestIndex !== -1 && guestIndex !== roleOrder.length - 1) {
      // Move Guest to last position (fix if frontend sent wrong order)
      roleOrder.splice(guestIndex, 1);
      roleOrder.push('Guest');
      logger.info(`Fixed role order: Moved Guest to last position (index ${roleOrder.length - 1})`);
    } else if (guestIndex === -1) {
      // Guest not in list - add it at the end
      roleOrder.push('Guest');
      logger.info(`Fixed role order: Added Guest at last position`);
    }

    // Get current ordered role list
    const currentOrder = getOrderedRoleList(project);
    const currentCustomRoles = project.customRoles || [];
    const customRoleNames = currentCustomRoles.map(r => r.name);

    // Extract only custom roles from roleOrder (exclude Owner and Guest)
    const newCustomRoleOrder = roleOrder.filter(name => name !== 'Owner' && name !== 'Guest');

    // Validate that all custom roles in order exist
    const invalidRoles = newCustomRoleOrder.filter(name => !customRoleNames.includes(name));
    if (invalidRoles.length > 0) {
      return sendError(res, `Invalid custom roles in order: ${invalidRoles.join(', ')}`, 400);
    }

    // Validate that all custom roles are included
    if (newCustomRoleOrder.length !== customRoleNames.length) {
      return sendError(res, `Missing custom roles in order. Expected ${customRoleNames.length} custom roles, got ${newCustomRoleOrder.length}`, 400);
    }

    // === OWNER BYPASS: Owner always has index 0 (highest power) and can reorder any role ===
    const isOwner = project.ownerId.toString() === userId.toString();
    
    // Get user's current role name
    const requesterRoleName = isOwner 
      ? 'Owner' 
      : (project.members.find(m => m.userId.toString() === userId.toString())?.roleName || 'Guest');
    
    // === POSITION-BASED SECURITY CHECK: Prevent privilege escalation ===
    // Skip hierarchy check for Owner - they can reorder anything
    if (!isOwner) {
      const requesterIndex = getUserRoleIndex(project, userId);
      
      // Find requester's position in the new order
      const requesterNewIndex = roleOrder.indexOf(requesterRoleName);
      
      if (requesterNewIndex === -1) {
        return sendError(res, 'Your role was not found in the role order', 400);
      }

      // Rule: User cannot reorder roles in a way that would place them above higher-priority roles
      // Check all roles that come BEFORE the requester in the new order
      if (requesterNewIndex > 0) {
        const rolesBeforeRequester = roleOrder.slice(0, requesterNewIndex);
        
        // Check each role before requester's position
        for (const roleNameBefore of rolesBeforeRequester) {
          if (roleNameBefore === 'Owner') continue; // Owner is always at top
          
          const roleBeforeIndex = getRoleIndex(roleNameBefore, project);
          
          // If this role has a higher index (lower priority) than requester in current order,
          // but is now before requester in new order, this is privilege escalation
          if (roleBeforeIndex > requesterIndex) {
            logger.warn(`Privilege escalation attempt: User ${userId} (${requesterRoleName}, index ${requesterIndex}) attempted to reorder above ${roleNameBefore} (index ${roleBeforeIndex})`);
            return sendError(res, `Access denied: You cannot reorder roles in a way that places your role above "${roleNameBefore}" in the hierarchy. This would be privilege escalation.`, 403);
          }
        }
      }
    }

    // Reorder custom roles array based on new order
    const reorderedCustomRoles = newCustomRoleOrder.map(roleName => {
      return currentCustomRoles.find(r => r.name === roleName);
    }).filter(Boolean); // Remove any undefined entries

    // Update project's customRoles array
    project.customRoles = reorderedCustomRoles;
    await project.save();

    logger.info(`Role order updated: User ${userId} updated custom role order in project ${project._id}`);

    sendSuccess(res, {
      message: 'Role order updated successfully',
      roleOrder,
      note: 'Role hierarchy is now position-based. Order determines power: Index 0 = Highest, Last Index = Lowest.',
    });
  } catch (error) {
    logger.error(`Update Role Order Error: ${error.message}`, { error });
    sendError(res, 'Failed to update role order', 500);
  }
};

/**
 * Create a new custom role
 * POST /api/projects/:projectId/roles
 * 
 * Creates a custom role with the specified name and color
 * New role starts with zero permissions and lowest hierarchy
 */
export const createProjectRole = async (req, res) => {
  try {
    const project = req.project;
    const { name, color } = req.body;
    const userId = req.dbUser._id;
    
    // Permission check is handled by requirePermission('can_manage_roles') middleware

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return sendError(res, 'Role name is required', 400);
    }

    const roleName = name.trim();

    // Validate role name doesn't conflict with default roles
    const defaultRoles = Project.getDefaultRoles();
    const defaultRoleNames = defaultRoles.map(r => r.name);
    if (defaultRoleNames.includes(roleName)) {
      return sendError(res, `Role name "${roleName}" is reserved for a default role. Please choose a different name.`, 400);
    }

    // Validate role name doesn't already exist as custom role
    const existingCustomRole = project.customRoles?.find(r => r.name === roleName);
    if (existingCustomRole) {
      return sendError(res, `A role with the name "${roleName}" already exists`, 400);
    }

    // === HIERARCHY CHECK: User can only create roles they can manage ===
    // Note: Creating a role doesn't immediately assign hierarchy, but we should ensure
    // the user has can_manage_roles permission (already checked by middleware)
    
    // Validate color
    const validColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#6b7280'];
    const selectedColor = color && validColors.includes(color) ? color : '#6b7280';

    // Create new custom role (position-based: new roles are added to the end of customRoles array)
    // They will be positioned between Owner (index 0) and Guest (last index)
    const newRole = {
      name: roleName,
      color: selectedColor,
      permissions: [], // Start with zero permissions
      createdAt: new Date(),
    };

    // Initialize customRoles array if it doesn't exist
    if (!project.customRoles) {
      project.customRoles = [];
    }

    project.customRoles.push(newRole);
    await project.save();

    logger.info(`Custom role created: User ${userId} created role "${roleName}" in project ${project._id}`);

    sendSuccess(res, {
      message: 'Role created successfully',
      role: newRole,
    }, 201);
  } catch (error) {
    logger.error(`Create Role Error: ${error.message}`, { error });
    sendError(res, 'Failed to create role', 500);
  }
};

/**
 * Delete a custom role
 * DELETE /api/projects/:projectId/roles/:roleName
 * 
 * Removes a custom role from the project
 * Cannot delete default roles or roles currently assigned to members
 */
export const deleteProjectRole = async (req, res) => {
  try {
    const project = req.project;
    const { roleName } = req.params;
    const userId = req.dbUser._id;
    
    // Permission check is handled by requirePermission('can_manage_roles') middleware

    // Cannot delete Owner role
    if (roleName === 'Owner') {
      return sendError(res, 'Cannot delete the Owner role. The Owner role is protected.', 403);
    }

    // Cannot delete Guest role (protected system role)
    if (roleName === 'Guest') {
      return sendError(res, 'Cannot delete the Guest role. The Guest role is a protected system role.', 403);
    }

    // Cannot delete default roles
    const defaultRoles = Project.getDefaultRoles();
    const defaultRoleNames = defaultRoles.map(r => r.name);
    if (defaultRoleNames.includes(roleName)) {
      return sendError(res, `Cannot delete default role "${roleName}". Default roles cannot be removed.`, 403);
    }

    // === POSITION-BASED HIERARCHY CHECK: User can only delete roles below them ===
    if (!canModifyRole(project, userId, roleName)) {
      const requesterIndex = getUserRoleIndex(project, userId);
      const targetIndex = getRoleIndex(roleName, project);
      logger.warn(`Hierarchy violation: User ${userId} (index ${requesterIndex}) attempted to delete role ${roleName} (index ${targetIndex})`);
      return sendError(res, `Access denied: You cannot delete the "${roleName}" role. You can only delete roles below your own in the hierarchy.`, 403);
    }

    // Check if role exists as custom role
    if (!project.customRoles || project.customRoles.length === 0) {
      return sendError(res, 'Role not found', 404);
    }

    const roleIndex = project.customRoles.findIndex(r => r.name === roleName);
    if (roleIndex === -1) {
      return sendError(res, 'Role not found', 404);
    }

    // Check if role is currently assigned to any members
    const membersWithRole = project.members.filter(m => m.roleName === roleName);
    if (membersWithRole.length > 0) {
      return sendError(res, `Cannot delete role "${roleName}" because it is currently assigned to ${membersWithRole.length} member(s). Please reassign members before deleting the role.`, 400);
    }

    // Remove the custom role
    const deletedRole = project.customRoles[roleIndex];
    project.customRoles.splice(roleIndex, 1);
    await project.save();

    logger.info(`Custom role deleted: User ${userId} deleted role "${roleName}" from project ${project._id}`);

    sendSuccess(res, {
      message: 'Role deleted successfully',
      deletedRole: {
        name: deletedRole.name,
        color: deletedRole.color,
      },
    });
  } catch (error) {
    logger.error(`Delete Role Error: ${error.message}`, { error });
    sendError(res, 'Failed to delete role', 500);
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



