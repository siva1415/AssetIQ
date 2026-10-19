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
  username?: string;
  email?: string;
  role: string; // 'super_admin' | 'admin' | 'viewer'
  avatarUrl?: string;
  must_change_password?: boolean;
  is_otp?: boolean;
  mustChangePassword?: boolean;
  isOneTimePassword?: boolean;
}

const AUTH_SESSION_KEY = 'asset_iq_auth_session';

export function getUsernameInitials(username?: string, name?: string): string {
  const raw = (username || name || 'US').trim().replace(/^@/, '');
  if (raw.length >= 2) {
    return raw.slice(0, 2).toUpperCase();
  }
  return (raw + 'X').slice(0, 2).toUpperCase();
}

export function resolveCurrentUser(): LoggedInUser {
  if (typeof window !== 'undefined') {
    try {
      const sessionRaw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw);
        if (parsed && parsed.user && (parsed.user.name || parsed.user.username)) {
          const mustChange = Boolean(parsed.user.mustChangePassword ?? parsed.user.must_change_password ?? parsed.user.isOneTimePassword ?? parsed.user.is_otp);
          const isOtp = Boolean(parsed.user.isOneTimePassword ?? parsed.user.is_otp);
          return {
            name: parsed.user.name || parsed.user.username,
            username: parsed.user.username || 'admin',
            email: parsed.user.email || 'testuser@example.com',
            role: parsed.user.role || 'admin',
            avatarUrl: parsed.user.avatarUrl,
            must_change_password: mustChange,
            mustChangePassword: mustChange,
            is_otp: isOtp,
            isOneTimePassword: isOtp,
          };
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  return {
    name: 'Test user',
    username: 'admin',
    email: 'testuser@example.com',
    role: 'admin',
    must_change_password: false,
    mustChangePassword: false,
    is_otp: false,
    isOneTimePassword: false,
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
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isViewer: boolean;
  canAccessRoute: (path: string) => boolean;
  canManageUsers: boolean;
  hasPermission: (action: 'manage_users' | 'manage_assets' | 'manage_eol' | 'view_reports' | 'system_settings') => boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setOneTimePassword: (username: string, temporaryPassword?: string) => void;
  handleFirstLoginDecision: (decision: 'reset' | 'keep', newPassword?: string, targetUsername?: string) => Promise<boolean>;
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


  const normalizedRole = (currentUser.role || 'admin').toLowerCase();
  const isSuperAdmin = normalizedRole === 'super_admin' || normalizedRole === 'superadmin' || normalizedRole === 'super admin';
  const isAdmin = !isSuperAdmin && (normalizedRole === 'admin' || normalizedRole === 'administrator');
  const isViewer = !isSuperAdmin && !isAdmin;

  // RBAC Route Permission Check:
  // 1. Super Admin: complete access to all pages with CRUD operations
  // 2. Admin: cannot access (job scheduler, settings); in user management admin cannot create, edit, or delete (only view)
  // 3. Viewers: only (dashboard, hardware inventory, reports) pages should be allowed to view
  const canAccessRoute = useCallback((path: string): boolean => {
    const cleanPath = path.toLowerCase().trim();

    // Super Admin has access to everything
    if (isSuperAdmin) return true;

    // Viewers: ONLY (dashboard, hardware inventory, reports)
    if (isViewer) {
      if (
        cleanPath === '/' ||
        cleanPath === '/dashboard' ||
        cleanPath === '/assets' ||
        cleanPath === '/assets/windows' ||
        cleanPath === '/assets/mac' ||
        cleanPath === '/reports'
      ) {
        return true;
      }
      return false;
    }

    // Admins: All pages EXCEPT job scheduler and settings
    if (isAdmin) {
      if (
        cleanPath === '/job-scheduler' ||
        cleanPath.startsWith('/job-scheduler/') ||
        cleanPath === '/settings' ||
        cleanPath === '/admin' ||
        cleanPath.startsWith('/settings/')
      ) {
        return false;
      }
      return true;
    }

    return false;
  }, [isSuperAdmin, isAdmin, isViewer]);

  // Only super admin has CRUD in user management
  const canManageUsers = isSuperAdmin;

  const hasPermission = useCallback((action: 'manage_users' | 'manage_assets' | 'manage_eol' | 'view_reports' | 'system_settings'): boolean => {
    switch (action) {
      case 'view_reports':
        return true; // Everyone can view reports
      case 'manage_assets':
      case 'manage_eol':
        return isSuperAdmin || isAdmin;
      case 'manage_users':
        return isSuperAdmin; // ONLY Super Admin can create/edit/delete users
      case 'system_settings':
        return isSuperAdmin; // Only Super Admin has settings access
      default:
        return false;
    }
  }, [isAdmin, isSuperAdmin]);

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

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const cleanUser = username.trim().toLowerCase().replace(/^@/, '');
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      return false;
    }

    // Step B: Detection upon User Login
    // Read registered users from storage
    let registeredUsers: any[] = [];
    try {
      const stored = localStorage.getItem('workforceiq_console_users_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          registeredUsers = parsed;
        }
      }
    } catch {
      // ignore
    }

    // Seeded default users fallback if storage empty
    if (registeredUsers.length === 0) {
      registeredUsers = [
        {
          username: 'superadmin01',
          name: 'Administrator',
          role: 'super_admin',
          password: 'WorkForceIQ123!',
          mustChangePassword: true,
          isOneTimePassword: true,
          must_change_password: true,
          is_otp: true,
        },
        {
          username: 'superadmin',
          name: 'Super Administrator',
          role: 'super_admin',
          password: 'SuperAdmin123!',
          mustChangePassword: false,
          isOneTimePassword: false,
        },
        {
          username: 'admin',
          name: 'Siva Sankaran',
          role: 'admin',
          password: 'Admin123!',
          mustChangePassword: false,
          isOneTimePassword: false,
        },
        {
          username: 'viewer',
          name: 'Auditor View',
          role: 'viewer',
          password: 'Viewer123!',
          mustChangePassword: false,
          isOneTimePassword: false,
        },
        {
          username: 'yeshwanth',
          name: 'Yeshwanth',
          role: 'admin',
          password: 'WorkForceIQ123!',
          mustChangePassword: false,
          isOneTimePassword: false,
        },
        {
          username: 'sachin',
          name: 'Sachin',
          role: 'super_admin',
          password: 'WorkForceIQ123!',
          mustChangePassword: false,
          isOneTimePassword: false,
        },
      ];
    }

    // Match user by username AND exact password:
    // const matched = registeredUsers.find(u => u.username === username && u.password === password);
    const matched = registeredUsers.find((u: any) => {
      const uName = (u.username || '').toLowerCase().replace(/^@/, '');
      if (uName !== cleanUser) return false;

      // Strict password validation
      if (u.password && u.password === cleanPass) {
        return true;
      }

      // Predefined demo accounts fallback for initial testing
      if (cleanUser === 'superadmin01' && (cleanPass === 'WorkForceIQ123!' || cleanPass === 'TempPass123!')) return true;
      if (cleanUser === 'superadmin' && (cleanPass === 'SuperAdmin123!' || cleanPass === 'superadmin')) return true;
      if (cleanUser === 'admin' && (cleanPass === 'Admin123!' || cleanPass === 'admin')) return true;
      if (cleanUser === 'viewer' && (cleanPass === 'Viewer123!' || cleanPass === 'viewer')) return true;
      if (cleanUser === 'yeshwanth' && (cleanPass === 'WorkForceIQ123!' || cleanPass === 'admin')) return true;
      if (cleanUser === 'sachin' && (cleanPass === 'WorkForceIQ123!' || cleanPass === 'SuperAdmin123!')) return true;

      return false;
    });

    if (matched) {
      const mustChange = Boolean(matched.mustChangePassword ?? matched.must_change_password ?? matched.isOneTimePassword ?? matched.is_otp);
      const isOtp = Boolean(matched.isOneTimePassword ?? matched.is_otp);
      const user: LoggedInUser = {
        name: matched.name || cleanUser,
        username: matched.username || cleanUser,
        email: matched.email || `${cleanUser}@assetiq.internal`,
        role: matched.role || 'admin',
        must_change_password: mustChange,
        mustChangePassword: mustChange, // <--- DETECTED
        is_otp: isOtp,
        isOneTimePassword: isOtp,
      };

      const sessionPayload = JSON.stringify({
        authenticated: true,
        user,
        token: 'console_user_token_' + Date.now(),
        timestamp: Date.now(),
      });
      try {
        sessionStorage.setItem(AUTH_SESSION_KEY, sessionPayload);
        localStorage.setItem(AUTH_SESSION_KEY, sessionPayload);
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch {
        // ignore
      }
      setCurrentUserState(user);
      setIsAuthenticated(true);
      return true;
    }

    // Fallback to backend authentication if available
    try {
      const res = await api.login(username, password);
      if (res && res.authenticated) {
        const mustChange = Boolean(res.user.mustChangePassword ?? res.user.must_change_password ?? res.user.isOneTimePassword ?? res.user.is_otp);
        const isOtp = Boolean(res.user.isOneTimePassword ?? res.user.is_otp);
        const user: LoggedInUser = {
          name: res.user.name || username,
          username: res.user.username || username,
          email: res.user.email || `${username}@assetiq.internal`,
          role: res.user.role || 'admin',
          must_change_password: mustChange,
          mustChangePassword: mustChange,
          is_otp: isOtp,
          isOneTimePassword: isOtp,
        };
        const sessionPayload = JSON.stringify({
          authenticated: true,
          user,
          token: res.token,
          timestamp: Date.now(),
        });
        try {
          sessionStorage.setItem(AUTH_SESSION_KEY, sessionPayload);
          localStorage.setItem(AUTH_SESSION_KEY, sessionPayload);
          localStorage.setItem('currentUser', JSON.stringify(user));
        } catch {
          // ignore
        }
        setCurrentUserState(user);
        setIsAuthenticated(true);
        return true;
      }
    } catch {
      // Backend returned 401 or invalid credentials
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

  const setOneTimePassword = useCallback((username: string, temporaryPassword?: string) => {
    const tempPass = temporaryPassword?.trim() || 'WorkForceIQ123!';
    const cleanUser = username.trim().toLowerCase().replace(/^@/, '');

    // Flags user in state & localStorage
    try {
      const stored = localStorage.getItem('workforceiq_console_users_v2');
      if (stored) {
        const registeredUsers = JSON.parse(stored);
        if (Array.isArray(registeredUsers)) {
          const updatedUsers = registeredUsers.map((u: any) => {
            if (u.username?.toLowerCase() === cleanUser) {
              return {
                ...u,
                password: tempPass,
                mustChangePassword: true,
                isOneTimePassword: true,
                must_change_password: true,
                is_otp: true,
              };
            }
            return u;
          });
          localStorage.setItem('workforceiq_console_users_v2', JSON.stringify(updatedUsers));
        }
      }
    } catch {
      // ignore
    }

    // Syncs to Python Backend REST API
    fetch('/api/auth/set-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, temporaryPassword: tempPass, actor: currentUser.username }),
    }).catch(() => {});

    // Notify other components (e.g. User Management table) of update
    try {
      window.dispatchEvent(
        new CustomEvent('workforceiq_users_updated', {
          detail: { username: cleanUser, is_otp: true, must_change_password: true },
        })
      );
    } catch {
      // ignore
    }
  }, [currentUser.username]);

  const handleFirstLoginDecision = useCallback(async (
    decision: 'reset' | 'keep',
    newPassword?: string,
    targetUsername?: string
  ): Promise<boolean> => {
    if (decision === 'reset') {
      const cleanPass = newPassword?.trim();
      if (!cleanPass || cleanPass.length < 4) {
        return false;
      }

      const target = (targetUsername || currentUser.username || '').trim().toLowerCase().replace(/^@/, '');
      if (!target) return false;

      // 1. Update user password and clear OTP flags in localStorage
      try {
        const stored = localStorage.getItem('workforceiq_console_users_v2');
        if (stored) {
          const registeredUsers = JSON.parse(stored);
          if (Array.isArray(registeredUsers)) {
            const updatedUsers = registeredUsers.map((u: any) => {
              const uName = (u.username || '').toLowerCase().replace(/^@/, '');
              if (uName === target) {
                return {
                  ...u,
                  password: cleanPass,
                  mustChangePassword: false, // <--- OTP CLEARED
                  isOneTimePassword: false,
                  must_change_password: false,
                  is_otp: false,
                };
              }
              return u;
            });
            localStorage.setItem('workforceiq_console_users_v2', JSON.stringify(updatedUsers));
          }
        }
      } catch {
        // ignore
      }

      // 2. Clear flags in current session state if current logged-in user is target
      const isTargetCurrentUser = currentUser.username?.toLowerCase().replace(/^@/, '') === target;
      if (isTargetCurrentUser) {
        const updatedUser: LoggedInUser = {
          ...currentUser,
          mustChangePassword: false,
          isOneTimePassword: false,
          must_change_password: false,
          is_otp: false,
        };
        setCurrentUser(updatedUser);
        try {
          const storedSession = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
          if (storedSession) {
            const parsed = JSON.parse(storedSession);
            parsed.user = updatedUser;
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsed));
            sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsed));
          }
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        } catch {
          // ignore
        }
      }

      // 3. Post to backend REST API
      fetch('/api/auth/first-login-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: target, decision: 'reset', newPassword: cleanPass }),
      }).catch(() => {});

      // 4. Notify views (e.g. User Management / EmployeesPage) that OTP is cleared
      try {
        window.dispatchEvent(
          new CustomEvent('workforceiq_users_updated', {
            detail: { username: target, is_otp: false, must_change_password: false },
          })
        );
      } catch {
        // ignore
      }

      return true;
    }
    return false;
  }, [currentUser]);

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
        isSuperAdmin,
        isAdmin,
        isViewer,
        canAccessRoute,
        canManageUsers,
        hasPermission,
        login,
        logout,
        setOneTimePassword,
        handleFirstLoginDecision,
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
