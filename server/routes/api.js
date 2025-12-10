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
  updateRoleRate,
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
} from '../controllers/taskController.js';

// Financials
import {
  getDashboardStats,
  createTransaction,
  getTransactions,
} from '../controllers/financialController.js';

// Users
import {
  updateUserSalary,
  getUserDetails,
} from '../controllers/userController.js';

// Expenses
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';

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
router.put('/projects/:projectId/roles/:roleName/rate', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_roles'), updateRoleRate);
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

// Financial routes (with granular permissions)
router.get('/projects/:projectId/stats', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_view_financial'), getDashboardStats);
router.post('/projects/:projectId/transactions', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_edit_budget'), validate('createTransaction'), createTransaction);
router.get('/projects/:projectId/transactions', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_view_financial'), getTransactions);

// User routes (salary management requires project context for permission checks)
router.get('/users/:userId', verifyToken, checkDatabaseConnection, getUserDetails);
router.put('/projects/:projectId/users/:userId/salary', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_manage_salaries'), updateUserSalary);

// Expense routes
router.get('/projects/:projectId/expenses', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_view_financial'), getExpenses);
router.post('/projects/:projectId/expenses', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_edit_budget'), createExpense);
router.put('/projects/:projectId/expenses/:expenseId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_edit_budget'), updateExpense);
router.delete('/projects/:projectId/expenses/:expenseId', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_edit_budget'), deleteExpense);

// Velocity routes
import { getMemberVelocityData, getProjectMembersVelocityData } from '../controllers/velocityController.js';
router.get('/projects/:projectId/members/velocity', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_view_financial'), getProjectMembersVelocityData);
router.get('/projects/:projectId/members/:userId/velocity', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_view_financial'), getMemberVelocityData);

// Notification routes
import { getNotifications, getAllNotifications, markNotificationAsRead, markAllAsRead, getUnreadCount } from '../controllers/notificationController.js';
router.get('/notifications', verifyToken, checkDatabaseConnection, getAllNotifications);
router.get('/projects/:projectId/notifications', verifyToken, checkDatabaseConnection, checkProjectMember, getNotifications);
router.get('/notifications/unread-count', verifyToken, checkDatabaseConnection, getUnreadCount);
router.put('/notifications/:notificationId/read', verifyToken, checkDatabaseConnection, markNotificationAsRead);
router.put('/notifications/read-all', verifyToken, checkDatabaseConnection, markAllAsRead);

// Member notification settings routes
import { updateMyNotificationSettings, getMyNotificationSettings } from '../controllers/memberSettingsController.js';
router.get('/projects/:projectId/members/me/notifications', verifyToken, checkDatabaseConnection, checkProjectMember, getMyNotificationSettings);
router.put('/projects/:projectId/members/me/notifications', verifyToken, checkDatabaseConnection, checkProjectMember, updateMyNotificationSettings);

// Report routes
import { getInvestorReport } from '../controllers/reportController.js';
router.get('/projects/:projectId/reports/investor', verifyToken, checkDatabaseConnection, checkProjectMember, requirePermission('can_generate_reports'), getInvestorReport);

export default router;


