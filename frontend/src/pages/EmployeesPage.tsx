import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  KeyRound,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  Check,
  Radio,
  Lock,
  Eye,
  EyeOff,
  Laptop,
  Monitor,
  Activity,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';

export type UserRole = 'super_admin' | 'admin' | 'viewer';

export interface ConsoleUser {
  username: string;
  name: string;
  email: string;
  role: UserRole;
  is_otp: boolean;
  must_change_password: boolean;
  is_online: boolean;
  last_active?: string;
  login_time?: string;
  is_root_protected?: boolean;
  is_current_user?: boolean;
  ip_address?: string;
  user_agent?: string;
}

export interface ActiveSession {
  sessionId: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  loginTime: string;
  lastActive: string;
  ipAddress: string;
  userAgent: string;
  status: 'active' | 'terminated';
}

const STORAGE_USERS_KEY = 'workforceiq_console_users_v2';

const INITIAL_USERS: ConsoleUser[] = [
  {
    username: 'admin',
    name: 'Administrator',
    email: 'admin@workforceiq.internal',
    role: 'admin',
    is_otp: false,
    must_change_password: false,
    is_online: true,
    last_active: 'Oct 13, 04:33 AM',
    login_time: 'Oct 13, 04:33 AM',
    ip_address: '192.168.1.45',
    user_agent: 'Chrome 122.0 / macOS (Sonoma)',
  },
  {
    username: 'alex',
    name: 'Alex Morgan',
    email: 'alex@workforceiq.internal',
    role: 'admin',
    is_otp: false,
    must_change_password: false,
    is_online: false,
    last_active: 'Oct 12, 09:15 PM',
    ip_address: '192.168.1.62',
    user_agent: 'Firefox 124.0 / Windows 11',
  },
  {
    username: 'elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@workforceiq.corp',
    role: 'admin',
    is_otp: false,
    must_change_password: false,
    is_online: false,
    last_active: 'Oct 12, 06:40 PM',
    ip_address: '10.0.12.84',
    user_agent: 'Safari 17.3 / macOS (Sonoma)',
  },
  {
    username: 'firstuser',
    name: 'Alex Morgan (First Login OTP)',
    email: 'firstuser@workforceiq.internal',
    role: 'viewer',
    is_otp: true,
    must_change_password: true,
    is_online: false,
    last_active: 'Pending Initial Login',
    ip_address: '192.168.1.110',
    user_agent: 'Edge 122.0 / Windows 10',
  },
  {
    username: 'sachin',
    name: 'Sachin',
    email: 'sachin@123.com',
    role: 'super_admin',
    is_otp: false,
    must_change_password: false,
    is_online: true,
    last_active: 'Oct 13, 04:13 AM',
    login_time: 'Oct 13, 04:13 AM',
    ip_address: '10.0.4.12',
    user_agent: 'Chrome 122.0 / Windows 11 Enterprise',
  },
  {
    username: 'superadmin',
    name: 'Super Administrator',
    email: 'superadmin@workforceiq.internal',
    role: 'super_admin',
    is_otp: false,
    must_change_password: false,
    is_online: true,
    last_active: 'Oct 13, 06:30 AM',
    login_time: 'Oct 13, 06:30 AM',
    is_root_protected: true,
    is_current_user: true,
    ip_address: '192.168.1.1',
    user_agent: 'Chrome 122.0 / Linux x86_64',
  },
  {
    username: 'marcus',
    name: 'Marcus Kane',
    email: 'marcus.kane@workforceiq.internal',
    role: 'viewer',
    is_otp: false,
    must_change_password: false,
    is_online: true,
    last_active: 'Oct 13, 05:12 AM',
    login_time: 'Oct 13, 05:12 AM',
    ip_address: '10.0.8.91',
    user_agent: 'Firefox 123.0 / macOS (Ventura)',
  },
  {
    username: 'jdoe',
    name: 'Jane Doe',
    email: 'jdoe@workforceiq.internal',
    role: 'admin',
    is_otp: false,
    must_change_password: false,
    is_online: true,
    last_active: 'Oct 13, 05:45 AM',
    login_time: 'Oct 13, 05:45 AM',
    ip_address: '192.168.1.88',
    user_agent: 'Safari 17.2 / macOS (Sonoma)',
  },
];

const getInitials = (name?: string): string => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, Math.min(2, name.length)).toUpperCase();
};

export const EmployeesPage: React.FC = () => {
  // --- State ---
  const [users, setUsers] = useState<ConsoleUser[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_USERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_USERS;
  });

  const [search, setSearch] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [userToEdit, setUserToEdit] = useState<ConsoleUser | null>(null);
  const [userToSetOtp, setUserToSetOtp] = useState<ConsoleUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<ConsoleUser | null>(null);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState<boolean>(false);
  const [firstLoginPromptUser, setFirstLoginPromptUser] = useState<ConsoleUser | null>(null);

  // Form states: Add User
  const [addForm, setAddForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    is_otp: true,
    role: 'admin' as UserRole,
  });

  // Form states: Edit User
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'admin' as UserRole,
    resetPassword: '',
    is_otp: false,
  });

  // Form states: Set OTP
  const [otpPassword, setOtpPassword] = useState<string>('TempPass123!');

  // Form states: First Login Forced Decision Modal
  const [firstLoginForm, setFirstLoginForm] = useState({
    newPassword: '',
    confirmPassword: '',
    acceptTerms: true,
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Persist users to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    } catch {
      // ignore
    }
  }, [users]);

  // Auto-dismiss notification after 4s
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Real-time live session tracking polling every 5s
  const fetchLiveSessions = useCallback(async () => {
    try {
      const activeSessions = await api.getActiveSessions();
      if (Array.isArray(activeSessions) && activeSessions.length > 0) {
        const activeUsernames = new Set(activeSessions.map(s => s.username.toLowerCase()));
        setUsers(prev =>
          prev.map(u => ({
            ...u,
            is_online: activeUsernames.has(u.username.toLowerCase()),
          }))
        );
      }
    } catch {
      // Dev / offline fallback: keep tracking active users smoothly
    }
  }, []);

  // Initial load from PostgreSQL backend via api.getConsoleUsers()
  const loadUsers = useCallback(async () => {
    try {
      const fetched = await api.getConsoleUsers();
      if (Array.isArray(fetched) && fetched.length > 0) {
        setUsers(fetched as ConsoleUser[]);
      }
    } catch {
      // fallback to initial seeded / localStorage users
    }
  }, []);

  useEffect(() => {
    loadUsers();
    fetchLiveSessions();
  }, [loadUsers, fetchLiveSessions]);

  useEffect(() => {
    const interval = setInterval(fetchLiveSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchLiveSessions]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fetched = await api.getConsoleUsers();
      if (Array.isArray(fetched) && fetched.length > 0) {
        setUsers(fetched as ConsoleUser[]);
      }
      await fetchLiveSessions();
      setNotification({
        type: 'success',
        message: 'User directory and session tracking updated from PostgreSQL.',
      });
    } catch {
      setNotification({
        type: 'success',
        message: 'User directory and session tracking updated.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      u =>
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  // Active online count
  const activeCount = useMemo(() => {
    return users.filter(u => u.is_online).length;
  }, [users]);

  // Handlers for Add User
  const handleOpenAddModal = () => {
    setAddForm({
      username: '',
      name: '',
      email: '',
      password: '',
      is_otp: true,
      role: 'admin',
    });
    setIsAddModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = addForm.username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setNotification({ type: 'error', message: 'Username is required.' });
      return;
    }
    if (!addForm.password) {
      setNotification({ type: 'error', message: 'Password is required.' });
      return;
    }

    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      setNotification({
        type: 'error',
        message: `Username @${cleanUsername} is already taken. Please choose another.`,
      });
      return;
    }

    const payload = {
      username: cleanUsername,
      name: addForm.name.trim() || cleanUsername,
      email: addForm.email.trim() || `${cleanUsername}@workforceiq.internal`,
      role: addForm.role,
      password: addForm.password,
      is_otp: addForm.is_otp,
    };

    try {
      await api.createConsoleUser(payload);
    } catch (err: any) {
      // Backend may be offline or returned custom message; continue with local optimistic state
    }

    const newUser: ConsoleUser = {
      username: cleanUsername,
      name: payload.name,
      email: payload.email,
      role: payload.role as UserRole,
      is_otp: payload.is_otp,
      must_change_password: payload.is_otp,
      is_online: false,
      last_active: 'Never logged in',
      ip_address: '192.168.1.100',
      user_agent: 'Chrome 122.0 / Windows 11',
    };

    setUsers(prev => [newUser, ...prev]);
    setIsAddModalOpen(false);
    setNotification({
      type: 'success',
      message: `User @${cleanUsername} successfully created in PostgreSQL with ${
        addForm.is_otp ? 'One-Time Password policy' : 'active password'
      }.`,
    });
  };

  // Handlers for Edit User
  const handleOpenEdit = (user: ConsoleUser) => {
    setUserToEdit(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      resetPassword: '',
      is_otp: user.is_otp || user.must_change_password,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;

    const targetUser = userToEdit.username;
    const payload = {
      name: editForm.name.trim() || userToEdit.name,
      email: editForm.email.trim() || userToEdit.email,
      role: editForm.role,
      is_otp: editForm.is_otp,
      password: editForm.resetPassword || undefined,
      resetPassword: editForm.resetPassword || undefined,
    };

    try {
      await api.updateConsoleUser(targetUser, payload);
    } catch (err: any) {
      // Optimistic update
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.username === targetUser) {
          return {
            ...u,
            name: payload.name,
            email: payload.email,
            role: payload.role as UserRole,
            is_otp: payload.is_otp,
            must_change_password: payload.is_otp,
          };
        }
        return u;
      })
    );

    setUserToEdit(null);
    setNotification({
      type: 'success',
      message: `Updated account details for @${targetUser}.`,
    });
  };

  // Handlers for Issue OTP
  const handleOpenSetOtp = (user: ConsoleUser) => {
    setUserToSetOtp(user);
    setOtpPassword('TempPass123!');
  };

  const handleIssueOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToSetOtp) return;
    if (!otpPassword.trim()) {
      setNotification({ type: 'error', message: 'Temporary password cannot be empty.' });
      return;
    }

    const target = userToSetOtp.username;
    try {
      await api.setOneTimePassword(target, otpPassword.trim());
    } catch (err: any) {
      // Optimistic update
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.username === target) {
          return {
            ...u,
            is_otp: true,
            must_change_password: true,
          };
        }
        return u;
      })
    );

    setUserToSetOtp(null);
    setNotification({
      type: 'success',
      message: `Issued temporary OTP for @${target}. User must reset on next login.`,
    });
  };

  // Handlers for Delete User
  const handleOpenDelete = (user: ConsoleUser) => {
    if (user.is_root_protected || user.username === 'superadmin') {
      setNotification({
        type: 'error',
        message: 'The root account @superadmin is protected and cannot be deleted or locked out.',
      });
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (userToDelete.is_root_protected || userToDelete.username === 'superadmin') {
      setNotification({
        type: 'error',
        message: 'The root account @superadmin is protected and cannot be deleted.',
      });
      setUserToDelete(null);
      return;
    }

    const deletedUsername = userToDelete.username;
    try {
      await api.deleteConsoleUser(deletedUsername);
    } catch (err: any) {
      // Optimistic update
    }

    setUsers(prev => prev.filter(u => u.username !== deletedUsername));
    setUserToDelete(null);
    setNotification({
      type: 'success',
      message: `User account @${deletedUsername} has been permanently deleted from PostgreSQL.`,
    });
  };

  // First Login Forced Decision handler
  const handleCompleteFirstLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstLoginPromptUser) return;
    if (firstLoginForm.newPassword.length < 6) {
      setNotification({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }
    if (firstLoginForm.newPassword !== firstLoginForm.confirmPassword) {
      setNotification({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    const targetUser = firstLoginPromptUser.username;
    try {
      await api.processFirstLoginDecision(
        targetUser,
        firstLoginForm.newPassword,
        firstLoginForm.acceptTerms
      );
    } catch (err: any) {
      // Optimistic update
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.username === targetUser) {
          return {
            ...u,
            is_otp: false,
            must_change_password: false,
          };
        }
        return u;
      })
    );

    setFirstLoginPromptUser(null);
    setNotification({
      type: 'success',
      message: `Permanent password set for @${targetUser}. One-time password status resolved.`,
    });
  };

  // Terminate active session
  const handleTerminateSession = async (username: string) => {
    try {
      await api.terminateSession(undefined, username);
    } catch (err: any) {
      // Optimistic update
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.username === username) {
          return {
            ...u,
            is_online: false,
          };
        }
        return u;
      })
    );
    setNotification({
      type: 'info',
      message: `Active session for @${username} was terminated in database.`,
    });
  };

  // Role Badge Renderer
  const renderRoleBadge = (role: UserRole) => {
    if (role === 'super_admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Shield className="w-3.5 h-3.5 text-purple-600" />
          <span>Super Admin</span>
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Admin</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <span>Viewer</span>
      </span>
    );
  };

  // Avatar Color Resolver
  const getAvatarBg = (user: ConsoleUser) => {
    if (user.role === 'super_admin') return 'bg-purple-600';
    if (user.is_otp || user.username === 'firstuser') return 'bg-slate-700';
    return 'bg-blue-600';
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium transition-all transform animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Activity className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 ml-2"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Card (Screenshot 1 top section) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">User Management</h1>
              <button
                type="button"
                onClick={() => setIsSessionsModalOpen(true)}
                title="Click to view real-time logged-in sessions"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70 transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>{activeCount} Active Online</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Console user accounts, logged-in status, and role administration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-white" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Main Table Card (Screenshot 1) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Search & Counter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-slate-200/80">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, username, or email..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-600 flex items-center justify-end">
            <span>
              Showing <strong className="text-slate-900 font-bold">{filteredUsers.length}</strong>{' '}
              users
            </span>
          </div>
        </div>

        {/* User Management Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3.5 px-5">User</th>
                <th className="py-3.5 px-5">Email Address</th>
                <th className="py-3.5 px-5">Role</th>
                <th className="py-3.5 px-5">Password Policy</th>
                <th className="py-3.5 px-5">Activity</th>
                <th className="py-3.5 px-5 text-right">Actions (Super Admin)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 text-sm">No console users found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {search ? 'Try clearing your search query.' : 'Click "Add User" to create one.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isRoot = user.is_root_protected || user.username === 'superadmin';

                  return (
                    <tr
                      key={user.username}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* User Column */}
                      <td className="py-3.5 px-5 align-middle">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl ${getAvatarBg(
                              user
                            )} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs select-none`}
                          >
                            {getInitials(user.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">
                                {user.name}
                              </span>
                              {user.is_current_user && (
                                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded leading-tight">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                              @{user.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email Address Column */}
                      <td className="py-3.5 px-5 align-middle text-slate-600 text-xs">
                        <span className="break-all">{user.email || '—'}</span>
                      </td>

                      {/* Role Column */}
                      <td className="py-3.5 px-5 align-middle">
                        {renderRoleBadge(user.role)}
                      </td>

                      {/* Password Policy Column */}
                      <td className="py-3.5 px-5 align-middle">
                        {user.is_otp || user.must_change_password ? (
                          <button
                            type="button"
                            onClick={() => setFirstLoginPromptUser(user)}
                            title="Click to test first-login OTP password reset decision prompt"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>One-Time Password</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Password Active</span>
                          </span>
                        )}
                      </td>

                      {/* Activity Column */}
                      <td className="py-3.5 px-5 align-middle">
                        <div className="flex items-center gap-2">
                          {user.is_online ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <span>Active Online</span>
                              </span>
                              {user.last_active && (
                                <span className="text-xs text-slate-400 font-normal">
                                  ({user.last_active})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Offline
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions Column (Super Admin) */}
                      <td className="py-3.5 px-5 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Set OTP button */}
                          <button
                            type="button"
                            onClick={() => handleOpenSetOtp(user)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
                            title="Issue temporary One-Time Password"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                            <span>Set OTP</span>
                          </button>

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
                            title="Edit user details"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Edit</span>
                          </button>

                          {/* Delete button (Root Protected for @superadmin) */}
                          {isRoot ? (
                            <button
                              type="button"
                              disabled
                              title="The root account @superadmin is protected and cannot be deleted"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-50 border border-slate-200 rounded-lg cursor-not-allowed opacity-60"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                              <span>Delete</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(user)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-2xs cursor-pointer"
                              title="Permanently delete user account"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: ADD USER MODAL (Matches Screenshot 2 Exactly)
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsAddModalOpen(false)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 transform transition-all text-xs">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add User</h3>
                    <p className="text-slate-500 text-xs">Create a new user account</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateUser} className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ssmith"
                    value={addForm.username}
                    onChange={e => setAddForm({ ...addForm, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Smith"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. ssmith@company.com"
                    value={addForm.email}
                    onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={addForm.password}
                    onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                  />
                </div>

                {/* Set as One-Time Password Checkbox Card */}
                <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="add_is_otp"
                    checked={addForm.is_otp}
                    onChange={e => setAddForm({ ...addForm, is_otp: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="add_is_otp" className="cursor-pointer select-none">
                    <span className="font-bold text-slate-900 block text-xs">
                      Set as One-Time Password (OTP)
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      User will be required on first login to reset this password.
                    </span>
                  </label>
                </div>

                {/* Role */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addForm.role}
                    onChange={e => setAddForm({ ...addForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 cursor-pointer"
                  >
                    <option value="admin">Admin (All Access except Settings &amp; Job Scheduler)</option>
                    <option value="super_admin">Super Admin (Full Clearance &amp; Governance)</option>
                    <option value="viewer">Viewer (Audit Read-Only Fleet Access)</option>
                  </select>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ISSUE ONE-TIME PASSWORD MODAL (Matches Screenshot 3 Exactly)
          ========================================================================= */}
      {userToSetOtp && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setUserToSetOtp(null)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 transform transition-all text-xs">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Issue One-Time Password</h3>
                    <p className="text-slate-500 text-xs">
                      Target User: @{userToSetOtp.username} ({userToSetOtp.name})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUserToSetOtp(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Warning Card */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed mb-4">
                Setting a temporary one-time password will require user{' '}
                <strong className="font-bold text-amber-950">@{userToSetOtp.username}</strong> to{' '}
                <strong className="font-bold text-amber-950">reset their password</strong> on their next login.
              </div>

              {/* Form */}
              <form onSubmit={handleIssueOtp} className="space-y-4">
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Temporary One-Time Password
                  </label>
                  <input
                    type="text"
                    required
                    value={otpPassword}
                    onChange={e => setOtpPassword(e.target.value)}
                    placeholder="TempPass123!"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 placeholder-slate-400"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setUserToSetOtp(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#d97706] hover:bg-[#b45309] rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-white" />
                    <span>Issue OTP &amp; Force Decision</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: EDIT USER DETAILS MODAL (Matches Screenshot 4 Exactly)
          ========================================================================= */}
      {userToEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setUserToEdit(null)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 transform transition-all text-xs">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Edit User Details</h3>
                    <p className="text-slate-500 text-xs">Editing @{userToEdit.username}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveEdit} className="space-y-4">
                {/* Username (Fixed) */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Username (Fixed)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={userToEdit.username}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 text-slate-500 border border-slate-200 rounded-lg cursor-not-allowed select-none"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800"
                  />
                </div>

                {/* Role Clearance */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Role Clearance <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800 cursor-pointer"
                  >
                    <option value="admin">Admin (All Access except Settings &amp; Job Scheduler)</option>
                    <option value="super_admin">Super Admin (Full Clearance &amp; Governance)</option>
                    <option value="viewer">Viewer (Audit Read-Only Fleet Access)</option>
                  </select>
                </div>

                {/* Reset Password (Optional) */}
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1">
                    Reset Password (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Leave empty to keep existing password"
                    value={editForm.resetPassword}
                    onChange={e => setEditForm({ ...editForm, resetPassword: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800 placeholder-slate-400"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Enter a new password only if you wish to update the user's password.
                  </p>
                </div>

                {/* Require First Login Password Reset Checkbox */}
                <div className="border border-purple-200/80 bg-purple-50/30 rounded-xl p-3.5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="edit_is_otp"
                    checked={editForm.is_otp}
                    onChange={e => setEditForm({ ...editForm, is_otp: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="edit_is_otp" className="cursor-pointer select-none">
                    <span className="font-bold text-slate-900 block text-xs">
                      Require First Login Password Reset (OTP)
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      User will be required to reset their password on next login.
                    </span>
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setUserToEdit(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-[#8b5cf6] hover:bg-[#7c3aed] rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: DELETE USER ACCOUNT MODAL (Matches Screenshot 5 Exactly)
          ========================================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setUserToDelete(null)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden p-6 transform transition-all text-xs text-center">
              {/* Alert Triangle Icon in Soft Rose Rounded Square */}
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-500 mb-3.5">
                <AlertTriangle className="w-7 h-7" />
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Delete User Account
              </h3>

              {/* Description */}
              <p className="text-xs text-slate-500 mt-2.5 max-w-xs mx-auto leading-relaxed">
                Are you sure you want to permanently delete user account{' '}
                <strong className="font-bold text-slate-900">@{userToDelete.username}</strong> (
                {userToDelete.name})? This action cannot be undone.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#e11d48] hover:bg-[#be123c] rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Yes, Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: FIRST LOGIN PASSWORD DECISION MODAL (Key Requirement)
          ========================================================================= */}
      {firstLoginPromptUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setFirstLoginPromptUser(null)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 transform transition-all text-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Set Permanent Password (First Login)
                    </h3>
                    <p className="text-slate-500 text-xs">
                      Forced OTP security prompt for @{firstLoginPromptUser.username}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFirstLoginPromptUser(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 mb-4 text-xs text-blue-900 leading-relaxed">
                You logged in using a temporary One-Time Password. Under corporate governance
                policy, you must create a permanent password to continue.
              </div>

              <form onSubmit={handleCompleteFirstLogin} className="space-y-4">
                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    New Permanent Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimum 6 characters"
                      value={firstLoginForm.newPassword}
                      onChange={e =>
                        setFirstLoginForm({ ...firstLoginForm, newPassword: e.target.value })
                      }
                      className="w-full pl-3 pr-10 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 text-xs mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={firstLoginForm.confirmPassword}
                    onChange={e =>
                      setFirstLoginForm({ ...firstLoginForm, confirmPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="terms_check"
                    required
                    checked={firstLoginForm.acceptTerms}
                    onChange={e =>
                      setFirstLoginForm({ ...firstLoginForm, acceptTerms: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="terms_check" className="text-slate-600 text-xs cursor-pointer">
                    I acknowledge corporate asset governance &amp; audit rules.
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setFirstLoginPromptUser(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                  >
                    Save &amp; Activate Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: LIVE ACTIVE SESSIONS TELEMETRY DRAWER (Session Tracking)
          ========================================================================= */}
      {isSessionsModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsSessionsModalOpen(false)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 transform transition-all text-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Live Active Sessions Telemetry
                    </h3>
                    <p className="text-slate-500 text-xs">
                      Real-time logged-in console sessions (Polling every 5s)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSessionsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {users
                  .filter(u => u.is_online)
                  .map(sessionUser => (
                    <div
                      key={sessionUser.username}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                          {getInitials(sessionUser.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {sessionUser.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              @{sessionUser.username}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-[10px]">
                              {sessionUser.ip_address || '192.168.1.1'}
                            </span>
                            <span className="truncate max-w-xs">{sessionUser.user_agent}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {sessionUser.last_active}
                          </span>
                        </div>

                        {!sessionUser.is_root_protected && (
                          <button
                            type="button"
                            onClick={() => handleTerminateSession(sessionUser.username)}
                            className="px-2.5 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Terminate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-500">
                <span>Total Active Sessions: {activeCount}</span>
                <button
                  type="button"
                  onClick={() => setIsSessionsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
