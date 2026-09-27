'use client';
import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { authApi } from '../lib/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      const u = await authApi.getMe();
      setUser(u);
    } catch {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const logout = () => {
    setUser(null);
    authApi.logout();
  };

  return { user, loading, logout, refetch: fetchUser };
}
