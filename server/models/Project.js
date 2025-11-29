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
  'can_delete_project',
];

// Role schema removed - role data is now inline in members

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Inline role data - no need for separate roles array
  roleName: {
    type: String,
    required: true,
    enum: ['Owner', 'Admin', 'PM', 'Developer', 'Guest'],
    default: 'Guest',
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
}, { _id: true });

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
  // Removed roles array - role data is now inline in members
  members: [memberSchema],
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
}, {
  timestamps: true,
});

// Default roles for new projects
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
      name: 'Admin',
      color: '#f97316',
      hierarchy: 10,
      isDefault: false,
      permissions: [
        'can_view_dashboard', 'can_view_tasks', 'can_view_risks', 'can_view_financial',
        'can_track_time', 'can_create_tasks', 'can_edit_tasks', 'can_delete_tasks',
        'can_edit_budget', 'can_manage_roles', 'can_invite_users', 'can_manage_settings',
      ],
    },
    {
      name: 'PM',
      color: '#eab308',
      hierarchy: 20,
      isDefault: false,
      permissions: [
        'can_view_dashboard', 'can_view_tasks', 'can_view_risks', 'can_view_financial',
        'can_track_time', 'can_create_tasks', 'can_edit_tasks',
        'can_invite_users',
      ],
    },
    {
      name: 'Developer',
      color: '#22c55e',
      hierarchy: 30,
      isDefault: false,
      permissions: [
        'can_view_tasks', 'can_view_risks',
        'can_track_time', 'can_create_tasks', 'can_edit_tasks',
      ],
    },
    {
      name: 'Guest',
      color: '#6b7280',
      hierarchy: 100,
      isDefault: true,
      permissions: [], // Zero permissions - must be granted by Owner/Admin
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


