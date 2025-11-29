// Global type declarations for modules without TypeScript definitions

declare module '@/contexts/AuthContext' {
  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  }

  export interface AuthResult {
    success: boolean;
    error?: string;
    user?: any;
  }

  export interface AuthContextType {
    user: User | null;
    loading: boolean;
    loginWithEmail: (email: string, password: string) => Promise<AuthResult>;
    registerWithEmail: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
    loginWithGoogle: () => Promise<AuthResult>;
    logout: () => Promise<void>;
  }

  export function useAuth(): AuthContextType;
}

declare module '@/contexts/ProjectContext' {
  export interface Project {
    id?: string;
    _id?: string;
    name: string;
    description?: string;
    ownerId?: string | { uid: string; email: string; displayName: string };
    status?: string;
    isSafeView?: boolean;
    [key: string]: any;
  }

  export interface UserAccess {
    isOwner: boolean;
    isPending: boolean;
    permissions: string[];
    role?: string;
  }

  export interface ProjectContextType {
    currentProject: Project | null;
    userAccess: UserAccess | null;
    loading: boolean;
    error: string | null;
    loadProject: (projectId: string) => Promise<void>;
    clearProject: () => void;
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (permissions: string[]) => boolean;
    hasAllPermissions: (permissions: string[]) => boolean;
    isOwner: () => boolean;
    hasAnyAccess: () => boolean;
    isPendingAccess: () => boolean;
    getUserRole: () => string;
    updateMemberRole: (memberId: string, roleId: string) => Promise<void>;
  }

  export function useProject(): ProjectContextType;
}

declare module '@/config/firebase' {
  import { Auth } from 'firebase/auth';
  export const auth: Auth;
  export const firebaseAuth: Auth;
}

declare module 'firebase/auth' {
  export function sendPasswordResetEmail(auth: any, email: string): Promise<void>;
  export * from 'firebase/auth';
}

