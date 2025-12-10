import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['+', '-'],
    required: true,
  },
  source: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
    immutable: true,
    index: true,
  },
  effectiveDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  description: String,
}, {
  timestamps: true,
});

// Indexes for MongoDB Atlas optimization
transactionSchema.index({ projectId: 1, type: 1, effectiveDate: -1 }); // Optimized for Remaining Budget calculation (Income/Expenses by effective date)
transactionSchema.index({ projectId: 1, effectiveDate: -1 }); // General transactions lookup
transactionSchema.index({ projectId: 1, type: 1 }); // Transactions by type

export default mongoose.model('Transaction', transactionSchema);


