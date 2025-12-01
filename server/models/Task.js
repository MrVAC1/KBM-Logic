import mongoose from 'mongoose';

const timeLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  duration: {
    type: Number, // in seconds
    default: 0,
  },
  description: String,
}, { timestamps: true });

const riskSchema = new mongoose.Schema({
  probability: {
    type: Number,
    min: 1,
    max: 5,
    default: 1,
  },
  impact: {
    type: Number,
    min: 1,
    max: 5,
    default: 1,
  },
  auto_score: {
    type: Number,
    default: 1,
  },
  isAutoAdjusted: {
    type: Boolean,
    default: false,
  },
  autoAdjustReason: String,
}, { _id: false });

const taskSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['Todo', 'In Progress', 'Review', 'Done'],
    default: 'Todo',
    index: true,
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium',
  },
  complexity: {
    type: String,
    enum: ['Low', 'Med', 'High'],
    default: 'Med',
  },
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  startDate: {
    type: Date,
  },
  deadline: {
    type: Date,
  },
  // Estimated hours required to complete the task
  estimateHours: {
    type: Number,
    required: false,
    min: 0,
    default: 0,
  },
  // Planned Value (PV) - automatically calculated based on estimateHours and assignee daily rates
  plannedValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  timeLogs: [timeLogSchema],
  risk: riskSchema,
}, {
  timestamps: true,
});

// Indexes
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ deadline: 1 });

export default mongoose.model('Task', taskSchema);


