import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileCheck2,
  Search,
  CheckCircle2,
  AlertCircle,
  Layers,
  Eye,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Clock,
  User,
  Tag,
  Shield,
  HelpCircle,
  Lock,
  Building2,
  Laptop,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, ApiError } from '../services/api';
import {
  AuditLogItem,
  AuditLogsQueryParams,
  PaginatedAuditLogsResponse,
  AuditSummaryData,
  AuditCategory,
  AuditStatus,
} from '../types';
import { CopyButton } from '../components/common/CopyButton';

// Sensitive keys that must NEVER be rendered in audit logs diffs
const SENSITIVE_KEYS_REGEX = /password|hash|secret|token|salt|credential|key/i;

// Supported Actions
const ACTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'ASSIGN_ASSET', label: 'Assign Asset' },
  { value: 'REASSIGN_ASSET', label: 'Reassign Asset' },
  { value: 'BULK_ASSIGN', label: 'Bulk Assign Assets' },
  { value: 'UNASSIGN_ASSET', label: 'Unassign Asset' },
  { value: 'CREATE_EOL', label: 'Add EOL Model' },
  { value: 'UPDATE_EOL', label: 'Update EOL Model' },
  { value: 'DELETE_EOL', label: 'Delete EOL Model' },
  { value: 'ADD_ADMIN_USER', label: 'Add Admin User' },
  { value: 'REMOVE_ADMIN_USER', label: 'Remove Admin User' },
  { value: 'CREATE_USER', label: 'Create Portal User' },
  { value: 'UPDATE_USER', label: 'Update Portal User' },
  { value: 'ACTIVATE_USER', label: 'Activate User' },
  { value: 'DEACTIVATE_USER', label: 'Deactivate User' },
  { value: 'RESET_PASSWORD', label: 'Reset Password' },
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TargetEmployeeInfo {
  targetName: string | null;
  targetUsername: string | null;
}

function getTargetEmployee(event: AuditLogItem): TargetEmployeeInfo {
  const nv = (event.new_values && typeof event.new_values === 'object' ? event.new_values : {}) as Record<string, any>;
  const meta = (event.metadata && typeof event.metadata === 'object' ? event.metadata : {}) as Record<string, any>;

  // Check if assigned_to is an object in new_values or metadata
  const assignedObj =
    (typeof nv.assigned_to === 'object' && nv.assigned_to !== null ? nv.assigned_to : null) ||
    (typeof nv.assigned_employee === 'object' && nv.assigned_employee !== null ? nv.assigned_employee : null) ||
    (typeof meta.assigned_to === 'object' && meta.assigned_to !== null ? meta.assigned_to : null) ||
    (typeof meta.employee === 'object' && meta.employee !== null ? meta.employee : null) ||
    null;

  let targetName: string | null =
    nv.assigned_to_name ||
    nv.assigned_to_full_name ||
    nv.employee_name ||
    nv.employee_full_name ||
    nv.assigned_employee_name ||
    nv.target_user_name ||
    nv.full_name ||
    assignedObj?.full_name ||
    assignedObj?.name ||
    meta.assigned_to_name ||
    meta.employee_name ||
    meta.full_name ||
    (event.entity_type === 'EMPLOYEE' && event.entity_name ? event.entity_name : null) ||
    null;

  let targetUsername: string | null =
    nv.assigned_to_username ||
    nv.assigned_username ||
    nv.employee_username ||
    nv.target_username ||
    nv.username ||
    assignedObj?.username ||
    assignedObj?.user_id ||
    meta.assigned_to_username ||
    meta.employee_username ||
    meta.username ||
    null;

  // Sometimes assigned_to is a combined string e.g. "Jane Smith (jsmith)"
  if (typeof nv.assigned_to === 'string' && nv.assigned_to.trim()) {
    const str = nv.assigned_to.trim();
    const match = str.match(/^([^(]+?)\s*\(([^)]+)\)$/);
    if (match) {
      if (!targetName) targetName = match[1].trim();
      if (!targetUsername) targetUsername = match[2].trim();
    } else if (!targetUsername && !targetName) {
      targetUsername = str;
    }
  }

  // Clean strings
  if (targetName) targetName = targetName.trim();
  if (targetUsername) targetUsername = targetUsername.trim();

  // If targetName contains (username) inside it, separate them cleanly
  if (targetName) {
    const combinedMatch = targetName.match(/^([^(]+?)\s*\(([^)]+)\)$/);
    if (combinedMatch) {
      targetName = combinedMatch[1].trim();
      if (!targetUsername) targetUsername = combinedMatch[2].trim();
    }
  }

  return { targetName, targetUsername };
}

export function formatAuditFinding(event: AuditLogItem): string {
  const baseFinding = (event.audit_finding || event.finding || event.description || '').trim();
  if (!baseFinding) return '—';

  const categoryNorm = String(event.category || '').toUpperCase().replace(/[\s-]/g, '_');
  // Only format Asset Ownership events
  if (categoryNorm !== 'ASSET_OWNERSHIP') {
    return baseFinding;
  }

  const { targetName, targetUsername } = getTargetEmployee(event);
  if (!targetName && !targetUsername) {
    return baseFinding;
  }

  // If targetUsername is already present enclosed in parentheses in baseFinding (e.g. (jsmith)), DO NOT re-append
  if (targetUsername && new RegExp(`\\(\\s*${escapeRegExp(targetUsername)}\\s*\\)`, 'i').test(baseFinding)) {
    return baseFinding;
  }

  // Both targetName and targetUsername are available
  if (targetName && targetUsername) {
    if (targetName.toLowerCase() === targetUsername.toLowerCase()) {
      if (new RegExp(`\\b${escapeRegExp(targetUsername)}\\b`, 'i').test(baseFinding)) {
        return baseFinding;
      }
      return `${baseFinding.replace(/\.?$/, '')} to ${targetName}.`;
    }

    // Check if baseFinding mentions targetName without parentheses
    const nameRegex = new RegExp(`(${escapeRegExp(targetName)})(?!\\s*\\()`, 'i');
    if (nameRegex.test(baseFinding)) {
      return baseFinding.replace(nameRegex, `$1 (${targetUsername})`);
    }

    // Check if baseFinding mentions targetUsername alone without being preceded by full name
    const usernameRegex = new RegExp(`\\b${escapeRegExp(targetUsername)}\\b`, 'i');
    if (usernameRegex.test(baseFinding)) {
      return baseFinding.replace(usernameRegex, `${targetName} (${targetUsername})`);
    }

    // If neither name nor username is in finding, but it's an assignment finding:
    if (/assigned/i.test(baseFinding) && !/unassigned/i.test(baseFinding)) {
      if (!new RegExp(escapeRegExp(targetName), 'i').test(baseFinding)) {
        return `${baseFinding.replace(/\.?$/, '')} to ${targetName} (${targetUsername}).`;
      }
    }
    return baseFinding;
  }

  // Only targetUsername is available
  if (targetUsername && !targetName) {
    const usernameAlone = new RegExp(`\\b${escapeRegExp(targetUsername)}\\b`, 'i');
    if (usernameAlone.test(baseFinding)) {
      return baseFinding;
    }
    if (/assigned/i.test(baseFinding) && !/unassigned/i.test(baseFinding)) {
      return `${baseFinding.replace(/\.?$/, '')} to ${targetUsername}.`;
    }
  }

  // Only targetName is available
  if (targetName && !targetUsername) {
    if (new RegExp(escapeRegExp(targetName), 'i').test(baseFinding)) {
      return baseFinding;
    }
    if (/assigned/i.test(baseFinding) && !/unassigned/i.test(baseFinding)) {
      return `${baseFinding.replace(/\.?$/, '')} to ${targetName}.`;
    }
  }

  return baseFinding;
}

export const AuditReportsPage: React.FC = () => {
  const { currentUser } = useApp();

  // Role authorization: Only SUPERADMIN is permitted
  const isSuperadmin = currentUser.role === 'SUPERADMIN';

  // Filters State
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Data & Request State
  const [data, setData] = useState<PaginatedAuditLogsResponse | null>(null);
  const [summaryData, setSummaryData] = useState<AuditSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | string | null>(null);

  // Selected Event Details Modal / Drawer State
  const [selectedEvent, setSelectedEvent] = useState<AuditLogItem | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  // Debounce search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page to 1 when any filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, startDate, endDate, pageSize]);

  // Fetch Audit Logs from Backend API
  const fetchAuditLogs = useCallback(async () => {
    if (!isSuperadmin) return;

    setLoading(true);
    setError(null);

    const params: AuditLogsQueryParams = {
      page,
      page_size: pageSize,
      sort_by: 'detected_at',
      order: 'desc',
    };

    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (status) params.status = status;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    try {
      const response = await api.getAuditLogs(params);
      setData(response);

      // If backend returned summary in response, store it
      if (response.summary) {
        setSummaryData(response.summary);
      }
    } catch (err: any) {
      console.error('Failed to fetch audit logs from backend:', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, page, pageSize, debouncedSearch, status, startDate, endDate]);

  // Initial load & when parameters change
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Attempt to fetch dedicated summary data once if not already provided
  useEffect(() => {
    if (!isSuperadmin) return;
    let isMounted = true;
    api
      .getAuditSummary()
      .then(res => {
        if (isMounted && res) {
          setSummaryData(res);
        }
      })
      .catch(() => {
        // Summary endpoint is optional; ignore failures
      });
    return () => {
      isMounted = false;
    };
  }, [isSuperadmin]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (status) count++;
    if (startDate) count++;
    if (endDate) count++;
    return count;
  }, [search, status, startDate, endDate]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Format date helper preserving timezone
  const formatDateTime = (timestamp?: string | null): string => {
    if (!timestamp) return '—';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return String(timestamp);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return String(timestamp);
    }
  };

  // Full ISO Tooltip
  const getFullTimestampTooltip = (timestamp?: string | null): string => {
    if (!timestamp) return '';
    try {
      const d = new Date(timestamp);
      return !isNaN(d.getTime()) ? `${d.toISOString()} (Local: ${d.toLocaleString()})` : String(timestamp);
    } catch {
      return String(timestamp);
    }
  };

  // Category Badge Renderer
  const renderCategoryBadge = (cat?: string) => {
    const norm = String(cat || '').toUpperCase().replace(/[\s-]/g, '_');
    if (norm === 'ASSET_OWNERSHIP') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
          <Laptop className="w-3 h-3 text-blue-600" />
          <span>Asset Ownership</span>
        </span>
      );
    }
    if (norm === 'EOL_MANAGEMENT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>EOL Management</span>
        </span>
      );
    }
    if (norm === 'ADMIN_USERS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
          <Shield className="w-3 h-3 text-purple-600" />
          <span>Admin Users</span>
        </span>
      );
    }
    if (norm === 'USER_MANAGEMENT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
          <User className="w-3 h-3 text-teal-600" />
          <span>User Management</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
        <Layers className="w-3 h-3 text-slate-500" />
        <span>{cat || 'General'}</span>
      </span>
    );
  };

  // Status Badge Renderer
  const renderStatusBadge = (stat?: string) => {
    const isSuccess = String(stat || '').toUpperCase() === 'SUCCESS';
    if (isSuccess) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>SUCCESS</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>FAILURE</span>
      </span>
    );
  };

  // Format Action name for readable display
  const formatActionName = (act?: string): string => {
    if (!act) return '—';
    const match = ACTIONS.find(a => a.value === act);
    if (match) return match.label;
    return act
      .toLowerCase()
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // RBAC Access Denied Fallback if not SUPERADMIN
  if (!isSuperadmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-full mb-4 border border-rose-200">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">
          Audit Logs contain enterprise security and regulatory compliance records. This page is restricted exclusively to SUPERADMIN accounts.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
        >
          Return to Dashboard
        </a>
      </div>
    );
  }

  // Determine if Summary Cards have genuine data from backend
  const hasRealSummaryData = Boolean(
    summaryData?.asset_ownership !== undefined ||
    summaryData?.eol_management !== undefined ||
    summaryData?.user_management !== undefined ||
    summaryData?.admin_users !== undefined ||
    summaryData?.category_counts
  );

  return (
    <div className="space-y-4">

      {/* Summary Cards (Displayed if real API data is available) */}
      {hasRealSummaryData && summaryData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Events */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Events</span>
              <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900 mt-2 font-mono">
              {(summaryData.total_events ?? summaryData.total ?? data?.total ?? 0).toLocaleString()}
            </p>
          </div>

          {/* Asset Ownership */}
          {summaryData.asset_ownership !== undefined && (
            <div className="p-4 bg-white rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-900">Asset Ownership</span>
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Laptop className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-blue-950 mt-2 font-mono">
                {summaryData.asset_ownership.toLocaleString()}
              </p>
            </div>
          )}

          {/* EOL Management */}
          {summaryData.eol_management !== undefined && (
            <div className="p-4 bg-white rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-900">EOL Management</span>
                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-amber-950 mt-2 font-mono">
                {summaryData.eol_management.toLocaleString()}
              </p>
            </div>
          )}

          {/* User Administration */}
          {(summaryData.user_management !== undefined || summaryData.user_administration !== undefined || summaryData.admin_users !== undefined) && (
            <div className="p-4 bg-white rounded-xl border border-teal-200/80 bg-teal-50/20 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-teal-900">User Administration</span>
                <div className="p-1.5 bg-teal-100 text-teal-700 rounded-lg">
                  <User className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-teal-950 mt-2 font-mono">
                {(
                  (summaryData.user_management ?? summaryData.user_administration ?? 0) +
                  (summaryData.admin_users ?? 0)
                ).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Filter Toolbar: Search Box | All Statuses | From | To */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* 1. Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search asset tag, user, or audit finding..."
              className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. All Statuses */}
          <div className="w-full sm:w-auto shrink-0">
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full sm:w-36 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>
          </div>

          {/* 3. From (Start Date) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-500 font-medium text-xs whitespace-nowrap">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
              aria-label="Start date filter"
            />
          </div>

          {/* 4. To (End Date) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-500 font-medium text-xs whitespace-nowrap">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
              aria-label="End date filter"
            />
          </div>

          {/* Active Filter Clear Control */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer shrink-0 border border-rose-200/60"
              title="Clear applied filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear ({activeFiltersCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Loading, Error, Empty, or Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-12 flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-800">Loading audit records...</p>
          <p className="text-xs text-slate-500 mt-1">Retrieving verified event log history from server</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">Failed to Load Audit Logs</h3>
              <p className="text-xs text-slate-600 mt-1">
                {error instanceof ApiError
                  ? error.message
                  : error instanceof Error
                  ? error.message
                  : String(error)}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Request</span>
                </button>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear Applied Filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
          <div className="inline-flex p-3 bg-slate-50 text-slate-400 rounded-full mb-3 border border-slate-100">
            <FileCheck2 className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No audit events found for the selected filters.</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {activeFiltersCount > 0
              ? 'Try widening your date range, clearing search terms, or resetting status.'
              : 'There are currently no recorded audit events in the system log.'}
          </p>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      ) : (
        /* Audit Logs Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3.5 w-[14%]">
                    Asset Tag
                  </th>
                  <th scope="col" className="px-4 py-3.5 w-[18%]">
                    Portal User
                  </th>
                  <th scope="col" className="px-4 py-3.5 w-[16%]">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3.5 w-[30%]">
                    Audit Finding
                  </th>
                  <th scope="col" className="px-4 py-3.5 w-[14%]">
                    Detected At
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right w-[8%]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map(event => {
                  const assetTag = event.asset_tag || event.asset_number;
                  const actorFullName =
                    event.portal_user_full_name ||
                    event.actor?.full_name ||
                    event.actor_full_name ||
                    event.actor?.name ||
                    event.actor_name ||
                    event.portal_user_name ||
                    null;
                  const actorUsername =
                    event.portal_username ||
                    event.actor?.username ||
                    event.actor_username ||
                    event.portal_user ||
                    event.username ||
                    null;
                  const actorRole = event.actor?.role || event.actor_role || null;
                  const findingText = formatAuditFinding(event);

                  return (
                    <tr
                      key={String(event.id || event.audit_id || Math.random())}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. Asset Tag */}
                      <td className="px-4 py-3 align-top">
                        {assetTag && assetTag !== '—' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                              {assetTag}
                            </span>
                            <CopyButton text={assetTag} label="Asset Tag" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>

                      {/* 2. Portal User (Actor) */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col min-w-0">
                          {actorFullName ? (
                            <>
                              <span className="font-semibold text-slate-900 truncate">
                                {actorFullName}
                              </span>
                              {actorUsername && (
                                <span className="text-[11px] text-slate-500 font-mono truncate">
                                  {actorUsername.startsWith('@') ? actorUsername : `@${actorUsername}`}
                                </span>
                              )}
                            </>
                          ) : actorUsername ? (
                            <span className="font-semibold text-slate-900 font-mono text-[11px] truncate">
                              {actorUsername.startsWith('@') ? actorUsername : `@${actorUsername}`}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                          {actorRole && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {actorRole}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Category & Action */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1 items-start">
                          {renderCategoryBadge(event.category)}
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]" title={event.action}>
                            {formatActionName(event.action)}
                          </span>
                        </div>
                      </td>

                      {/* 4. Audit Finding */}
                      <td className="px-4 py-3 align-top">
                        <p className="text-slate-800 leading-snug line-clamp-2" title={findingText}>
                          {findingText}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          {renderStatusBadge(event.status)}
                          {event.entity_name && (
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">
                              Target: {event.entity_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Detected At */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div
                          className="flex flex-col cursor-help"
                          title={getFullTimestampTooltip(event.detected_at)}
                        >
                          <span className="text-slate-800 font-medium">
                            {formatDateTime(event.detected_at)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {event.detected_at.includes('T') ? event.detected_at.split('T')[0] : ''}
                          </span>
                        </div>
                      </td>

                      {/* 6. Details Action */}
                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowRawJson(false);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          title="View audit event details & diff"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/70 text-xs">
            <div className="flex items-center gap-3 text-slate-500 font-medium">
              <span>
                Showing{' '}
                <span className="font-semibold text-slate-900">
                  {Math.min((data.page - 1) * data.page_size + 1, data.total)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-900">
                  {Math.min(data.page * data.page_size, data.total)}
                </span>{' '}
                of <span className="font-semibold text-slate-900">{data.total.toLocaleString()}</span> entries
              </span>

              <div className="h-4 w-px bg-slate-300 hidden sm:block" />

              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="h-7 px-2 text-xs bg-white border border-slate-200 rounded-md text-slate-700 font-semibold focus:outline-none focus:border-blue-600 cursor-pointer"
                  aria-label="Items per page"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Next / Previous Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={data.page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 text-slate-600 font-medium">
                Page <span className="font-bold text-slate-900">{data.page}</span> of{' '}
                <span className="font-bold text-slate-900">{data.total_pages}</span>
              </span>

              <button
                type="button"
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={data.page >= data.total_pages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row-Level Details Modal / Slide-Over Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs transition-opacity"
            onClick={() => setSelectedEvent(null)}
          />

          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        Audit Event Details
                      </h3>
                      <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                        #{String(selectedEvent.id || selectedEvent.audit_id)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Immutable record of enterprise activity and state change
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CopyButton
                    text={String(selectedEvent.id || selectedEvent.audit_id)}
                    label="Audit ID"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              {(() => {
                const popupActorFullName =
                  selectedEvent.portal_user_full_name ||
                  selectedEvent.actor?.full_name ||
                  selectedEvent.actor_full_name ||
                  selectedEvent.actor?.name ||
                  selectedEvent.actor_name ||
                  selectedEvent.portal_user_name ||
                  null;

                const popupActorUsername =
                  selectedEvent.portal_username ||
                  selectedEvent.actor?.username ||
                  selectedEvent.actor_username ||
                  selectedEvent.portal_user ||
                  selectedEvent.username ||
                  null;

                const popupActorRole = selectedEvent.actor?.role || selectedEvent.actor_role || null;

                return (
                  <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                    {/* Audit Finding Highlight Banner */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Audit Finding
                        </span>
                        {renderStatusBadge(selectedEvent.status)}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                        {formatAuditFinding(selectedEvent)}
                      </p>
                    </div>

                    {/* Event Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Category */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl">
                        <span className="text-slate-500 font-medium text-[11px]">Category</span>
                        <div className="mt-1.5">{renderCategoryBadge(selectedEvent.category)}</div>
                      </div>

                      {/* Action */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl">
                        <span className="text-slate-500 font-medium text-[11px]">Action</span>
                        <p className="mt-1.5 font-bold text-slate-900 font-mono text-xs">
                          {selectedEvent.action}
                        </p>
                      </div>

                      {/* Detected At */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl">
                        <span className="text-slate-500 font-medium text-[11px]">Detected At</span>
                        <p className="mt-1.5 font-semibold text-slate-900">
                          {formatDateTime(selectedEvent.detected_at)}
                        </p>
                      </div>

                      {/* Actor / Portal User */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl">
                        <span className="text-slate-500 font-medium text-[11px]">Actor (Portal User)</span>
                        {popupActorFullName ? (
                          <>
                            <p className="mt-1 font-bold text-slate-900 truncate">
                              {popupActorFullName}
                            </p>
                            {popupActorUsername && (
                              <p className="text-[11px] text-slate-500 font-mono truncate">
                                {popupActorUsername.startsWith('@') ? popupActorUsername : `@${popupActorUsername}`}
                              </p>
                            )}
                          </>
                        ) : popupActorUsername ? (
                          <p className="mt-1 font-bold text-slate-900 font-mono text-xs truncate">
                            {popupActorUsername.startsWith('@') ? popupActorUsername : `@${popupActorUsername}`}
                          </p>
                        ) : (
                          <p className="mt-1 text-slate-400 font-mono text-xs">—</p>
                        )}
                        {popupActorRole && (
                          <span className="mt-1 inline-block text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {popupActorRole}
                          </span>
                        )}
                      </div>

                  {/* Asset Tag */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-500 font-medium text-[11px]">Asset Tag</span>
                    <p className="mt-1 font-bold text-slate-900 font-mono text-sm">
                      {selectedEvent.asset_tag || selectedEvent.asset_number || '—'}
                    </p>
                  </div>

                  {/* Target Entity */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-500 font-medium text-[11px]">Target Entity</span>
                    <p className="mt-1 font-bold text-slate-900 truncate">
                      {selectedEvent.entity_name || selectedEvent.entity_id || '—'}
                    </p>
                    {selectedEvent.entity_type && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        Type: {selectedEvent.entity_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* State Diff View: old_values vs new_values */}
                {(selectedEvent.old_values || selectedEvent.new_values) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Field-Level State Change</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        (Before vs. After Values)
                      </span>
                    </h4>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-[11px] font-bold text-slate-600">
                          <tr>
                            <th className="px-3.5 py-2.5 w-1/3">Property</th>
                            <th className="px-3.5 py-2.5 w-1/3 text-rose-700 bg-rose-50/50">
                              Before (Previous)
                            </th>
                            <th className="px-3.5 py-2.5 w-1/3 text-emerald-700 bg-emerald-50/50">
                              After (Updated)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                          {Array.from(
                            new Set([
                              ...Object.keys(selectedEvent.old_values || {}),
                              ...Object.keys(selectedEvent.new_values || {}),
                            ])
                          )
                            // Strictly filter out sensitive password and secret fields
                            .filter(key => !SENSITIVE_KEYS_REGEX.test(key))
                            .map(key => {
                              const oldVal = selectedEvent.old_values?.[key];
                              const newVal = selectedEvent.new_values?.[key];
                              const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                              return (
                                <tr key={key} className={isChanged ? 'bg-amber-50/20' : ''}>
                                  <td className="px-3.5 py-2 font-sans font-semibold text-slate-700">
                                    {key
                                      .replace(/_/g, ' ')
                                      .split(' ')
                                      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                                      .join(' ')}
                                  </td>
                                  <td className="px-3.5 py-2 text-rose-900 bg-rose-50/30 break-all">
                                    {oldVal !== undefined && oldVal !== null
                                      ? typeof oldVal === 'object'
                                        ? JSON.stringify(oldVal)
                                        : String(oldVal)
                                      : '—'}
                                  </td>
                                  <td className="px-3.5 py-2 text-emerald-900 bg-emerald-50/30 break-all font-semibold">
                                    {newVal !== undefined && newVal !== null
                                      ? typeof newVal === 'object'
                                        ? JSON.stringify(newVal)
                                        : String(newVal)
                                      : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Additional Metadata & Context */}
                {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Additional Context & Metadata
                    </h4>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-mono text-[11px]">
                      {Object.entries(selectedEvent.metadata)
                        .filter(([k]) => !SENSITIVE_KEYS_REGEX.test(k))
                        .map(([k, v]) => (
                          <div key={k} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                            <span className="text-slate-500 font-semibold min-w-[140px]">{k}:</span>
                            <span className="text-slate-800 break-all">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Raw JSON Expander */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRawJson(prev => !prev)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{showRawJson ? 'Hide' : 'View'} Raw Event JSON</span>
                  </button>
                  {showRawJson && (
                    <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl text-[10px] overflow-x-auto font-mono max-h-48">
                      {JSON.stringify(selectedEvent, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })()}

              {/* Modal Footer */}
              <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 bg-slate-50/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shadow-2xs"
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
