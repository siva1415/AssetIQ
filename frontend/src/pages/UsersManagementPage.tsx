import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  KeyRound,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { AppUser, PortalRole, PortalUserStatus } from '../types';

export const UsersManagementPage: React.FC = () => {
  const { currentUser, setCurrentUser, dataRefreshKey, triggerDataRefresh } = useApp();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addForm, setAddForm] = useState<{
    username: string;
    full_name: string;
    email: string;
    role: PortalRole;
  }>({
    username: '',
    full_name: '',
    email: '',
    role: 'VIEWER',
  });
  const [addLoading, setAddLoading] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newlyCreatedSuccess, setNewlyCreatedSuccess] = useState<{
    username: string;
    full_name: string;
  } | null>(null);

  // Edit User Modal State
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<{
    username: string;
    full_name: string;
    email: string;
    role: PortalRole;
  }>({
    username: '',
    full_name: '',
    email: '',
    role: 'VIEWER',
  });
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Status Change Confirmation Modal State
  const [statusConfirmUser, setStatusConfirmUser] = useState<AppUser | null>(null);
  const [statusActionLoading, setStatusActionLoading] = useState<boolean>(false);

  // Password Reset Confirmation Modal State
  const [resetConfirmUser, setResetConfirmUser] = useState<AppUser | null>(null);
  const [resetActionLoading, setResetActionLoading] = useState<boolean>(false);
  const [resetSuccessInfo, setResetSuccessInfo] = useState<{
    username: string;
    temporary_password?: string;
  } | null>(null);

  // Auto-dismiss notification after 6s
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Load portal users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAppUsers({
        search: search.trim() || undefined,
        page,
        page_size: pageSize,
      });

      if (Array.isArray(res)) {
        setUsers(res);
        setTotalUsers(res.length);
        setTotalPages(Math.max(1, Math.ceil(res.length / pageSize)));
      } else {
        setUsers(res.items || []);
        setTotalUsers(res.total ?? (res.items || []).length);
        setTotalPages(res.total_pages ?? Math.max(1, Math.ceil((res.total || 0) / pageSize)));
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.detail?.detail || err?.message || 'Failed to load portal users from backend.',
      });
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, dataRefreshKey]);

  // Count active SUPERADMINs to prevent deactivating the last one
  const activeSuperadminCount = useMemo(() => {
    return users.filter(
      u => u.role === 'SUPERADMIN' && (u.status === 'ACTIVE' || u.is_active === true)
    ).length;
  }, [users]);

  // Permission helpers
  const isSuperadmin = currentUser.role === 'SUPERADMIN';
  const isAdmin = currentUser.role === 'ADMIN';

  // Check if a target user is the currently logged-in user using stable identifier
  const isCurrentLoggedInUser = useCallback((targetUser: AppUser): boolean => {
    if (!currentUser) return false;
    // Check stable database user ID first
    const currentId = currentUser.id;
    const targetId = targetUser.id ?? targetUser.user_id;
    if (currentId != null && targetId != null && String(currentId).trim() !== '' && String(targetId).trim() !== '') {
      if (String(currentId).trim() === String(targetId).trim()) {
        return true;
      }
    }
    // Fallback to canonical username comparison (case-insensitively, trimmed)
    if (currentUser.username && targetUser.username) {
      if (currentUser.username.trim().toLowerCase() === targetUser.username.trim().toLowerCase()) {
        return true;
      }
    }
    return false;
  }, [currentUser]);

  // Check if an account is the permanently protected superadmin username (case-insensitive, trimmed)
  const isProtectedSuperadmin = useCallback((user: { username?: string } | null | undefined): boolean => {
    return (user?.username || '').trim().toLowerCase() === 'superadmin';
  }, []);

  // Can current user manage a specific target user?
  const canManageUser = (targetUser: AppUser): boolean => {
    if (isSuperadmin) return true;
    if (isAdmin) {
      // ADMIN cannot manage SUPERADMIN accounts
      return targetUser.role !== 'SUPERADMIN';
    }
    return false;
  };

  // Can deactivate this user?
  const canDeactivateUser = (targetUser: AppUser): { allowed: boolean; reason?: string } => {
    // 1. Current logged-in user cannot deactivate their own account (applies to ALL roles)
    if (isCurrentLoggedInUser(targetUser)) {
      return { allowed: false, reason: 'You cannot deactivate your own account.' };
    }

    // 2. Permanently protect the 'superadmin' username
    if (isProtectedSuperadmin(targetUser)) {
      return { allowed: false, reason: 'The superadmin account cannot be deactivated.' };
    }

    // 3. Existing role-based permission: ADMIN cannot modify or deactivate SUPERADMIN accounts
    if (!canManageUser(targetUser)) {
      return { allowed: false, reason: 'Admin cannot modify or deactivate Superadmin accounts.' };
    }

    // 4. Block deactivating the last active SUPERADMIN
    if (
      targetUser.role === 'SUPERADMIN' &&
      (targetUser.status === 'ACTIVE' || targetUser.is_active === true) &&
      activeSuperadminCount <= 1
    ) {
      return { allowed: false, reason: 'Cannot deactivate the last active Superadmin account.' };
    }

    return { allowed: true };
  };

  // Handle Add User Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!addForm.username.trim()) {
      setAddError('Username is required.');
      return;
    }
    if (!addForm.full_name.trim()) {
      setAddError('Full name is required.');
      return;
    }
    if (!addForm.email.trim()) {
      setAddError('Email is required.');
      return;
    }

    setAddLoading(true);
    try {
      await api.createAppUser({
        username: addForm.username.trim(),
        full_name: addForm.full_name.trim(),
        email: addForm.email.trim(),
        role: addForm.role,
      });

      setNewlyCreatedSuccess({
        username: addForm.username.trim(),
        full_name: addForm.full_name.trim(),
      });

      setAddForm({
        username: '',
        full_name: '',
        email: '',
        role: 'VIEWER',
      });

      loadUsers();
      triggerDataRefresh();
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const detail = err?.detail?.detail || err?.detail?.message || err?.message || '';

      if (status === 409 || String(detail).toLowerCase().includes('already exists')) {
        setAddError('A user with this username or email already exists.');
      } else if (detail && typeof detail === 'string') {
        setAddError(detail);
      } else {
        setAddError('Failed to create user. Please check your inputs and try again.');
      }
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit User Modal
  const handleOpenEdit = (user: AppUser) => {
    setUserToEdit(user);
    setEditForm({
      username: user.username || '',
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role,
    });
    setEditError(null);
  };

  // Handle Edit User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setEditError(null);

    const isEditingSuperadmin = isProtectedSuperadmin(userToEdit);
    const trimmedUsername = isEditingSuperadmin ? 'superadmin' : editForm.username.trim();
    const trimmedFullName = editForm.full_name.trim();
    const trimmedEmail = editForm.email.trim();
    const targetRole = isEditingSuperadmin ? userToEdit.role : editForm.role;

    if (!trimmedUsername) {
      setEditError('Username is required.');
      return;
    }
    if (!trimmedFullName) {
      setEditError('Full name is required.');
      return;
    }
    if (!trimmedEmail) {
      setEditError('Email is required.');
      return;
    }

    setEditLoading(true);
    try {
      const targetIdentifier = userToEdit.id || userToEdit.user_id || userToEdit.username;
      await api.updateAppUser(targetIdentifier, {
        username: trimmedUsername,
        full_name: trimmedFullName,
        email: trimmedEmail,
        role: targetRole,
      });

      // Synchronize authenticated user state if self-editing
      const isSelf = isCurrentLoggedInUser(userToEdit);
      if (isSelf) {
        setCurrentUser({
          ...currentUser,
          username: trimmedUsername,
          name: trimmedFullName,
          email: trimmedEmail,
          role: targetRole,
        });
      }

      setNotification({
        type: 'success',
        message: `User ${trimmedUsername} updated successfully.`,
      });
      setUserToEdit(null);
      loadUsers();
      triggerDataRefresh();
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const detail = err?.detail?.detail || err?.detail?.message || err?.message || '';

      if (status === 409 || String(detail).toLowerCase().includes('already exists') || String(detail).toLowerCase().includes('duplicate')) {
        setEditError('A user with this username or email already exists.');
      } else if (
        status === 400 &&
        (String(detail).toLowerCase().includes('username') &&
          (String(detail).toLowerCase().includes('immutable') ||
            String(detail).toLowerCase().includes('cannot be changed') ||
            String(detail).toLowerCase().includes('read-only')))
      ) {
        setEditError('The backend API does not permit modifying usernames. Please retain the original username.');
      } else if (detail && typeof detail === 'string') {
        setEditError(detail);
      } else {
        setEditError('Failed to update user details. Please check inputs and try again.');
      }
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Toggle Status Submit
  const handleStatusConfirm = async () => {
    if (!statusConfirmUser) return;
    const isDeactivating =
      statusConfirmUser.status === 'ACTIVE' || statusConfirmUser.is_active === true;

    if (isDeactivating) {
      const check = canDeactivateUser(statusConfirmUser);
      if (!check.allowed) {
        setNotification({
          type: 'error',
          message: check.reason || 'Deactivation is not permitted for this account.',
        });
        setStatusConfirmUser(null);
        return;
      }
    }

    const newStatus: PortalUserStatus = isDeactivating ? 'INACTIVE' : 'ACTIVE';

    setStatusActionLoading(true);
    try {
      await api.setUserStatus(
        statusConfirmUser.id || statusConfirmUser.user_id || statusConfirmUser.username,
        newStatus
      );

      setNotification({
        type: 'success',
        message: `User ${statusConfirmUser.username} is now ${newStatus.toLowerCase()}.`,
      });
      setStatusConfirmUser(null);
      loadUsers();
      triggerDataRefresh();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.detail?.detail || err?.message || 'Failed to update user status.',
      });
    } finally {
      setStatusActionLoading(false);
    }
  };

  // Handle Password Reset Confirm
  const handleResetConfirm = async () => {
    if (!resetConfirmUser) return;

    setResetActionLoading(true);
    try {
      const res = await api.resetAppUserPassword(
        resetConfirmUser.id || resetConfirmUser.user_id || resetConfirmUser.username
      );

      setResetSuccessInfo({
        username: resetConfirmUser.username,
        temporary_password: res?.temporary_password || 'test@123',
      });
      setResetConfirmUser(null);
      loadUsers();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.detail?.detail || err?.message || 'Failed to reset user password.',
      });
      setResetConfirmUser(null);
    } finally {
      setResetActionLoading(false);
    }
  };

  // Role badge renderer with distinct icon and colors:
  // SUPERADMIN: ShieldCheck icon, purple
  // ADMIN: Shield icon, blue
  // VIEWER: Eye icon, teal
  const renderRoleBadge = (role: PortalRole | string) => {
    const norm = String(role || '').toUpperCase();
    if (norm === 'SUPERADMIN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>SUPERADMIN</span>
        </span>
      );
    }
    if (norm === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>ADMIN</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
        <Eye className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span>VIEWER</span>
      </span>
    );
  };

  // Status badge renderer
  const renderStatusBadge = (status: PortalUserStatus | string, isActive?: boolean) => {
    const active = isActive !== undefined ? isActive : String(status).toUpperCase() === 'ACTIVE';
    if (active) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>ACTIVE</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span>INACTIVE</span>
      </span>
    );
  };

  // Format date helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Global Notification Banner */}
      {notification && (
        <div
          role="alert"
          className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border text-xs font-medium ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter, Search and Action Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by username, name, email, or role..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 text-xs">
          <span className="text-slate-500 font-medium hidden sm:inline">
            Showing <span className="font-semibold text-slate-800">{users.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalUsers}</span> registered users
          </span>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Add Portal User Button */}
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setNewlyCreatedSuccess(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Portal User</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3.5">
                  Username
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Full Name
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Email
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Role
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Status
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Created At
                </th>
                <th scope="col" className="px-4 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading portal users...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-sm text-slate-700">No users found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search ? 'Try adjusting your search criteria.' : 'Click "Add User" to create the first portal user.'}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const deactivationCheck = canDeactivateUser(u);
                  const isSelf = isCurrentLoggedInUser(u);
                  const canManage = canManageUser(u);

                  return (
                    <tr key={String(u.id || u.user_id || u.username)} className="hover:bg-slate-50/80 transition-colors">
                      {/* Username */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {(u.username || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 font-mono">
                              {u.username}
                            </span>
                            {isSelf && (
                              <span className="ml-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Full Name */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-slate-800">
                        {u.full_name || '—'}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{u.email}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderRoleBadge(u.role)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderStatusBadge(u.status, u.is_active)}
                      </td>

                      {/* Created At */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatDate(u.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit User Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            disabled={!canManage}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              canManage
                                ? 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                                : 'text-slate-300 cursor-not-allowed opacity-40'
                            }`}
                            title={
                              !canManage
                                ? 'Admin cannot modify Superadmin accounts'
                                : 'Edit user details and role'
                            }
                            aria-label={`Edit ${u.username}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => setResetConfirmUser(u)}
                            disabled={!canManage}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              canManage
                                ? 'text-slate-600 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-300 cursor-not-allowed opacity-40'
                            }`}
                            title={
                              !canManage
                                ? 'Admin cannot reset Superadmin passwords'
                                : 'Reset user password to test@123'
                            }
                            aria-label={`Reset password for ${u.username}`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Inactive Status */}
                          {u.status === 'ACTIVE' || u.is_active === true ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!deactivationCheck.allowed) return;
                                setStatusConfirmUser(u);
                              }}
                              disabled={!deactivationCheck.allowed}
                              className={`p-1.5 rounded-md transition-colors ${
                                deactivationCheck.allowed
                                  ? 'text-slate-600 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                  : 'text-slate-300 cursor-not-allowed opacity-40'
                              }`}
                              title={deactivationCheck.reason || 'Deactivate user account'}
                              aria-label={`Deactivate ${u.username}`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setStatusConfirmUser(u)}
                              disabled={!canManage}
                              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                canManage
                                  ? 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
                                  : 'text-slate-300 cursor-not-allowed opacity-40'
                              }`}
                              title={
                                !canManage
                                  ? 'Admin cannot activate Superadmin accounts'
                                  : 'Activate user account'
                              }
                              aria-label={`Activate ${u.username}`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
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

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>
              Page {page} of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Page"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold text-slate-700">{page}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next Page"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL 1: ADD USER MODAL
      ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Add Portal User</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {newlyCreatedSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm mb-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Account Created Successfully</span>
                    </div>
                    <p className="leading-relaxed">
                      The user <span className="font-semibold text-slate-900 font-mono">{newlyCreatedSuccess.username}</span> has been provisioned.
                    </p>
                    <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Temporary Password:</span>
                        <code className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          test@123
                        </code>
                      </div>
                      <p className="text-[11px] text-amber-700 font-medium">
                        * The user must reset this temporary password on their first login before access is granted.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewlyCreatedSuccess(null);
                        setIsAddModalOpen(false);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddSubmit} className="space-y-4" noValidate>
                  {/* Notice about temporary password */}
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                    New accounts are initialized with temporary password{' '}
                    <code className="font-mono font-bold text-blue-950 bg-white/70 px-1 py-0.2 rounded border border-blue-300">
                      test@123
                    </code>{' '}
                    and require a mandatory password reset on initial sign in.
                  </div>

                  {addError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{addError}</span>
                    </div>
                  )}

                  {/* Username */}
                  <div>
                    <label
                      htmlFor="add-username"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="add-username"
                      type="text"
                      autoFocus
                      required
                      value={addForm.username}
                      onChange={e => {
                        setAddForm({ ...addForm, username: e.target.value });
                        if (addError) setAddError(null);
                      }}
                      placeholder="e.g. jsmith or admin_john"
                      className="w-full h-9 px-3 text-xs bg-white text-slate-900 font-medium border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>

                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="add-fullname"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="add-fullname"
                      type="text"
                      required
                      value={addForm.full_name}
                      onChange={e => {
                        setAddForm({ ...addForm, full_name: e.target.value });
                        if (addError) setAddError(null);
                      }}
                      placeholder="e.g. John Smith"
                      className="w-full h-9 px-3 text-xs bg-white text-slate-900 font-medium border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="add-email"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="add-email"
                      type="email"
                      required
                      value={addForm.email}
                      onChange={e => {
                        setAddForm({ ...addForm, email: e.target.value });
                        if (addError) setAddError(null);
                      }}
                      placeholder="e.g. john.smith@company.com"
                      className="w-full h-9 px-3 text-xs bg-white text-slate-900 font-medium border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>

                  {/* Role Radio Group - Three Separate Vertical Rows */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Role <span className="text-rose-500">*</span>
                    </label>
                    <div
                      className="flex flex-col gap-2"
                      role="radiogroup"
                      aria-label="Select role"
                    >
                      {/* SUPERADMIN */}
                      <label
                        className={`flex items-center gap-2.5 w-full p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                          addForm.role === 'SUPERADMIN'
                            ? 'bg-purple-50/70 border-purple-400 text-purple-900 ring-2 ring-purple-500/20 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="add-portal-role"
                          value="SUPERADMIN"
                          checked={addForm.role === 'SUPERADMIN'}
                          onChange={() => setAddForm({ ...addForm, role: 'SUPERADMIN' })}
                          className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500 cursor-pointer"
                        />
                        <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="font-semibold tracking-wide">SUPERADMIN</span>
                      </label>

                      {/* ADMIN */}
                      <label
                        className={`flex items-center gap-2.5 w-full p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                          addForm.role === 'ADMIN'
                            ? 'bg-blue-50/70 border-blue-400 text-blue-900 ring-2 ring-blue-500/20 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="add-portal-role"
                          value="ADMIN"
                          checked={addForm.role === 'ADMIN'}
                          onChange={() => setAddForm({ ...addForm, role: 'ADMIN' })}
                          className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold tracking-wide">ADMIN</span>
                      </label>

                      {/* VIEWER */}
                      <label
                        className={`flex items-center gap-2.5 w-full p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                          addForm.role === 'VIEWER'
                            ? 'bg-teal-50/70 border-teal-400 text-teal-900 ring-2 ring-teal-500/20 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="add-portal-role"
                          value="VIEWER"
                          checked={addForm.role === 'VIEWER'}
                          onChange={() => setAddForm({ ...addForm, role: 'VIEWER' })}
                          className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
                        />
                        <Eye className="w-4 h-4 text-teal-600 shrink-0" />
                        <span className="font-semibold tracking-wide">VIEWER</span>
                      </label>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      disabled={addLoading}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {addLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating user...</span>
                        </>
                      ) : (
                        <span>Create User</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: EDIT USER MODAL
      ======================================================== */}
      {userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Edit User: <span className="font-mono text-blue-700">{userToEdit.username}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUserToEdit(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4" noValidate>
              {editError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Username */}
              <div>
                <label
                  htmlFor="edit-username"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Username <span className="text-rose-500">*</span>
                  {isProtectedSuperadmin(userToEdit) && (
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      (Protected account — username cannot be changed)
                    </span>
                  )}
                </label>
                <input
                  id="edit-username"
                  type="text"
                  required
                  disabled={isProtectedSuperadmin(userToEdit)}
                  readOnly={isProtectedSuperadmin(userToEdit)}
                  value={isProtectedSuperadmin(userToEdit) ? 'superadmin' : editForm.username}
                  onChange={e => {
                    if (isProtectedSuperadmin(userToEdit)) return;
                    setEditForm({ ...editForm, username: e.target.value });
                    if (editError) setEditError(null);
                  }}
                  placeholder="e.g. jsmith or admin_john"
                  className={`w-full h-9 px-3 text-xs font-mono font-medium border rounded-lg transition-all ${
                    isProtectedSuperadmin(userToEdit)
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                      : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                  title={isProtectedSuperadmin(userToEdit) ? 'The superadmin username is protected and cannot be changed.' : undefined}
                />
              </div>

              {/* Full Name */}
              <div>
                <label
                  htmlFor="edit-fullname"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-fullname"
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={e => {
                    setEditForm({ ...editForm, full_name: e.target.value });
                    if (editError) setEditError(null);
                  }}
                  className="w-full h-9 px-3 text-xs bg-white text-slate-900 font-medium border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="edit-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editForm.email}
                  onChange={e => {
                    setEditForm({ ...editForm, email: e.target.value });
                    if (editError) setEditError(null);
                  }}
                  className="w-full h-9 px-3 text-xs bg-white text-slate-900 font-medium border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Role Radio Group */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Role <span className="text-rose-500">*</span>
                  {isProtectedSuperadmin(userToEdit) && (
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      (Protected account — role cannot be changed)
                    </span>
                  )}
                </label>
                <div
                  className="flex flex-col gap-2"
                  role="radiogroup"
                  aria-label="Select role"
                >
                  {/* SUPERADMIN */}
                  <label
                    className={`flex items-center gap-2.5 w-full p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      isProtectedSuperadmin(userToEdit)
                        ? 'bg-purple-50/50 border-purple-300 text-purple-900 cursor-not-allowed opacity-90'
                        : editForm.role === 'SUPERADMIN'
                        ? 'bg-purple-50/70 border-purple-400 text-purple-900 ring-2 ring-purple-500/20 shadow-2xs cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                    }`}
                    title={isProtectedSuperadmin(userToEdit) ? 'The role of the superadmin account cannot be changed.' : undefined}
                  >
                    <input
                      type="radio"
                      name="edit-portal-role"
                      value="SUPERADMIN"
                      disabled={isProtectedSuperadmin(userToEdit)}
                      checked={editForm.role === 'SUPERADMIN'}
                      onChange={() => {
                        if (isProtectedSuperadmin(userToEdit)) return;
                        setEditForm({ ...editForm, role: 'SUPERADMIN' });
                      }}
                      className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500 disabled:cursor-not-allowed"
                    />
                    <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-semibold tracking-wide">SUPERADMIN</span>
                  </label>

                  {/* ADMIN */}
                  <label
                    className={`flex items-center gap-2.5 w-full p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      isProtectedSuperadmin(userToEdit)
                        ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                        : editForm.role === 'ADMIN'
                        ? 'bg-blue-50/70 border-blue-400 text-blue-900 ring-2 ring-blue-500/20 shadow-2xs cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                    }`}
                    title={isProtectedSuperadmin(userToEdit) ? 'The role of the superadmin account cannot be changed.' : undefined}
                  >
                    <input
                      type="radio"
                      name="edit-portal-role"
                      value="ADMIN"
                      disabled={isProtectedSuperadmin(userToEdit)}
                      checked={editForm.role === 'ADMIN'}
                      onChange={() => {
                        if (isProtectedSuperadmin(userToEdit)) return;
                        setEditForm({ ...editForm, role: 'ADMIN' });
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-semibold tracking-wide">ADMIN</span>
                  </label>

                  {/* VIEWER */}
                  <label
                    className={`flex items-center gap-2.5 w-full p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      isProtectedSuperadmin(userToEdit)
                        ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                        : editForm.role === 'VIEWER'
                        ? 'bg-teal-50/70 border-teal-400 text-teal-900 ring-2 ring-teal-500/20 shadow-2xs cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                    }`}
                    title={isProtectedSuperadmin(userToEdit) ? 'The role of the superadmin account cannot be changed.' : undefined}
                  >
                    <input
                      type="radio"
                      name="edit-portal-role"
                      value="VIEWER"
                      disabled={isProtectedSuperadmin(userToEdit)}
                      checked={editForm.role === 'VIEWER'}
                      onChange={() => {
                        if (isProtectedSuperadmin(userToEdit)) return;
                        setEditForm({ ...editForm, role: 'VIEWER' });
                      }}
                      className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500 disabled:cursor-not-allowed"
                    />
                    <Eye className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="font-semibold tracking-wide">VIEWER</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  disabled={editLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: STATUS CHANGE CONFIRMATION
      ======================================================== */}
      {statusConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-3.5 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    statusConfirmUser.status === 'ACTIVE' || statusConfirmUser.is_active === true
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {statusConfirmUser.status === 'ACTIVE' || statusConfirmUser.is_active === true ? (
                    <UserX className="w-5 h-5" />
                  ) : (
                    <UserCheck className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {statusConfirmUser.status === 'ACTIVE' || statusConfirmUser.is_active === true
                      ? 'Deactivate User Account'
                      : 'Activate User Account'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {statusConfirmUser.status === 'ACTIVE' || statusConfirmUser.is_active === true ? (
                      <>
                        Are you sure you want to deactivate{' '}
                        <span className="font-semibold text-slate-800 font-mono">
                          {statusConfirmUser.username}
                        </span>
                        ? The user will immediately be blocked from logging in.
                      </>
                    ) : (
                      <>
                        Are you sure you want to activate{' '}
                        <span className="font-semibold text-slate-800 font-mono">
                          {statusConfirmUser.username}
                        </span>
                        ? The user will be permitted to authenticate and access the application.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusConfirmUser(null)}
                  disabled={statusActionLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStatusConfirm}
                  disabled={statusActionLoading}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60 ${
                    statusConfirmUser.status === 'ACTIVE' || statusConfirmUser.is_active === true
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {statusActionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating status...</span>
                    </>
                  ) : statusConfirmUser.status === 'ACTIVE' || statusConfirmUser.is_active === true ? (
                    <span>Deactivate Account</span>
                  ) : (
                    <span>Activate Account</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: PASSWORD RESET CONFIRMATION
      ======================================================== */}
      {resetConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Reset Password for {resetConfirmUser.username}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    This will reset the user's password to the default temporary password{' '}
                    <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                      test@123
                    </code>{' '}
                    and require them to change their password on next sign in.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetConfirmUser(null)}
                  disabled={resetActionLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetConfirm}
                  disabled={resetActionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {resetActionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Resetting password...</span>
                    </>
                  ) : (
                    <span>Confirm Reset</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: PASSWORD RESET SUCCESS NOTICE
      ======================================================== */}
      {resetSuccessInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Password Reset Complete
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                The password for user <span className="font-semibold text-slate-900 font-mono">{resetSuccessInfo.username}</span> has been reset successfully.
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Temporary Password:</span>
                  <code className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                    {resetSuccessInfo.temporary_password || 'test@123'}
                  </code>
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  Share this temporary password with the user. They will be prompted to choose a new password upon signing in.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setResetSuccessInfo(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
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
