import axios from 'axios';
import { auth } from '../lib/firebase';

const getBaseURL = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // In production browser environment where NEXT_PUBLIC_API_URL wasn't built in, default to relative /api
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '/api';
  }
  return 'http://localhost:5000/api';
};

const API = axios.create({
  baseURL: getBaseURL(),
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach Firebase ID Token
API.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    let token = null;

    // 1. Try to get the latest token from active Firebase Auth session
    if (auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch (err) {
        console.warn('Failed to retrieve token from active Firebase session:', err);
      }
    }

    // 2. Fallback to localStorage if Firebase isn't initialized/ready yet
    if (!token) {
      const userJson = localStorage.getItem('alpha_zone_user');
      if (userJson) {
        const user = JSON.parse(userJson);
        token = user.token;
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor — only reject, never auto-logout
API.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default API;
