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

const AUTH_SESSION_KEY = 'asset_iq_auth_session';

export function resolveCurrentUser(): LoggedInUser {
  if (typeof window !== 'undefined') {
    try {
      const sessionRaw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw);
        if (parsed && parsed.user && parsed.user.name) {
          return {
            name: parsed.user.name,
            email: parsed.user.email || 'siva.sankaran.it@gmail.com',
            role: parsed.user.role || 'Admin',
            avatarUrl: parsed.user.avatarUrl,
          };
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  return {
    name: 'Siva',
    email: 'siva.sankaran.it@gmail.com',
    role: 'Admin',
  };
}

function getInitialAuthState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.authenticated === true);
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

const SIDEBAR_COLLAPSED_KEY = 'assetiq_sidebar_collapsed';

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
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
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  toggleSidebarCollapse: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(getInitialAuthState);
  const [currentUser, setCurrentUserState] = useState<LoggedInUser>(resolveCurrentUser);
  const [mockMode, setMockModeState] = useState<boolean>(getInitialMockMode);
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(getApiBaseUrl);
  const [dataRefreshKey, setDataRefreshKey] = useState<number>(0);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(getInitialSidebarCollapsed);
  const [health, setHealth] = useState<HealthState>({
    status: 'checking',
    data: null,
    error: null,
    latencyMs: null,
    lastChecked: null,
  });

  const setSidebarCollapsed = (val: boolean) => {
    setSidebarCollapsedState(val);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(val));
    } catch {
      // ignore storage errors
    }
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsedState(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const setCurrentUser = (user: LoggedInUser) => {
    setCurrentUserState(user);
    try {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch {
      // ignore
    }
  };

  const login = useCallback((username: string, password: string): boolean => {
    if (username.trim() === 'admin' && password === 'admin') {
      const authenticatedUser: LoggedInUser = {
        name: 'Siva',
        email: 'siva.sankaran.it@gmail.com',
        role: 'Admin',
      };
      const sessionPayload = JSON.stringify({
        authenticated: true,
        user: authenticatedUser,
        timestamp: Date.now(),
      });
      try {
        sessionStorage.setItem(AUTH_SESSION_KEY, sessionPayload);
        localStorage.setItem(AUTH_SESSION_KEY, sessionPayload);
        localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
      } catch {
        // ignore storage errors
      }
      setCurrentUserState(authenticatedUser);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentUser');
    } catch {
      // ignore storage errors
    }
    setIsAuthenticated(false);
  }, []);

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
        isAuthenticated,
        login,
        logout,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebarCollapse,
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
  const { currentUser, setCurrentUser, isAuthenticated, login, logout } = useApp();
  return { user: currentUser, setUser: setCurrentUser, isAuthenticated, login, logout };
};

export const useAuth = useUser;
