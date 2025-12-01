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
} from '../controllers/projectController.js';

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
router.put('/projects/:projectId/roles/:roleName', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_roles'), updateRolePermissions);
router.put('/projects/:projectId/roles/order', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_roles'), updateRoleOrder);
router.post('/projects/join', verifyToken, checkDatabaseConnection, validate('joinProject'), joinProject);
router.put('/projects/:projectId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_settings'), validate('updateProject'), updateProject);
router.post('/projects/:projectId/regenerate-invite', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_invite_users'), regenerateInviteCode);
router.delete('/projects/:projectId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_delete_project'), deleteProject);

// Member role management
router.put('/projects/:projectId/members/:memberId/role', verifyToken, checkProjectMember, requireRoleManagement, updateMemberRole);

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


