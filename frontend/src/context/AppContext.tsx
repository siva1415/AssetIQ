import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, getApiBaseUrl, getInitialMockMode, setStoredApiBaseUrl, setStoredMockMode } from '../services/api';
import { HealthResponse, PortalRole, LoginResponse } from '../types';
import { normalizeRole } from '../config/menuConfig';

interface HealthState {
  status: 'checking' | 'connected' | 'disconnected' | 'mock';
  data: HealthResponse | null;
  error: string | null;
  latencyMs: number | null;
  lastChecked: Date | null;
}

export interface LoggedInUser {
  id?: string | number;
  username: string;
  name: string;
  email?: string;
  role: PortalRole;
  avatarUrl?: string;
  must_reset_password?: boolean;
  last_login_at?: string | null;
  last_login?: string | null;
}

export const AUTH_SESSION_KEY = 'asset_iq_auth_session';

const DEFAULT_GUEST_USER: LoggedInUser = {
  username: '',
  name: '',
  email: '',
  role: 'VIEWER',
  must_reset_password: false,
};

export function resolveCurrentUser(): LoggedInUser {
  if (typeof window !== 'undefined') {
    try {
      const sessionRaw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw);
        if (parsed && parsed.authenticated && parsed.user) {
          const u = parsed.user;
          return {
            id: u.id || u.user_id,
            username: u.username || '',
            name: u.full_name || u.name || u.username || 'User',
            email: u.email || '',
            role: normalizeRole(u.role),
            avatarUrl: u.avatarUrl,
            must_reset_password: Boolean(u.must_reset_password || parsed.must_reset_password),
            last_login_at: u.last_login_at || u.last_login || null,
            last_login: u.last_login || u.last_login_at || null,
          };
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  return DEFAULT_GUEST_USER;
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
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  markPasswordResetComplete: () => void;
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

  const login = useCallback(async (username: string, password: string): Promise<LoginResponse> => {
    const res = await api.login({ username, password });

    // Normalize user data and role from login response
    const roleRaw = res.role || res.user?.role;
    const role = normalizeRole(roleRaw);
    const mustReset = Boolean(
      res.must_reset_password === true ||
      res.user?.must_reset_password === true ||
      String(res.must_reset_password).toUpperCase() === 'TRUE'
    );
    const fullName = res.full_name || res.name || res.user?.full_name || res.username || username;
    const email = res.email || res.user?.email || '';

    const lastLoginAt =
      res.last_login_at ||
      res.user?.last_login_at ||
      (res.user as any)?.last_login ||
      (res as any)?.last_login ||
      null;

    const authenticatedUser: LoggedInUser = {
      id: res.user?.id || res.user?.user_id,
      username: res.username || res.user?.username || username,
      name: fullName,
      email,
      role,
      must_reset_password: mustReset,
      avatarUrl: res.user?.avatarUrl,
      last_login_at: lastLoginAt,
      last_login: lastLoginAt,
    };

    const sessionPayload = JSON.stringify({
      authenticated: true,
      user: authenticatedUser,
      token: res.token || res.access_token,
      must_reset_password: mustReset,
      session_created_at: Date.now(),
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
    return res;
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentUser');
      localStorage.removeItem('asset_iq_auth_token');
      sessionStorage.removeItem('asset_iq_auth_token');
    } catch {
      // ignore storage errors
    }
    setCurrentUserState(DEFAULT_GUEST_USER);
    setIsAuthenticated(false);
  }, []);

  const markPasswordResetComplete = useCallback(() => {
    setCurrentUserState(prev => {
      const updated: LoggedInUser = { ...prev, must_reset_password: false };
      try {
        const sessionRaw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
        if (sessionRaw) {
          const parsed = JSON.parse(sessionRaw);
          parsed.must_reset_password = false;
          if (parsed.user) parsed.user.must_reset_password = false;
          sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsed));
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsed));
        }
        localStorage.setItem('currentUser', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
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
        markPasswordResetComplete,
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
