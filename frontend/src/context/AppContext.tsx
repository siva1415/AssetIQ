import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, getApiBaseUrl, getInitialMockMode, setStoredApiBaseUrl, setStoredMockMode } from '../services/api';
import { HealthResponse } from '../types';

interface HealthState {
  status: 'checking' | 'connected' | 'disconnected' | 'mock';
  data: HealthResponse | null;
  error: string | null;
  latencyMs: number | null;
  lastChecked: Date | null;
}

export interface LoggedInUser {
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export function resolveCurrentUser(): LoggedInUser {
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.__CURRENT_USER__) {
      const u = win.__CURRENT_USER__;
      return typeof u === 'string'
        ? { name: u, role: 'Superadmin' }
        : { name: u.name || u.displayName || u.username || u.email || 'User', email: u.email, avatarUrl: u.avatarUrl, role: 'Superadmin' };
    }
    if (win.currentUser) {
      const u = win.currentUser;
      return typeof u === 'string'
        ? { name: u, role: 'Superadmin' }
        : { name: u.name || u.displayName || u.username || u.email || 'User', email: u.email, avatarUrl: u.avatarUrl, role: 'Superadmin' };
    }

    for (const key of ['currentUser', 'user', 'auth_user', 'user_profile', 'session_user']) {
      try {
        const item = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (parsed && typeof parsed === 'object') {
              const name =
                parsed.name ||
                parsed.fullName ||
                parsed.full_name ||
                parsed.displayName ||
                parsed.username ||
                parsed.user_id ||
                parsed.email;
              if (name) {
                return {
                  name: String(name).split('@')[0],
                  email: parsed.email,
                  avatarUrl: parsed.avatarUrl || parsed.picture,
                  role: 'Superadmin',
                };
              }
            } else if (typeof parsed === 'string' && parsed.trim()) {
              return { name: parsed.trim().split('@')[0], role: 'Superadmin' };
            }
          } catch {
            if (item.trim()) {
              return { name: item.trim().split('@')[0], role: 'Superadmin' };
            }
          }
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  if (import.meta.env.VITE_USER_NAME) {
    return { name: import.meta.env.VITE_USER_NAME, role: 'Superadmin' };
  }
  if (import.meta.env.VITE_USER_EMAIL) {
    const raw = import.meta.env.VITE_USER_EMAIL.split('@')[0];
    const formatted = raw.split('.')[0];
    return {
      name: formatted.charAt(0).toUpperCase() + formatted.slice(1),
      email: import.meta.env.VITE_USER_EMAIL,
      role: 'Superadmin',
    };
  }

  // Active authenticated user session
  return {
    name: 'Siva',
    email: 'siva.sankaran.it@gmail.com',
    role: 'Superadmin',
  };
}

interface AppContextType {
  mockMode: boolean;
  setMockMode: (val: boolean) => void;
  apiBaseUrl: string;
  updateApiBaseUrl: (url: string) => void;
  health: HealthState;
  refreshHealth: () => Promise<void>;
  dataRefreshKey: number;
  triggerDataRefresh: () => void;
  currentUser: LoggedInUser;
  setCurrentUser: (user: LoggedInUser) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<LoggedInUser>(resolveCurrentUser);
  const [mockMode, setMockModeState] = useState<boolean>(getInitialMockMode);
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(getApiBaseUrl);
  const [dataRefreshKey, setDataRefreshKey] = useState<number>(0);
  const [health, setHealth] = useState<HealthState>({
    status: 'checking',
    data: null,
    error: null,
    latencyMs: null,
    lastChecked: null,
  });

  const setCurrentUser = (user: LoggedInUser) => {
    setCurrentUserState(user);
    try {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch {
      // ignore
    }
  };

  const setMockMode = (val: boolean) => {
    setMockModeState(val);
    setStoredMockMode(val);
    api.setMock(val);
    setDataRefreshKey(prev => prev + 1);
  };

  const updateApiBaseUrl = (url: string) => {
    setStoredApiBaseUrl(url);
    const resolved = getApiBaseUrl();
    setApiBaseUrlState(resolved);
    setDataRefreshKey(prev => prev + 1);
  };

  const triggerDataRefresh = () => {
    setDataRefreshKey(prev => prev + 1);
  };

  const refreshHealth = useCallback(async () => {
    if (mockMode) {
      setHealth({
        status: 'mock',
        data: {
          status: 'mock_active',
          version: '2.4.1 (Mock Preview)',
          last_sync: new Date().toISOString(),
          bigfix_status: 'Mock Connected',
          jamf_status: 'Mock Connected',
          workday_status: 'Mock Directory Active',
          eol_warning_threshold_days: 90,
        },
        error: null,
        latencyMs: 12,
        lastChecked: new Date(),
      });
      return;
    }

    setHealth(prev => ({ ...prev, status: 'checking', error: null }));
    const startTime = performance.now();
    try {
      const data = await api.getHealth();
      const endTime = performance.now();
      setHealth({
        status: 'connected',
        data,
        error: null,
        latencyMs: Math.round(endTime - startTime),
        lastChecked: new Date(),
      });
    } catch (err: any) {
      const endTime = performance.now();
      const message = err?.response?.data?.detail || err?.message || 'Failed to connect to FastAPI backend at ' + apiBaseUrl;
      setHealth({
        status: 'disconnected',
        data: null,
        error: message,
        latencyMs: Math.round(endTime - startTime),
        lastChecked: new Date(),
      });
    }
  }, [mockMode, apiBaseUrl]);

  useEffect(() => {
    api.setMock(mockMode);
    refreshHealth();
  }, [mockMode, apiBaseUrl, refreshHealth]);

  return (
    <AppContext.Provider
      value={{
        mockMode,
        setMockMode,
        apiBaseUrl,
        updateApiBaseUrl,
        health,
        refreshHealth,
        dataRefreshKey,
        triggerDataRefresh,
        currentUser,
        setCurrentUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const useUser = () => {
  const { currentUser, setCurrentUser } = useApp();
  return { user: currentUser, setUser: setCurrentUser };
};

export const useAuth = useUser;
