import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes for MongoDB Atlas optimization
expenseSchema.index({ projectId: 1, createdAt: 1, frequency: 1 }); // Optimized for AC calculation (costs by date and frequency)
expenseSchema.index({ projectId: 1, createdAt: -1 }); // General expenses lookup

export default mongoose.model('Expense', expenseSchema);

