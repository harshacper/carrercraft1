import axios from 'axios';
import safeStorage from './safeStorage';

const api = axios.create({
  baseURL: '/_/backend/api',
});

// Add interceptor to include token in headers
api.interceptors.request.use((config) => {
  const token = safeStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
