import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  displayName: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
  },
  role: {
    type: String,
    enum: ['Pending', 'User', 'Admin'],
    default: 'Pending',
  },
  profile: {
    bio: String,
    location: String,
  },
  // Additional Firebase Auth data
  emailVerified: {
    type: Boolean,
    default: false,
  },
  phoneNumber: {
    type: String,
    default: null,
  },
  // Track projects created by this user
  createdProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  }],
  projectsCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export default mongoose.model('User', userSchema);


