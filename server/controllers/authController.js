import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';
import { syncUserToMongo, logDataOperation } from '../services/mongoSync.js';

/**
 * Sync user from Firebase Auth to MongoDB
 * POST /api/auth/sync
 * 
 * This endpoint ensures all Firebase Auth data is replicated to MongoDB.
 * MongoDB is the source of truth for all user data.
 */
export const syncUser = async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, emailVerified, phoneNumber } = req.user;

    // Create Firebase user object for sync
    const firebaseUser = {
      uid,
      email,
      displayName,
      photoURL,
      emailVerified: emailVerified || false,
      phoneNumber: phoneNumber || null,
    };

    // Sync to MongoDB using the sync service
    const user = await syncUserToMongo(firebaseUser);

    // Log the sync operation
    await logDataOperation('sync', 'users', user._id.toString(), uid, {
      source: 'firebase_auth',
      email,
    });

    sendSuccess(res, {
      user: {
        id: user._id,
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
      },
      synced: true,
      source: 'firebase_auth',
      destination: 'mongodb',
    });
  } catch (error) {
    logger.error(`Sync User Error: ${error.message}`, { error });
    sendError(res, 'Failed to sync user to MongoDB', 500);
  }
};


