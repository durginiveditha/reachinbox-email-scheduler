import axios from 'axios';
import { User, EmailJob, EmailBatch, EmailStats, PaginatedResponse, ScheduleEmailPayload } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  getMe: () => api.get<User>('/auth/me').then((r) => r.data),
  logout: () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  },
  googleLogin: () => {
    window.location.href = `${BASE_URL}/auth/google`;
  },
};

export const emailApi = {
  schedule: (payload: ScheduleEmailPayload, csvFile?: File) => {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined) form.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    });
    if (csvFile) form.append('csv', csvFile);
    return api.post('/emails/schedule', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  getScheduled: (page = 1, search?: string) =>
    api.get<PaginatedResponse<EmailJob>>('/emails/scheduled', { params: { page, search } }).then((r) => r.data),
  getSent: (page = 1, search?: string) =>
    api.get<PaginatedResponse<EmailJob>>('/emails/sent', { params: { page, search } }).then((r) => r.data),
  getBatches: () => api.get<EmailBatch[]>('/emails/batches').then((r) => r.data),
  getStats: () => api.get<EmailStats>('/emails/stats').then((r) => r.data),
  search: (q: string, status?: string) =>
    api.get<PaginatedResponse<EmailJob>>('/emails/search', { params: { q, status } }).then((r) => r.data),
};

export const slackApi = {
  connect: async () => {
    const response = await api.get('/slack/connect-url');
    window.location.href = response.data.url;
  },

  disconnect: () =>
    api.delete('/slack/disconnect').then((r) => r.data),
};
export default api;
