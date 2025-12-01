import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkProjectMember, requirePermission, requireRole, requireRoleManagement } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { checkDatabaseConnection } from '../middleware/dbCheckMiddleware.js';

// Auth
import { syncUser } from '../controllers/authController.js';

// Projects
import {
  createProject,
  getMyProjects,
  getProjectDetails,
  joinProject,
  updateProject,
  regenerateInviteCode,
  deleteProject,
  updateMemberRole,
  getProjectRoles,
  updateRolePermissions,
  updateRoleOrder,
  createProjectRole,
  deleteProjectRole,
  getProjectMembers,
  blockMember,
  unblockMember,
  getBannedUsers,
} from '../controllers/projectController.js';

// Departments
import {
  createDepartment,
  getDepartments,
  getDepartmentDetails,
  deleteDepartment,
  addMemberToDepartment,
  removeMemberFromDepartment,
} from '../controllers/departmentController.js';

// Tasks
import {
  getProjectTasks,
  createTask,
  updateTask,
  deleteTask,
  startTimer,
  stopTimer,
} from '../controllers/taskController.js';

// Financials
import {
  getDashboardStats,
  createTransaction,
  getTransactions,
} from '../controllers/financialController.js';

const router = express.Router();

// Auth routes
router.post('/auth/sync', verifyToken, checkDatabaseConnection, syncUser);

// Project routes
router.post('/projects', verifyToken, checkDatabaseConnection, validate('createProject'), createProject);
router.get('/projects', verifyToken, checkDatabaseConnection, getMyProjects);
router.get('/projects/:projectId', verifyToken, checkDatabaseConnection, checkProjectMember, getProjectDetails);
router.get('/projects/:projectId/roles', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_roles'), getProjectRoles);
router.post('/projects/:projectId/roles', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_roles'), createProjectRole);
// IMPORTANT: /roles/order must come BEFORE /roles/:roleName to avoid route collision
// Express matches routes sequentially, so static paths must come before dynamic parameters
router.put('/projects/:projectId/roles/order', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_roles'), updateRoleOrder);
router.put('/projects/:projectId/roles/:roleName', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_roles'), updateRolePermissions);
router.delete('/projects/:projectId/roles/:roleName', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_roles'), deleteProjectRole);
router.post('/projects/join', verifyToken, checkDatabaseConnection, validate('joinProject'), joinProject);
router.put('/projects/:projectId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), validate('updateProject'), updateProject);
router.post('/projects/:projectId/regenerate-invite', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_invite_users'), regenerateInviteCode);
router.delete('/projects/:projectId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_delete_project'), deleteProject);

// Member role management
router.put('/projects/:projectId/members/:memberId/role', verifyToken, checkProjectMember, requireRoleManagement, updateMemberRole);
router.get('/projects/:projectId/members', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), getProjectMembers);
router.post('/projects/:projectId/members/block', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), blockMember);
router.post('/projects/:projectId/members/unblock', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), unblockMember);
router.get('/projects/:projectId/members/banned', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), getBannedUsers);

// Department routes
router.post('/projects/:projectId/departments', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), createDepartment);
router.get('/projects/:projectId/departments', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), getDepartments);
router.get('/projects/:projectId/departments/:departmentId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), getDepartmentDetails);
router.delete('/projects/:projectId/departments/:departmentId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), deleteDepartment);
router.post('/projects/:projectId/departments/:departmentId/members', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), addMemberToDepartment);
router.delete('/projects/:projectId/departments/:departmentId/members/:memberId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), removeMemberFromDepartment);

// Task routes (with granular permissions)
router.get('/projects/:projectId/tasks', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_view_tasks'), getProjectTasks);
router.post('/projects/:projectId/tasks', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_create_tasks'), validate('createTask'), createTask);
router.put('/tasks/:taskId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_edit_tasks'), validate('updateTask'), updateTask);
// Note: deleteTask handles permission checking internally since it needs to get projectId from task
router.delete('/tasks/:taskId', verifyToken, checkDatabaseConnection, deleteTask);
router.post('/tasks/:taskId/start-timer', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_track_time'), startTimer);
router.post('/tasks/:taskId/stop-timer', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_track_time'), stopTimer);

// Financial routes (with granular permissions)
router.get('/projects/:projectId/stats', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_view_financial'), getDashboardStats);
router.post('/projects/:projectId/transactions', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_edit_budget'), validate('createTransaction'), createTransaction);
router.get('/projects/:projectId/transactions', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_view_financial'), getTransactions);

export default router;


