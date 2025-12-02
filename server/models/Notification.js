import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'task_assigned',
      'task_overdue',
      'task_completed',
      'role_changed',
      'salary_changed',
      'permission_changed',
      'financial_risk',
      'budget_overrun',
      'deadline_approaching',
    ],
    index: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ projectId: 1, type: 1 });

export default mongoose.model('Notification', notificationSchema);

