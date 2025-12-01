import axios from 'axios';
import { auth as firebaseAuth } from '../config/firebase';

// Use relative path when using Vite proxy, or absolute URL if VITE_API_URL is set
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to get fresh Firebase token
const getFirebaseToken = async () => {
  try {
    if (firebaseAuth.currentUser) {
      // Get fresh token from Firebase (will auto-refresh if expired)
      const token = await firebaseAuth.currentUser.getIdToken(false); // false = use cache if valid
      localStorage.setItem('firebaseToken', token);
      return token;
    }
  } catch (error) {
    console.warn('⚠️ Could not get fresh token from Firebase:', error.message);
  }
  
  // Fallback to cached token
  return localStorage.getItem('firebaseToken');
};

// Request interceptor - Add Firebase token
apiClient.interceptors.request.use(
  async (config) => {
    // Get token (fresh from Firebase or cached)
    const token = await getFirebaseToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // Debug logging (only in development)
      if (import.meta.env.DEV) {
        console.log('🔍 Request:', config.method?.toUpperCase(), config.url);
        console.log('🔍 Token attached (length):', token.length);
      }
    } else {
      console.warn('⚠️ No token available for request:', config.url);
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('firebaseToken');
      window.location.href = '/login';
    }
    // Handle 403 Forbidden - Project access denied
    if (error.response?.status === 403 && error.config?.url?.includes('/projects/')) {
      // Store error message for toast display
      error._isAccessDenied = true;
      error._accessDeniedMessage = error.response?.data?.message || 'Access denied. Please join the project first.';
    }
    // Handle 429 Too Many Requests - Rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'] || error.response?.headers?.['Retry-After'];
      const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
      error._isRateLimited = true;
      error._retryAfter = retrySeconds;
      error._rateLimitMessage = error.response?.data?.message || `Too many requests. Please wait ${retrySeconds} seconds before trying again.`;
    }
    return Promise.reject(error);
  }
);

// API methods
export const auth = {
  sync: () => apiClient.post('/auth/sync'),
};

export const projects = {
  create: (data) => apiClient.post('/projects', data),
  getAll: () => apiClient.get('/projects'),
  getById: (projectId) => apiClient.get(`/projects/${projectId}`),
  getRoles: (projectId) => apiClient.get(`/projects/${projectId}/roles`),
  updateRolePermissions: (projectId, roleName, permissions) => 
    apiClient.put(`/projects/${projectId}/roles/${roleName}`, { permissions }),
  join: (projectId, password) => apiClient.post('/projects/join', { projectId, password }),
  update: (projectId, data) => apiClient.put(`/projects/${projectId}`, data),
  regenerateInvite: (projectId) => apiClient.post(`/projects/${projectId}/regenerate-invite`),
  delete: (projectId) => apiClient.delete(`/projects/${projectId}`),
  // Member management
  updateMemberRole: (projectId, memberId, roleId) => 
    apiClient.put(`/projects/${projectId}/members/${memberId}/role`, { roleId }),
};

export const tasks = {
  getByProject: (projectId) => apiClient.get(`/projects/${projectId}/tasks`),
  create: (projectId, data) => apiClient.post(`/projects/${projectId}/tasks`, data),
  update: (taskId, data) => apiClient.put(`/tasks/${taskId}`, data),
  delete: (taskId) => apiClient.delete(`/tasks/${taskId}`),
  startTimer: (taskId) => apiClient.post(`/tasks/${taskId}/start-timer`),
  stopTimer: (taskId) => apiClient.post(`/tasks/${taskId}/stop-timer`),
};

export const financials = {
  getStats: (projectId) => apiClient.get(`/projects/${projectId}/stats`),
  createTransaction: (projectId, data) => apiClient.post(`/projects/${projectId}/transactions`, data),
  getTransactions: (projectId) => apiClient.get(`/projects/${projectId}/transactions`),
};

export default apiClient;


