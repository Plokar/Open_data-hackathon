'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authApi, refreshSession, type RegisterData, type User } from '@/lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  /** Načte aktuálního uživatele ze serveru */
  const refreshUser = useCallback(async () => {
    try {
      let status = await authApi.checkStatus();
      // Access cookie mohla vypršet (prod 15 min), refresh cookie ještě žije
      if (!status.authenticated && status.can_refresh && (await refreshSession())) status = await authApi.checkStatus();
      setState({
        user: status.user,
        isAuthenticated: status.authenticated,
        isLoading: false,
      });
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  // Při mountu zkontrolovat auth status (JWT cookie)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- načtení přihlášení z API po mountu
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await authApi.login({ username, password });
      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    },
    [],
  );

  const register = useCallback(
    async (data: RegisterData) => {
      const response = await authApi.register(data);
      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- záměrně celý reload, router.push by nechal router cache přihlášeného hráče
      window.location.href = '/';
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
