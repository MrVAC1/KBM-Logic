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
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  description: String,
}, {
  timestamps: true,
});

// Indexes
transactionSchema.index({ projectId: 1, date: -1 });
transactionSchema.index({ projectId: 1, type: 1 });

export default mongoose.model('Transaction', transactionSchema);


