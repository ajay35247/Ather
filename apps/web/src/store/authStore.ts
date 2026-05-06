import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  bio?: string;
  isVerified: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { username: string; displayName: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('ather_access_token', data.data.accessToken);
      localStorage.setItem('ather_refresh_token', data.data.refreshToken);
      set({ user: data.data.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (payload) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/register', payload);
      localStorage.setItem('ather_access_token', data.data.accessToken);
      localStorage.setItem('ather_refresh_token', data.data.refreshToken);
      set({ user: data.data.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('ather_access_token');
    localStorage.removeItem('ather_refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ather_access_token') : null;
    if (!token) return;
    try {
      const { data } = await api.get('/api/auth/me');
      set({ user: data.data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
