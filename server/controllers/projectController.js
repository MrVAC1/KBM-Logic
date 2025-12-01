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
 */
export const updateMemberRole = async (req, res) => {
  try {
    const project = req.project;
    const { memberId } = req.params;
    const { roleName, permissions } = req.body;

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

    // Cannot change owner's role
    if (project.members[memberIndex].userId.toString() === project.ownerId.toString()) {
      return sendError(res, 'Cannot change project owner\'s role', 403);
    }

    // Get permissions for the role (use provided permissions or default)
    const rolePermissions = Array.isArray(permissions) 
      ? permissions 
      : getRolePermissions(roleName);

    // Update member's role (inline)
    project.members[memberIndex].roleName = roleName;
    project.members[memberIndex].permissions = rolePermissions;
    await project.save();

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
 */
export const updateRolePermissions = async (req, res) => {
  try {
    const project = req.project;
    const { roleName } = req.params;
    const { permissions } = req.body;
    
    // Permission check is handled by requirePermission('can_manage_roles') middleware

    // Cannot modify Owner role permissions
    if (roleName === 'Owner') {
      return sendError(res, 'Cannot modify Owner role permissions', 403);
    }

    // Validate permissions array
    if (!Array.isArray(permissions)) {
      return sendError(res, 'Permissions must be an array', 400);
    }

    // Validate that all permissions are valid
    const invalidPermissions = permissions.filter(p => !ALL_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      return sendError(res, `Invalid permissions: ${invalidPermissions.join(', ')}`, 400);
    }

    // Update all members with this role
    let updatedCount = 0;
    project.members.forEach((member, index) => {
      if (member.roleName === roleName && member.userId.toString() !== project.ownerId.toString()) {
        // Don't update owner's permissions even if they somehow have a different roleName
        project.members[index].permissions = [...permissions];
        updatedCount++;
      }
    });

    await project.save();

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


