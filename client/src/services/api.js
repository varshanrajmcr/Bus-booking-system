import axios from 'axios';
import { getAccessToken, getRefreshToken, clearTokens, refreshAccessToken } from '../utils/jwtUtils';
import { redirectToLogin } from '../utils/navigation';
import { clearActiveCustomerSession, clearActiveAdminSession } from '../utils/browserSessionManager';

// Use environment variable for API URL in production, or '/api' for development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for session cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor - Add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh and session termination
api.interceptors.response.use(
  (response) => {
      // Check for session termination in successful responses
      if (response.data?.sessionTerminated) {
        clearTokens();
        const userType = response.config?.url?.includes('/admin/') ? 'admin' : 'customer';
        const message = response.data.message || 'Session terminated. Please login again.';
        
        // Clear browser session
        if (userType === 'customer') {
          clearActiveCustomerSession();
        } else {
          clearActiveAdminSession();
        }
        
        // Use React Router navigation (no page reload)
        redirectToLogin(userType, { showAlert: true, alertMessage: message, message });
        return Promise.reject(new Error('Session terminated'));
      }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle session termination
    if (error.response?.data?.sessionTerminated) {
      clearTokens();
      const userType = error.config?.url?.includes('/admin/') ? 'admin' : 'customer';
      const message = error.response.data.message || 'Another user has logged into this account. Please login again.';
      
      // Clear browser session
      if (userType === 'customer') {
        clearActiveCustomerSession();
      } else {
        clearActiveAdminSession();
      }
      
      // Use React Router navigation (no page reload)
      redirectToLogin(userType, { showAlert: true, alertMessage: message, message });
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized - Try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const tokens = await refreshAccessToken();
        processQueue(null, tokens.accessToken);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Clear tokens and redirect to login
        clearTokens();
        const userType = originalRequest.url?.includes('/admin/') ? 'admin' : 'customer';
        const message = 'Session expired. Please login again.';
        
        // Use React Router navigation (no page reload)
        redirectToLogin(userType, { showAlert: true, alertMessage: message, message });
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

