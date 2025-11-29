import admin from '../config/firebase.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { sendError } from '../utils/response.js';

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // DEBUG: Log auth header (without full token for security)
    console.log('🔍 Auth Header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING');
    console.log('🔍 Request URL:', req.originalUrl || req.url);
    console.log('🔍 Request Method:', req.method);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No token provided in Authorization header');
      return sendError(res, 'Unauthorized: No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.error('❌ Token is empty after Bearer prefix');
      return sendError(res, 'Unauthorized: Invalid token format', 401);
    }

    console.log('🔍 Token extracted (length):', token.length);

    // Verify Firebase token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('✅ Token verified successfully');
      console.log('✅ Firebase UID:', decodedToken.uid);
      console.log('✅ Firebase Email:', decodedToken.email);
    } catch (firebaseError) {
      console.error('❌ Firebase token verification failed:', firebaseError.message);
      console.error('❌ Error code:', firebaseError.code);
      logger.error(`Firebase Token Verification Error: ${firebaseError.message}`, { error: firebaseError });
      return sendError(res, 'Unauthorized: Invalid or expired token', 401);
    }

    req.user = decodedToken;

    // Fetch or create user in DB
    let dbUser = await User.findOne({ uid: decodedToken.uid });
    if (!dbUser) {
      console.log('ℹ️ User not found in DB, creating new user...');
      // Create user if doesn't exist
      dbUser = await User.create({
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email?.split('@')[0],
        role: 'Pending',
      });
      logger.info(`New user created: ${decodedToken.uid}`);
      console.log('✅ New user created in DB:', dbUser._id);
    } else {
      console.log('✅ User found in DB:', dbUser._id);
      console.log('✅ DB User UID:', dbUser.uid);
    }

    // Verify UID match
    if (dbUser.uid !== decodedToken.uid) {
      console.error('❌ UID mismatch!');
      console.error('   Firebase UID:', decodedToken.uid);
      console.error('   DB User UID:', dbUser.uid);
      return sendError(res, 'Unauthorized: User UID mismatch', 401);
    }

    req.dbUser = dbUser;
    console.log('✅ Auth middleware passed, proceeding to next middleware');
    next();
  } catch (error) {
    console.error('❌ Auth Middleware Error:', error.message);
    console.error('❌ Error stack:', error.stack);
    logger.error(`Auth Middleware Error: ${error.message}`, { error });
    // Return 401 for authentication errors, not 403
    return sendError(res, 'Unauthorized: Authentication failed', 401);
  }
};


