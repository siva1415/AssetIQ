import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  UserRoundPen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HardDrive,
  User,
  Building,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { Asset, Employee, ASSET_STATUSES } from '../../types';
import { api } from '../../services/api';
import { SourceBadge } from '../common/SourceBadge';
import { StatusBadge } from '../common/StatusBadge';
import { CopyButton } from '../common/CopyButton';

interface AssignAssetModalProps {
  asset: Asset;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const AssignAssetModal: React.FC<AssignAssetModalProps> = ({
  asset,
  onClose,
  onSuccess,
}) => {
  // Prepopulate Group: uppercase 'INDIVIDUAL' or 'GROUP'
  const initialGroup: 'INDIVIDUAL' | 'GROUP' = useMemo(() => {
    if (asset.managed_by) {
      const val = asset.managed_by.trim().toUpperCase();
      if (val === 'GROUP' || val.includes('GROUP') || val.includes('SERVER') || val.includes('POOL')) {
        return 'GROUP';
      }
    }
    return 'INDIVIDUAL';
  }, [asset.managed_by]);

  const [group, setGroup] = useState<'INDIVIDUAL' | 'GROUP'>(initialGroup);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [remarks, setRemarks] = useState<string>(asset.notes || asset.remarks || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Pagination and sorting for employee lookup
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sortBy, setSortBy] = useState<string>('full_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Manufacturer and Model formatted as "Manufacturer - Model"
  const manufacturerAndModel = useMemo(() => {
    const manufacturer = (asset.manufacturer || '').trim();
    const model = (asset.model || '').trim();
    if (manufacturer && model) {
      return `${manufacturer} - ${model}`;
    }
    if (manufacturer) return manufacturer;
    if (model) return model;
    return '—';
  }, [asset.manufacturer, asset.model]);

  // Current Assigned User details
  const [currentAssignedEmployee, setCurrentAssignedEmployee] = useState<Employee | null>(null);

  // Attempt to fetch current assigned employee details if not already present
  useEffect(() => {
    let isCancelled = false;
    const lookupKey = asset.verified_employee_id || asset.assigned_username;
    if (!lookupKey) {
      setCurrentAssignedEmployee(null);
      return;
    }

    if (asset.employee || asset.workday_employee || asset.matched_employee) {
      const emp = (asset.employee || asset.workday_employee || asset.matched_employee) as Employee;
      setCurrentAssignedEmployee(emp);
    }

    api
      .getEmployeeById(lookupKey)
      .then(emp => {
        if (!isCancelled && emp) {
          setCurrentAssignedEmployee(emp);
        }
      })
      .catch(() => {
        // Fallback silently if lookup is unavailable
      });

    return () => {
      isCancelled = true;
    };
  }, [
    asset.assigned_username,
    asset.verified_employee_id,
    asset.employee,
    asset.workday_employee,
    asset.matched_employee,
  ]);

  const currentAssignedInfo = useMemo(() => {
    const username = (asset.assigned_username || asset.assignedUsername || '').trim();
    if (!username) {
      return { isAssigned: false as const };
    }

    const fullName =
      asset.verified_employee_name?.trim() ||
      asset.full_name?.trim() ||
      currentAssignedEmployee?.full_name?.trim() ||
      (selectedUser?.user_id.toLowerCase() === username.toLowerCase()
        ? selectedUser.full_name.trim()
        : null) ||
      null;

    return {
      isAssigned: true as const,
      username,
      fullName,
    };
  }, [
    asset.assigned_username,
    asset.assignedUsername,
    asset.verified_employee_name,
    asset.full_name,
    currentAssignedEmployee,
    selectedUser,
  ]);

  // Prepopulate selectedUser if asset already has an assigned employee
  useEffect(() => {
    if (!asset.assigned_username && !asset.verified_employee_id) return;
    const lookupKey = asset.verified_employee_id || asset.assigned_username;
    if (lookupKey) {
      api
        .getEmployeeById(lookupKey)
        .then(emp => {
          setSelectedUser(prev => prev || emp);
        })
        .catch(() => {
          // ignore lookup failure on initial prepopulate
        });
    }
  }, [asset.assigned_username, asset.verified_employee_id]);

  // Debounce search input to avoid spamming the backend API
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Workday employees with pagination and sorting
  const fetchEmployees = useCallback(async () => {
    let isMounted = true;
    setLoadingEmployees(true);
    setEmployeesError(null);

    try {
      const res = await api.getEmployees({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (!isMounted) return;
      setEmployees(res.items);
      setTotalCount(res.total);
      setTotalPages(res.total_pages || Math.max(1, Math.ceil(res.total / pageSize)));

      // If no employee is selected yet, check if current assigned user is in the page
      if (!selectedUser && asset.assigned_username) {
        const currentUsername = asset.assigned_username.toLowerCase().trim();
        const found = res.items.find(
          e =>
            e.user_id.toLowerCase() === currentUsername ||
            (asset.verified_employee_id && e.employee_id === asset.verified_employee_id)
        );
        if (found) {
          setSelectedUser(found);
        }
      }
    } catch (err: any) {
      if (!isMounted) return;
      setEmployeesError(
        err?.message || 'Failed to load Workday employee directory. Please check your connection.'
      );
    } finally {
      if (isMounted) setLoadingEmployees(false);
    }

    return () => {
      isMounted = false;
    };
  }, [
    page,
    pageSize,
    debouncedSearch,
    sortBy,
    sortOrder,
    selectedUser,
    asset.assigned_username,
    asset.verified_employee_id,
  ]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validation
    if (!group) {
      setSubmitError('The Group field is mandatory. Please select INDIVIDUAL or GROUP.');
      return;
    }

    if (!selectedUser) {
      setSubmitError('Selected User is mandatory. Please choose a Workday employee from the list.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.reassignAsset(asset.id, {
        user_id: selectedUser.user_id,
        assigned_username: selectedUser.user_id,
        managed_by: group,
        assignment_type: 'MANUAL',
        asset_status: ASSET_STATUSES.ACTIVE,
        remarks: remarks.trim() || undefined,
      });

      // Show success notification ONLY when confirmed by API
      onSuccess(
        response.message ||
          `Asset ${asset.asset_number} successfully assigned to ${selectedUser.full_name} (${selectedUser.user_id}).`
      );
    } catch (err: any) {
      // Handle backend HTTP 422 validation errors with a useful message
      let errorMsg = 'Failed to persist asset assignment. Please try again.';
      if (err?.status === 422 || err?.response?.status === 422) {
        const detail = err?.detail || err?.response?.data?.detail;
        if (Array.isArray(detail)) {
          errorMsg = `Validation error (HTTP 422): ${detail
            .map((d: any) =>
              typeof d === 'string'
                ? d
                : `${d.loc ? d.loc.filter((x: any) => x !== 'body').join('.') + ': ' : ''}${d.msg || JSON.stringify(d)}`
            )
            .join('; ')}`;
        } else if (typeof detail === 'string') {
          errorMsg = `Validation error (HTTP 422): ${detail}`;
        } else if (err.message) {
          errorMsg = err.message;
        } else {
          errorMsg = 'Validation error (HTTP 422): Invalid parameters provided. Please check asset_status and required fields.';
        }
      } else if (err?.message) {
        errorMsg = err.message;
      }
      setSubmitError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-2 sm:my-8 flex flex-col max-h-[96vh] sm:max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header without the asset label near the title */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <UserRoundPen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Assign Asset User</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/50 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Top Asset Summary Card */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              <span>Asset Details</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-12 gap-3.5 text-xs items-start">
              {/* Asset Number with Copy icon */}
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Asset Number</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-mono font-bold text-slate-900 break-all block text-[13.33px]"
                    style={{ fontSize: 'calc(12px + 1pt)' }}
                  >
                    {asset.asset_number || asset.assetNumber || '—'}
                  </span>
                  {(asset.asset_number || asset.assetNumber) && (
                    <CopyButton text={asset.asset_number || asset.assetNumber} label="Asset Number" />
                  )}
                </div>
              </div>

              {/* Source Badge */}
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Source</span>
                <div className="inline-flex mt-0.5">
                  <SourceBadge source={asset.source} />
                </div>
              </div>

              {/* Manufacturer - Model */}
              <div className="col-span-2 sm:col-span-4 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Manufacturer - Model</span>
                <span
                  className="font-medium text-slate-900 break-words leading-relaxed block text-[10.67px]"
                  style={{ fontSize: 'calc(12px - 1pt)' }}
                >
                  {manufacturerAndModel}
                </span>
              </div>

              {/* Serial Number */}
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Serial Number</span>
                <span className="font-mono font-semibold text-slate-800 break-all block">
                  {asset.serial_number}
                </span>
              </div>

              {/* Current Assigned User: Full name on line 1, Username on line 2 */}
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Current Assigned User</span>
                {!currentAssignedInfo.isAssigned ? (
                  <span className="text-slate-400 italic">Unassigned</span>
                ) : currentAssignedInfo.fullName ? (
                  <div className="break-words">
                    <span className="font-semibold text-slate-900 block leading-tight">
                      {currentAssignedInfo.fullName}
                    </span>
                    <span className="font-mono text-slate-600 text-[11px] block mt-0.5">
                      {currentAssignedInfo.username}
                    </span>
                  </div>
                ) : (
                  <div className="break-words">
                    <span className="font-mono font-bold text-amber-700 block leading-tight">
                      {currentAssignedInfo.username}
                    </span>
                    <span className="text-[11px] text-amber-600 italic block mt-0.5">
                      Not Found in Workday
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submission Error Banner */}
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{submitError}</div>
            </div>
          )}

          {/* Field A: Group (Mandatory Dropdown) */}
          <div className="space-y-1.5">
            <label htmlFor="group-select" className="block text-xs font-bold text-slate-800">
              Group <span className="text-rose-500">*</span>
            </label>
            <div className="w-full sm:w-72">
              <select
                id="group-select"
                value={group}
                onChange={e => setGroup(e.target.value as 'INDIVIDUAL' | 'GROUP')}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-2xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="INDIVIDUAL">INDIVIDUAL</option>
                <option value="GROUP">GROUP</option>
              </select>
            </div>
          </div>

          {/* Field B: Selected User (Workday User Selector) */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="block text-xs font-bold text-slate-800">
                Selected User <span className="text-rose-500">*</span>
              </label>

              {/* Selected User Indicator */}
              {selectedUser ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Selected: <strong>{selectedUser.full_name}</strong> (<span className="font-mono">{selectedUser.user_id}</span>)
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-amber-700 font-medium">
                  * Please select one employee from the list below
                </span>
              )}
            </div>

            {/* Search Input for Employees */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, user ID, or work email"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  aria-label="Clear employee search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selectable Employee Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              {loadingEmployees ? (
                <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span>Loading Workday employee records...</span>
                </div>
              ) : employeesError ? (
                <div className="p-6 text-center text-xs text-rose-600 flex flex-col items-center gap-2">
                  <span>{employeesError}</span>
                  <button
                    type="button"
                    onClick={() => fetchEmployees()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : employees.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No Workday employees match &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto max-h-56 overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="w-10 py-2.5 px-3 text-center">Select</th>
                          <th
                            className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleSort('full_name')}
                          >
                            <div className="flex items-center gap-1">
                              <span>Full Name</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th
                            className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleSort('user_id')}
                          >
                            <div className="flex items-center gap-1">
                              <span>User ID</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th
                            className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleSort('job_title')}
                          >
                            <div className="flex items-center gap-1">
                              <span>Job Title</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th
                            className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleSort('department')}
                          >
                            <div className="flex items-center gap-1">
                              <span>Department</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employees.map(emp => {
                          const isSelected = selectedUser?.user_id === emp.user_id;

                          return (
                            <tr
                              key={emp.user_id}
                              onClick={() => setSelectedUser(emp)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-blue-50/80 hover:bg-blue-100/70'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {/* Radio selector */}
                              <td className="py-2 px-3 text-center align-middle">
                                <input
                                  type="radio"
                                  name="selectedWorkdayUser"
                                  checked={isSelected}
                                  onChange={() => setSelectedUser(emp)}
                                  className="w-3.5 h-3.5 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>

                              {/* 1. Full Name */}
                              <td className="py-2 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{emp.full_name}</span>
                                </div>
                              </td>

                              {/* 2. User ID */}
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="font-mono font-semibold text-blue-700">
                                  {emp.user_id}
                                </span>
                              </td>

                              {/* 3. Job Title */}
                              <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                                <div className="flex items-center gap-1">
                                  <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[180px]" title={emp.job_title}>
                                    {emp.job_title || '—'}
                                  </span>
                                </div>
                              </td>

                              {/* 4. Department */}
                              <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                                <div className="flex items-center gap-1">
                                  <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[160px]" title={emp.department}>
                                    {emp.department || '—'}
                                  </span>
                                </div>
                              </td>

                              {/* 5. Status */}
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                <StatusBadge
                                  status={emp.employee_status}
                                  variant="solid"
                                  type="employee"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination footer */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                    <span>
                      Showing{' '}
                      <strong>{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong>
                      –
                      <strong>{Math.min(page * pageSize, totalCount)}</strong>{' '}
                      of <strong>{totalCount}</strong> employees
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1 || loadingEmployees}
                        className="px-2 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 text-xs font-medium transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>
                      <span className="px-2 font-medium">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loadingEmployees}
                        className="px-2 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 text-xs font-medium transition-colors"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Field C: Remarks (Optional Text Box) */}
          <div className="space-y-1.5">
            <label htmlFor="remarks-textarea" className="block text-xs font-bold text-slate-800">
              Remarks
            </label>
            <textarea
              id="remarks-textarea"
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Enter assignment remarks (optional)"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-2xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 resize-none"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <div className="text-xs text-slate-500">
            {selectedUser ? (
              <span>
                Assigning to <strong className="text-slate-800">{selectedUser.full_name}</strong> as <span className="font-mono font-semibold text-slate-700">{group}</span>
              </span>
            ) : (
              <span className="text-amber-700 font-medium">Please choose a user to proceed</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || !selectedUser || !group}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-2xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Assignment...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Assignment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
