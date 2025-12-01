import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Create a new department
 * POST /api/projects/:projectId/departments
 */
export const createDepartment = async (req, res) => {
  try {
    const project = req.project;
    const { name } = req.body;
    const userId = req.dbUser._id;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return sendError(res, 'Department name is required', 400);
    }

    const departmentName = name.trim();

    // Check if department with same name already exists
    const existingDepartment = project.departments?.find(d => d.name === departmentName);
    if (existingDepartment) {
      return sendError(res, `A department with the name "${departmentName}" already exists`, 400);
    }

    // Initialize departments array if it doesn't exist
    if (!project.departments) {
      project.departments = [];
    }

    // Create new department
    const newDepartment = {
      name: departmentName,
      memberIds: [],
      createdAt: new Date(),
    };

    project.departments.push(newDepartment);
    await project.save();

    logger.info(`Department created: User ${userId} created department "${departmentName}" in project ${project._id}`);

    sendSuccess(res, {
      message: 'Department created successfully',
      department: newDepartment,
    }, 201);
  } catch (error) {
    logger.error(`Create Department Error: ${error.message}`, { error });
    sendError(res, 'Failed to create department', 500);
  }
};

/**
 * Get all departments for a project
 * GET /api/projects/:projectId/departments
 */
export const getDepartments = async (req, res) => {
  try {
    const project = req.project;
    
    const departments = (project.departments || []).map(dept => ({
      id: dept._id,
      name: dept.name,
      memberIds: dept.memberIds || [],
      memberCount: (dept.memberIds || []).length,
      createdAt: dept.createdAt,
    }));

    sendSuccess(res, { departments });
  } catch (error) {
    logger.error(`Get Departments Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch departments', 500);
  }
};

/**
 * Get department details with member information
 * GET /api/projects/:projectId/departments/:departmentId
 */
export const getDepartmentDetails = async (req, res) => {
  try {
    const project = req.project;
    const { departmentId } = req.params;

    const department = project.departments?.find(d => d._id.toString() === departmentId);
    if (!department) {
      return sendError(res, 'Department not found', 404);
    }

    // Populate member details
    const memberIds = department.memberIds || [];
    const members = await User.find({ _id: { $in: memberIds } })
      .select('_id uid email displayName avatar')
      .lean();

    // Get active task counts for each member
    const activeTaskCounts = {};
    for (const memberId of memberIds) {
      const count = await Task.countDocuments({
        projectId: project._id,
        assignees: memberId,
        status: { $ne: 'Done' },
      });
      activeTaskCounts[memberId.toString()] = count;
    }

    // Format members with task counts
    const membersWithStats = members.map(member => {
      const memberObj = project.members.find(m => m.userId.toString() === member._id.toString());
      return {
        _id: member._id,
        id: member._id,
        uid: member.uid,
        email: member.email,
        displayName: member.displayName || member.email?.split('@')[0] || 'Unknown',
        avatar: member.avatar || '',
        joinedAt: memberObj?.joinedAt || new Date(),
        activeTaskCount: activeTaskCounts[member._id.toString()] || 0,
      };
    });

    sendSuccess(res, {
      department: {
        id: department._id,
        name: department.name,
        createdAt: department.createdAt,
      },
      members: membersWithStats,
    });
  } catch (error) {
    logger.error(`Get Department Details Error: ${error.message}`, { error });
    sendError(res, 'Failed to fetch department details', 500);
  }
};

/**
 * Delete a department
 * DELETE /api/projects/:projectId/departments/:departmentId
 */
export const deleteDepartment = async (req, res) => {
  try {
    const project = req.project;
    const { departmentId } = req.params;
    const userId = req.dbUser._id;

    const departmentIndex = project.departments?.findIndex(d => d._id.toString() === departmentId);
    if (departmentIndex === -1) {
      return sendError(res, 'Department not found', 404);
    }

    const department = project.departments[departmentIndex];

    // Check if department has members
    if (department.memberIds && department.memberIds.length > 0) {
      return sendError(res, `Cannot delete department "${department.name}" because it has ${department.memberIds.length} member(s). Please remove all members first.`, 400);
    }

    // Remove department
    project.departments.splice(departmentIndex, 1);
    await project.save();

    logger.info(`Department deleted: User ${userId} deleted department "${department.name}" from project ${project._id}`);

    sendSuccess(res, {
      message: 'Department deleted successfully',
      department: {
        id: department._id,
        name: department.name,
      },
    });
  } catch (error) {
    logger.error(`Delete Department Error: ${error.message}`, { error });
    sendError(res, 'Failed to delete department', 500);
  }
};

/**
 * Add member to department
 * POST /api/projects/:projectId/departments/:departmentId/members
 */
export const addMemberToDepartment = async (req, res) => {
  try {
    const project = req.project;
    const { departmentId } = req.params;
    const { memberId } = req.body;
    const userId = req.dbUser._id;

    if (!memberId) {
      return sendError(res, 'Member ID is required', 400);
    }

    const department = project.departments?.find(d => d._id.toString() === departmentId);
    if (!department) {
      return sendError(res, 'Department not found', 404);
    }

    // Check if member exists in project
    const member = project.members.find(m => 
      m._id.toString() === memberId || m.userId.toString() === memberId
    );
    if (!member) {
      return sendError(res, 'Member not found in project', 404);
    }

    const memberUserId = member.userId || member._id;

    // Initialize memberIds array if it doesn't exist
    if (!department.memberIds) {
      department.memberIds = [];
    }

    // Check if already in department
    const alreadyInDepartment = department.memberIds.some(id => id.toString() === memberUserId.toString());
    if (alreadyInDepartment) {
      return sendError(res, 'Member is already in this department', 400);
    }

    // Add member to department
    department.memberIds.push(memberUserId);
    await project.save();

    logger.info(`Member added to department: User ${userId} added member ${memberId} to department "${department.name}" in project ${project._id}`);

    sendSuccess(res, {
      message: 'Member added to department successfully',
    });
  } catch (error) {
    logger.error(`Add Member To Department Error: ${error.message}`, { error });
    sendError(res, 'Failed to add member to department', 500);
  }
};

/**
 * Remove member from department
 * DELETE /api/projects/:projectId/departments/:departmentId/members/:memberId
 */
export const removeMemberFromDepartment = async (req, res) => {
  try {
    const project = req.project;
    const { departmentId, memberId } = req.params;
    const userId = req.dbUser._id;

    const department = project.departments?.find(d => d._id.toString() === departmentId);
    if (!department) {
      return sendError(res, 'Department not found', 404);
    }

    // Remove member from department
    const memberIndex = department.memberIds.findIndex(id => id.toString() === memberId);
    if (memberIndex === -1) {
      return sendError(res, 'Member not found in department', 404);
    }

    department.memberIds.splice(memberIndex, 1);
    await project.save();

    logger.info(`Member removed from department: User ${userId} removed member ${memberId} from department "${department.name}" in project ${project._id}`);

    sendSuccess(res, {
      message: 'Member removed from department successfully',
    });
  } catch (error) {
    logger.error(`Remove Member From Department Error: ${error.message}`, { error });
    sendError(res, 'Failed to remove member from department', 500);
  }
};

