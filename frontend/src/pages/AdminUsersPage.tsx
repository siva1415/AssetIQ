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
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { AdminUser, AvailableWorkdayUser } from '../types';

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
  const [modalPage, setModalPage] = useState<number>(1);
  const modalPageSize = 10;
  const [modalTotal, setModalTotal] = useState<number>(0);
  const [modalTotalPages, setModalTotalPages] = useState<number>(1);
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

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Load available Workday users with server-side pagination & search
  const searchReqIdRef = useRef<number>(0);
  const loadAvailableUsers = async (pageNumber: number = 1, searchQuery: string = '') => {
    const reqId = ++searchReqIdRef.current;
    setAvailableLoading(true);
    setModalError(null);
    try {
      const res = await api.getAvailableWorkdayUsers({
        page: pageNumber,
        page_size: modalPageSize,
        search: searchQuery.trim() || undefined,
      });
      if (reqId !== searchReqIdRef.current) return;
      setAvailableUsers(res.items);
      setModalTotal(res.total);
      setModalPage(res.page);
      setModalTotalPages(res.total_pages);
    } catch (err: any) {
      if (reqId !== searchReqIdRef.current) return;
      const status = err?.status || err?.response?.status;
      let errorMsg = 'Failed to fetch available users from Workday.';
      if (status === 405) {
        errorMsg = 'HTTP 405 Method Not Allowed: The server rejected GET request to /api/admin-users/available-users.';
      } else if (err?.message) {
        errorMsg = err.message;
      }
      setModalError(errorMsg);
    } finally {
      if (reqId === searchReqIdRef.current) {
        setAvailableLoading(false);
      }
    }
  };

  // Open the Add Admin User modal
  const handleOpenAddModal = () => {
    setUserSearch('');
    setModalPage(1);
    setModalTotal(0);
    setModalTotalPages(1);
    setSelectedUserIds(new Set());
    setModalError(null);
    setIsAddModalOpen(true);
    loadAvailableUsers(1, '');
  };

  // Debounce search in modal (300ms)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleUserSearchChange = (value: string) => {
    setUserSearch(value);
    setModalPage(1); // Reset to page 1 when search query changes
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadAvailableUsers(1, value);
    }, 300);
  };

  // Next and Previous page handlers
  const handlePrevPage = () => {
    if (modalPage > 1 && !availableLoading) {
      const prev = modalPage - 1;
      setModalPage(prev);
      loadAvailableUsers(prev, userSearch);
    }
  };

  const handleNextPage = () => {
    if (modalPage < modalTotalPages && !availableLoading) {
      const next = modalPage + 1;
      setModalPage(next);
      loadAvailableUsers(next, userSearch);
    }
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

  // Dynamic start and end indices for pagination summary
  const startIndex = modalTotal > 0 ? (modalPage - 1) * modalPageSize + 1 : 0;
  const endIndex = modalTotal > 0 ? Math.min(modalPage * modalPageSize, modalTotal) : 0;

  // Helper for user avatar initials
  const getInitials = (name: string): string => {
    if (!name || name === '—') return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Toggle single user selection (preserves selection across page turns and searches)
  const handleToggleUserSelection = (userId: string) => {
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

  // Submit bulk admin users via POST /api/admin-users
  const handleSubmitBulk = async () => {
    if (selectedUserIds.size === 0 || submittingBulk) {
      if (selectedUserIds.size === 0) {
        setModalError('Please select at least one Workday employee before submitting.');
      }
      return;
    }
    setSubmittingBulk(true);
    setModalError(null);
    try {
      const userIdsToAdd = Array.from(selectedUserIds);
      const res = await api.bulkAddAdminUsers(userIdsToAdd);

      setIsAddModalOpen(false);
      setSelectedUserIds(new Set());
      triggerDataRefresh();
      await loadAdminUsers();

      if (res.skipped_user_ids && res.skipped_user_ids.length > 0) {
        setNotification({
          type: res.added_count > 0 ? 'success' : 'error',
          message: `Added ${res.added_count} administrator(s). Skipped: ${res.skipped_user_ids.join(', ')}.`,
        });
      } else {
        setNotification({
          type: 'success',
          message: res.message || `Successfully registered ${res.added_count} administrator user${res.added_count === 1 ? '' : 's'}.`,
        });
      }
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      let errorMsg = 'Failed to add selected users as administrators.';
      if (status === 405) {
        errorMsg = 'HTTP 405 Method Not Allowed: The endpoint did not accept the POST request to /api/admin-users.';
      } else if (status === 422) {
        const detail = err?.detail || err?.response?.data?.detail;
        if (Array.isArray(detail)) {
          errorMsg = `Validation error (422): ${detail.map((d: any) => d.msg || `${d.loc ? d.loc.join('.') : ''}: ${JSON.stringify(d)}`).join(', ')}`;
        } else if (typeof detail === 'string') {
          errorMsg = `Validation error (422): ${detail}`;
        } else {
          errorMsg = 'Validation error (422): Invalid user IDs submitted.';
        }
      } else if (err?.message) {
        errorMsg = err.message;
      }
      setModalError(errorMsg);
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
            <span className="font-medium">{notification.message}</span>
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
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Admin User</span>
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
                : 'No users are currently registered in the admin_users table. Click "+ Add Admin User" to authorize Workday users.'}
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
                <span>+ Add Admin User</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="w-[18%] py-2.5 px-3">User ID</th>
                  <th className="w-[22%] py-2.5 px-3">Full Name</th>
                  <th className="w-[24%] py-2.5 px-3">Work Email</th>
                  <th className="w-[16%] py-2.5 px-3">Department</th>
                  <th className="w-[12%] py-2.5 px-3">Added On</th>
                  <th className="w-[8%] py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdminUsers.map(user => (
                  <tr key={user.admin_id} className="hover:bg-slate-50/70 transition-colors">
                    {/* User ID */}
                    <td className="py-2.5 px-3 align-middle">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200 break-all">
                          {user.admin_user_id}
                        </span>
                        <span
                          title="Admin"
                          aria-label="Admin"
                          className="inline-flex items-center text-indigo-600 shrink-0"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </span>
                      </div>
                    </td>

                    {/* Full Name */}
                    <td className="py-2.5 px-3 align-middle">
                      {user.full_name ? (
                        <div className="leading-tight">
                          <span className="font-semibold text-slate-900 block break-words">
                            {user.full_name}
                          </span>
                          {user.job_title && (
                            <span className="text-[10px] text-slate-400 block break-words mt-0.5">
                              {user.job_title}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Work Email */}
                    <td className="py-2.5 px-3 align-middle">
                      {user.email_work ? (
                        <div className="flex items-center gap-1.5 text-slate-700 leading-tight">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-[11px] break-all">{user.email_work}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="py-2.5 px-3 align-middle">
                      {user.department ? (
                        <div className="flex items-center gap-1.5 text-slate-700 leading-tight">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="break-words">{user.department}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Added On */}
                    <td className="py-2.5 px-3 align-middle">
                      <span className="font-mono text-[11px] text-slate-600 block truncate">
                        {formatDate(user.created_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap align-middle">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => setUserToDelete(user)}
                          className="w-7 h-7 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                          title="Remove Access"
                          aria-label={`Remove Access for ${user.admin_user_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog: Add Admin User Popup (Searchable Bulk Selection from Workday) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs transition-opacity"
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
                      Add Admin User
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select Workday employees to grant administrator privileges
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !submittingBulk && setIsAddModalOpen(false)}
                  disabled={submittingBulk}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Error Banner */}
              {modalError && (
                <div className="mx-6 mt-4 p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-medium">{modalError}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => loadAvailableUsers(modalPage, userSearch)}
                      className="px-2 py-0.5 bg-rose-600 text-white rounded text-[11px] font-medium hover:bg-rose-700 cursor-pointer"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalError(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Dismiss error"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Search and Selection Toolbar */}
              <div className="p-6 pb-3 shrink-0 space-y-3">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, user ID, email, or department"
                    value={userSearch}
                    onChange={e => handleUserSearchChange(e.target.value)}
                    className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                  />
                  {userSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserSearch('');
                        setModalPage(1);
                        loadAvailableUsers(1, '');
                      }}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Clear user search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Selected Count Indicator */}
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-slate-500">
                    Select individual employees to grant administrator privileges
                  </span>

                  <div className="flex items-center gap-3">
                    {selectedUserIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds(new Set())}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    )}
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 text-xs">
                      {selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'} selected
                    </span>
                  </div>
                </div>
              </div>

              {/* Employee Selection List */}
              <div className="flex-1 overflow-y-auto px-6 pb-2 min-w-0">
                {availableLoading && availableUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2.5">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">Loading Workday employees...</span>
                  </div>
                ) : modalError && availableUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                    <h4 className="text-xs font-semibold text-slate-800">Unable to load employee records</h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mt-1 mb-3">
                      {modalError}
                    </p>
                    <button
                      type="button"
                      onClick={() => loadAvailableUsers(modalPage, userSearch)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Request</span>
                    </button>
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <Users className="w-8 h-8 text-slate-300 mb-2" />
                    <h4 className="text-xs font-semibold text-slate-800">
                      {userSearch ? 'No matching employees found' : 'No available employees to add'}
                    </h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mt-1 mb-3">
                      {userSearch
                        ? `No Workday employees match "${userSearch}". Try searching by another name, user ID, email, or department.`
                        : 'All eligible Workday employees are already registered as administrators, or no records were returned.'}
                    </p>
                    {userSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserSearch('');
                          setModalPage(1);
                          loadAvailableUsers(1, '');
                        }}
                        className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium transition-colors cursor-pointer"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={`space-y-2 relative transition-opacity duration-150 ${availableLoading ? 'opacity-60 pointer-events-none' : ''}`}>
                    {availableUsers.map(emp => {
                      const isSelected = selectedUserIds.has(emp.user_id);

                      return (
                        <div
                          key={emp.user_id}
                          onClick={() => handleToggleUserSelection(emp.user_id)}
                          className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all cursor-pointer gap-2.5 sm:gap-4 ${
                            isSelected
                              ? 'bg-blue-50/75 border-blue-400 ring-1 ring-blue-500/20 shadow-xs'
                              : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Checkbox, Avatar, Name & ID */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleUserSelection(emp.user_id)}
                              onClick={e => e.stopPropagation()}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer shrink-0"
                              aria-label={`Select ${emp.full_name || emp.user_id}`}
                            />

                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {getInitials(emp.full_name || emp.user_id)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 text-xs">
                                  {emp.full_name || '—'}
                                </span>
                                <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 shrink-0 font-medium">
                                  {emp.user_id}
                                </span>
                              </div>
                              {emp.job_title && (
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {emp.job_title}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Email & Department */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-2.5 sm:gap-4 pl-11 sm:pl-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline-block" />
                              <span className="font-mono text-[11px] truncate max-w-[160px] sm:max-w-[200px]" title={emp.email_work || ''}>
                                {emp.email_work || '—'}
                              </span>
                            </div>

                            <div className="text-left sm:text-right shrink-0">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 rounded-md border border-slate-200 whitespace-nowrap shrink-0"
                              >
                                <Building className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="whitespace-nowrap">{emp.department || '—'}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination Controls inside Modal */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-6 py-2.5 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600 shrink-0">
                <div className="text-[11px]">
                  {modalTotal > 0 ? (
                    <>
                      Showing <span className="font-semibold text-slate-900">{startIndex}</span> to{' '}
                      <span className="font-semibold text-slate-900">{endIndex}</span> of{' '}
                      <span className="font-semibold text-slate-900">{modalTotal}</span> employees
                    </>
                  ) : (
                    <span>Showing 0 employees</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={modalPage <= 1 || availableLoading || modalTotal === 0}
                    className="p-1 border border-slate-200 rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Previous page"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-medium px-2">
                    Page {modalTotal > 0 ? modalPage : 1} of {Math.max(1, modalTotalPages)}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={modalPage >= modalTotalPages || availableLoading || modalTotal === 0}
                    className="p-1 border border-slate-200 rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Next page"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Footer / Action Buttons */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/80 shrink-0">
                <div className="text-xs text-slate-600">
                  {selectedUserIds.size > 0 ? (
                    <span className="font-semibold text-slate-900">
                      {selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'} selected
                    </span>
                  ) : (
                    <span>Select employees to grant administrator privileges</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={submittingBulk}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitBulk}
                    disabled={selectedUserIds.size === 0 || submittingBulk}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                      selectedUserIds.size > 0 && !submittingBulk
                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {submittingBulk ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding Selected Users...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Add Selected Users</span>
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
                  className="px-3.5 py-1.5 text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-white bg-rose-600 hover:bg-rose-700 rounded-md font-semibold transition-colors disabled:opacity-50 cursor-pointer"
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
