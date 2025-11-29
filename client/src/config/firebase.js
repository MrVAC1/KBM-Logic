import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAd7TDc3tzlPsBztVnT-7RXD52L94o4FH0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "kbm-logic.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "kbm-logic",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "kbm-logic.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "849449889272",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:849449889272:web:ced9009c32f01dbb8a7a0d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-7P371KVDHV",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
export default app;

