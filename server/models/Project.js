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
  // Inline role data - supports both default and custom roles
  roleName: {
    type: String,
    required: true,
    // Removed enum restriction to allow custom role names
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


