import mongoose from 'mongoose';

const fixedCostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  frequency: {
    type: String,
    enum: ['one-time', 'daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly',
  },
  currency: {
    type: String,
    default: 'USD',
  },
}, { _id: true });

// All available permissions in the system
const ALL_PERMISSIONS = [
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
  'can_manage_salaries',
  'can_manage_work_schedule',
  'can_delete_project',
  'can_generate_reports',
  // Notification permissions
  'notify_on_financial_risk',
  'notify_on_task_assignment',
  'notify_on_role_change',
];

// Role schema removed - role data is now inline in members

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Multiple roles support - array of role names
  roles: [{
    type: String,
    required: true,
    // Removed enum restriction to allow custom role names
  }],
  // Legacy field for backward compatibility (will be populated from roles array)
  roleName: {
    type: String,
    // No longer required, will be computed from roles[0] if exists
  },
  permissions: [{
    type: String,
    enum: ALL_PERMISSIONS,
  }],
  hourlyRate: {
    type: Number,
    default: 0,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  // Notification preferences for this member
  notificationSettings: {
    notifyOnTaskAssignment: {
      type: Boolean,
      default: true,
    },
    notifyOnBudgetRisk: {
      type: Boolean,
      default: true,
    },
    notifyOnRoleChange: {
      type: Boolean,
      default: true,
    },
    notifyOnTaskOverdue: {
      type: Boolean,
      default: true,
    },
    notifyOnTaskCompleted: {
      type: Boolean,
      default: true,
    },
  },
}, { _id: true });

// Pre-save hook to maintain backward compatibility
memberSchema.pre('save', function(next) {
  // If roles array exists and has items, set roleName to first role for backward compatibility
  if (this.roles && this.roles.length > 0 && !this.roleName) {
    this.roleName = this.roles[0];
  }
  // If roles is empty but roleName exists, migrate to roles array
  if ((!this.roles || this.roles.length === 0) && this.roleName) {
    this.roles = [this.roleName];
  }
  // Default to Guest if no roles
  if (!this.roles || this.roles.length === 0) {
    this.roles = ['Guest'];
    this.roleName = 'Guest';
  }
  next();
});

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  fixedCosts: [fixedCostSchema],
  // Custom roles defined by project owner/admin
  customRoles: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      default: '#6b7280',
    },
    hierarchy: {
      type: Number,
      default: 200, // Higher than default roles (Guest = 100)
    },
    permissions: [{
      type: String,
      enum: ALL_PERMISSIONS,
    }],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  members: [memberSchema],
  // Work schedule configuration
  workSchedule: {
    workingDaysPerWeek: {
      type: Number,
      min: 1,
      max: 7,
      default: 5,
    },
    daysOffPerWeek: {
      type: Number,
      min: 0,
      max: 6,
      default: 2,
    },
    hoursPerDay: {
      type: Number,
      min: 1,
      max: 24,
      default: 8,
    },
  },
  // Departments array for organizational groups
  departments: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    memberIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  // Banned users array
  bannedUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    bannedAt: {
      type: Date,
      default: Date.now,
    },
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  }],
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  // EVM (Earned Value Management) snapshots for S-Curve
  evmSnapshots: [{
    date: {
      type: Date,
      required: true,
      index: true,
    },
    plannedValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    actualCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    earnedValue: {
      type: Number,
      default: 0,
      min: 0,
    },
  }],
  // Cumulative actual cost for quick access
  cumulativeActualCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Working hours per month (default 160 = 20 days * 8 hours)
  workingHoursPerMonth: {
    type: Number,
    default: 160,
    min: 1,
  },
}, {
  timestamps: true,
});

// Default roles for new projects
// Simplified: Only Owner and Guest roles are created by default
// All other roles must be created manually by users
projectSchema.statics.getDefaultRoles = function() {
  return [
    {
      name: 'Owner',
      color: '#ef4444',
      hierarchy: 0,
      isDefault: false,
      permissions: ALL_PERMISSIONS,
    },
    {
      name: 'Guest',
      color: '#6b7280',
      hierarchy: 99,
      isDefault: true,
      permissions: [], // Zero permissions - must be granted by Owner
    },
  ];
};

// Generate invite code before save
projectSchema.pre('save', async function(next) {
  if (!this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  next();
});

// Indexes
projectSchema.index({ ownerId: 1, isDeleted: 1 });
projectSchema.index({ inviteCode: 1 });

const Project = mongoose.model('Project', projectSchema);

export { ALL_PERMISSIONS };
export default Project;


