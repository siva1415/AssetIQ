import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Trash2,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  Check,
  Mail,
  Building,
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { AdminUser, AvailableWorkdayUser } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const AdminUsersPage: React.FC = () => {
  const { dataRefreshKey, triggerDataRefresh } = useApp();

  // Registered Admin Users state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Add Admin Users modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [availableUsers, setAvailableUsers] = useState<AvailableWorkdayUser[]>([]);
  const [availableLoading, setAvailableLoading] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [submittingBulk, setSubmittingBulk] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Auto-dismiss notification after 5s
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Load Admin Users from API
  const loadAdminUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers();
      setAdminUsers(data);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Failed to fetch registered admin users.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminUsers();
  }, [dataRefreshKey]);

  // Load available Workday users when modal is opened or user searches
  const loadAvailableUsers = async (searchQuery?: string) => {
    setAvailableLoading(true);
    setModalError(null);
    try {
      const data = await api.getAvailableWorkdayUsers(searchQuery);
      setAvailableUsers(data);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to fetch available users from Workday.');
    } finally {
      setAvailableLoading(false);
    }
  };

  // Open the Add Admin User modal
  const handleOpenAddModal = () => {
    setUserSearch('');
    setSelectedUserIds(new Set());
    setModalError(null);
    setIsAddModalOpen(true);
    loadAvailableUsers();
  };

  // Debounce search in modal
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleUserSearchChange = (value: string) => {
    setUserSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadAvailableUsers(value);
    }, 250);
  };

  // Filter registered admin users by search query
  const filteredAdminUsers = useMemo(() => {
    if (!search.trim()) return adminUsers;
    const q = search.trim().toLowerCase();
    return adminUsers.filter(
      u =>
        u.admin_user_id.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email_work && u.email_work.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
    );
  }, [adminUsers, search]);

  // Selectable users in the modal (excluding already-admin users)
  const selectableAvailableUsers = useMemo(() => {
    return availableUsers.filter(u => !u.is_admin);
  }, [availableUsers]);

  // Check if all currently visible selectable users are selected
  const allVisibleSelected = useMemo(() => {
    if (selectableAvailableUsers.length === 0) return false;
    return selectableAvailableUsers.every(u => selectedUserIds.has(u.user_id));
  }, [selectableAvailableUsers, selectedUserIds]);

  // Some visible selectable users selected (for indeterminate status)
  const someVisibleSelected = useMemo(() => {
    return (
      selectableAvailableUsers.some(u => selectedUserIds.has(u.user_id)) &&
      !allVisibleSelected
    );
  }, [selectableAvailableUsers, selectedUserIds, allVisibleSelected]);

  // Toggle single user selection
  const handleToggleUserSelection = (userId: string, isDisabled: boolean) => {
    if (isDisabled) return;
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Toggle select all visible
  const handleToggleSelectAllVisible = () => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        // Deselect all currently visible selectable users
        selectableAvailableUsers.forEach(u => next.delete(u.user_id));
      } else {
        // Select all currently visible selectable users
        selectableAvailableUsers.forEach(u => next.add(u.user_id));
      }
      return next;
    });
  };

  // Submit bulk admin users
  const handleSubmitBulk = async () => {
    if (selectedUserIds.size === 0) return;
    setSubmittingBulk(true);
    setModalError(null);
    try {
      const userIdsToAdd = Array.from(selectedUserIds);
      const res = await api.bulkAddAdminUsers(userIdsToAdd);

      setIsAddModalOpen(false);
      setSelectedUserIds(new Set());
      triggerDataRefresh();
      await loadAdminUsers();

      setNotification({
        type: 'success',
        message: res.message || `Successfully registered ${res.added_count} administrator users.`,
      });
    } catch (err: any) {
      setModalError(err?.message || 'Failed to add selected users as administrators.');
    } finally {
      setSubmittingBulk(false);
    }
  };

  // Confirm delete single admin user
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await api.deleteAdminUser(userToDelete.admin_user_id);
      setUserToDelete(null);
      triggerDataRefresh();
      await loadAdminUsers();
      setNotification({
        type: 'success',
        message: `Admin access removed for user '${userToDelete.admin_user_id}'.`,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || `Failed to remove admin user '${userToDelete.admin_user_id}'.`,
      });
    } finally {
      setDeleting(false);
    }
  };

  // Date formatting helper: "DD MMM YYYY, HH:mm"
  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search, Status and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, name, email, or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs justify-end">
          <span className="text-slate-500 font-mono text-[11px]">
            {filteredAdminUsers.length} of {adminUsers.length} admin user
            {adminUsers.length === 1 ? '' : 's'}
          </span>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button
            onClick={() => loadAdminUsers()}
            disabled={loading}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh Table Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Admin User</span>
          </button>
        </div>
      </div>

      {/* Main Admin Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading registered administrator accounts...</span>
          </div>
        ) : filteredAdminUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-300 mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No admin users found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              {search
                ? 'No registered administrators match your search query. Try clearing filters.'
                : 'No users are currently registered in the admin_users table. Click "Add Admin User" to authorize Workday users.'}
            </p>
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Admin User</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Work Email</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Added On</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdminUsers.map(user => (
                  <tr key={user.admin_id} className="hover:bg-slate-50/70 transition-colors">
                    {/* User ID */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {user.admin_user_id}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Admin
                        </span>
                      </div>
                    </td>

                    {/* Full Name */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {user.full_name ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {user.full_name}
                          </span>
                          {user.job_title && (
                            <span className="text-[10px] text-slate-400 block">
                              {user.job_title}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Work Email */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {user.email_work ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-[11px]">{user.email_work}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {user.department ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{user.department}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Added On */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-slate-600">
                        {formatDate(user.created_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setUserToDelete(user)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors text-xs border border-transparent hover:border-rose-200"
                        title={`Remove admin access for ${user.admin_user_id}`}
                        aria-label={`Remove admin access for ${user.admin_user_id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Access</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog: Add Admin Users (Bulk Selection from Workday) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => !submittingBulk && setIsAddModalOpen(false)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Add Admin Users
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => !submittingBulk && setIsAddModalOpen(false)}
                  disabled={submittingBulk}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Error Banner */}
              {modalError && (
                <div className="mx-6 mt-4 p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                  <button
                    onClick={() => setModalError(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* User Search Input Toolbar */}
              <div className="p-6 pb-3 shrink-0">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users by ID, name, or email..."
                      value={userSearch}
                      onChange={e => handleUserSearchChange(e.target.value)}
                      className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    {userSearch && (
                      <button
                        onClick={() => {
                          setUserSearch('');
                          loadAvailableUsers('');
                        }}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                        aria-label="Clear user search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                      {selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'} selected
                    </span>
                  </div>
                </div>
              </div>

              {/* Selectable Users Table */}
              <div className="flex-1 overflow-y-auto px-6 pb-4 min-w-0">
                <div className="border border-slate-200 rounded-lg overflow-hidden w-full">
                  {availableLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-xs">Querying Workday employee directory...</span>
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <Users className="w-8 h-8 text-slate-300 mb-2" />
                      <h4 className="text-xs font-semibold text-slate-800">No users found</h4>
                      <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                        {userSearch
                          ? 'No Workday records matched your search query. Try another name or ID.'
                          : 'No Workday employee records available to display.'}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full table-fixed text-left text-xs divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-2xs">
                        <tr>
                          {/* 1. Checkbox */}
                          <th className="py-2.5 px-3 w-10 text-center shrink-0">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              ref={el => {
                                if (el) el.indeterminate = someVisibleSelected;
                              }}
                              onChange={handleToggleSelectAllVisible}
                              disabled={selectableAvailableUsers.length === 0}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer disabled:opacity-40"
                              title="Select All visible users"
                              aria-label="Select All visible users"
                            />
                          </th>
                          {/* 2. User ID */}
                          <th className="py-2.5 px-3 w-32">User ID</th>
                          {/* 3. Full Name */}
                          <th className="py-2.5 px-3 w-[30%]">Full Name</th>
                          {/* 4. Work Email */}
                          <th className="py-2.5 px-3 w-[36%]">Work Email</th>
                          {/* 5. Employee Status */}
                          <th className="py-2.5 px-3 w-28 text-center">Employee Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {availableUsers.map(emp => {
                          const isSelected = selectedUserIds.has(emp.user_id);
                          const isAlreadyAdmin = emp.is_admin;

                          return (
                            <tr
                              key={emp.user_id}
                              onClick={() => handleToggleUserSelection(emp.user_id, isAlreadyAdmin)}
                              className={`transition-colors ${
                                isAlreadyAdmin
                                  ? 'bg-slate-50/60 cursor-not-allowed opacity-75'
                                  : isSelected
                                  ? 'bg-blue-50/60 hover:bg-blue-50/90 cursor-pointer'
                                  : 'hover:bg-slate-50/80 cursor-pointer'
                              }`}
                            >
                              {/* 1. Checkbox */}
                              <td className="py-2.5 px-3 text-center shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected || isAlreadyAdmin}
                                  disabled={isAlreadyAdmin}
                                  onChange={() => handleToggleUserSelection(emp.user_id, isAlreadyAdmin)}
                                  onClick={e => e.stopPropagation()}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed disabled:text-slate-400"
                                  aria-label={`Select ${emp.full_name || emp.user_id}`}
                                />
                              </td>

                              {/* 2. User ID */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className="font-mono font-medium text-slate-800 truncate"
                                    title={emp.user_id}
                                  >
                                    {emp.user_id || '—'}
                                  </span>
                                  {isAlreadyAdmin && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                      Already Admin
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 3. Full Name */}
                              <td className="py-2.5 px-3">
                                <div className="min-w-0">
                                  <span
                                    className="font-semibold text-slate-900 block truncate"
                                    title={emp.full_name || '—'}
                                  >
                                    {emp.full_name || '—'}
                                  </span>
                                  {emp.job_title && (
                                    <span
                                      className="text-[10px] text-slate-400 block truncate"
                                      title={emp.job_title}
                                    >
                                      {emp.job_title}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 4. Work Email */}
                              <td className="py-2.5 px-3">
                                <span
                                  className="font-mono text-[11px] text-slate-600 block truncate"
                                  title={emp.email_work || '—'}
                                >
                                  {emp.email_work || '—'}
                                </span>
                              </td>

                              {/* 5. Employee Status */}
                              <td className="py-2.5 px-3 text-center">
                                <StatusBadge
                                  status={emp.employee_status || 'Unknown'}
                                  type="employee"
                                  variant="solid"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Modal Footer / Action Buttons */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/70 shrink-0">
                <div className="text-xs text-slate-600">
                  {selectedUserIds.size > 0 ? (
                    <span className="font-semibold text-slate-900">
                      {selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'} ready to be registered as admin
                    </span>
                  ) : (
                    <span>Select one or more users to grant admin access</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={submittingBulk}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitBulk}
                    disabled={selectedUserIds.size === 0 || submittingBulk}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingBulk ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding Users...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          Add Selected Users ({selectedUserIds.size})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => !deleting && setUserToDelete(null)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all p-5 text-xs">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-full shrink-0 border border-rose-100">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Remove Admin Access?</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Revoke administrator privileges for this user.
                  </p>
                </div>
              </div>

              <p className="text-slate-600 mb-4 leading-relaxed">
                Are you sure you want to remove administrator authorization for{' '}
                <span className="font-semibold text-slate-900 font-mono">
                  {userToDelete.admin_user_id}
                </span>{' '}
                {userToDelete.full_name ? `(${userToDelete.full_name})` : ''}? This will remove the record from{' '}
                <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-mono">admin_users</code>. The user's underlying Workday employee profile will not be deleted.
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={deleting}
                  className="px-3.5 py-1.5 text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-white bg-rose-600 hover:bg-rose-700 rounded-md font-semibold transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>Remove Access</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
