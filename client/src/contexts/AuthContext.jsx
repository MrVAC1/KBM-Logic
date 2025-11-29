import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { auth as authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get Firebase token
        const token = await firebaseUser.getIdToken();
        localStorage.setItem('firebaseToken', token);

        // CRITICAL: Set syncing state and wait for backend sync
        setIsSyncing(true);
        try {
          await authAPI.sync();
          console.log('✅ User synced to backend successfully');
        } catch (error) {
          console.error('❌ Failed to sync user to backend:', error);
          // Don't block app if sync fails, but log the error
          // User can still use the app, sync will retry on next auth state change
        } finally {
          setIsSyncing(false);
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        localStorage.removeItem('firebaseToken');
        setUser(null);
        setIsSyncing(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email, password) => {
    try {
      setIsSyncing(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      localStorage.setItem('firebaseToken', token);
      
      // CRITICAL: Wait for backend sync before returning
      try {
        await authAPI.sync();
        console.log('✅ User synced after login');
      } catch (syncError) {
        console.error('⚠️ Sync failed after login:', syncError);
        // Don't fail login if sync fails, but log it
      } finally {
        setIsSyncing(false);
      }
      
      return { success: true, user: userCredential.user };
    } catch (error) {
      setIsSyncing(false);
      return { 
        success: false, 
        error: error.message || 'Login failed' 
      };
    }
  };

  const registerWithEmail = async (email, password, displayName) => {
    try {
      setIsSyncing(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name if provided
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: displayName
        });
      }
      
      const token = await userCredential.user.getIdToken();
      localStorage.setItem('firebaseToken', token);
      
      // CRITICAL: Wait for backend sync (which will create the user record)
      try {
        await authAPI.sync();
        console.log('✅ User synced after registration');
      } catch (syncError) {
        console.error('⚠️ Sync failed after registration:', syncError);
        // Don't fail registration if sync fails
      } finally {
        setIsSyncing(false);
      }
      
      return { success: true, user: userCredential.user };
    } catch (error) {
      setIsSyncing(false);
      return { 
        success: false, 
        error: error.message || 'Registration failed' 
      };
    }
  };

  const loginWithGoogle = async () => {
    try {
      setIsSyncing(true);
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      localStorage.setItem('firebaseToken', token);
      
      // CRITICAL: Wait for backend sync
      try {
        await authAPI.sync();
        console.log('✅ User synced after Google login');
      } catch (syncError) {
        console.error('⚠️ Sync failed after Google login:', syncError);
        // Don't fail login if sync fails
      } finally {
        setIsSyncing(false);
      }
      
      return { success: true, user: result.user };
    } catch (error) {
      setIsSyncing(false);
      return { 
        success: false, 
        error: error.message || 'Google login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem('firebaseToken');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    user,
    loading: loading || isSyncing, // Show loading while syncing
    isSyncing,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
  };

  // CRITICAL: Don't render children until BOTH Firebase Auth is done AND Backend Sync is finished
  if (loading || isSyncing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">
            {isSyncing ? 'Syncing with server...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};


