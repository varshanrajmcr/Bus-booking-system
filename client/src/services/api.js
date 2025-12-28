import axios from 'axios';

// Use environment variable for API URL in production, or '/api' for development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for session cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for session termination
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.sessionTerminated) {
      // Handle session termination
      const userType = error.config?.url?.includes('/admin/') ? 'admin' : 'customer';
      window.location.href = `/${userType}/login?message=${encodeURIComponent(error.response.data.message)}`;
    }
    return Promise.reject(error);
  }
);

export default api;

