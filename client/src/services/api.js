import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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

