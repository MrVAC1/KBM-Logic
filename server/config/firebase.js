import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = join(__dirname, '..', 'firebase-service-account.json');

try {
  if (!admin.apps.length) {
    // Prefer service account JSON file if it exists
    if (existsSync(serviceAccountPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });
      logger.info('Firebase Admin initialized from service account file');
    } else {
      // Fallback to environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          type: 'service_account',
          project_id: process.env.FIREBASE_PROJECT_ID || 'kbm-logic',
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
          universe_domain: 'googleapis.com',
        }),
      });
      logger.info('Firebase Admin initialized from environment variables');
    }
  }
} catch (error) {
  logger.error(`Firebase initialization error: ${error.message}`, { error });
  throw error;
}

export default admin;

