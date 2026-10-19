import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Search,
  UserRoundPlus,
  CheckCircle2,
  AlertCircle,
  Users,
  Loader2,
  Laptop,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Asset, Employee, ASSET_STATUSES } from '../../types';
import { api } from '../../services/api';
import { SelectableEmployeeCard } from '../employees/SelectableEmployeeCard';

interface BulkAssignAssetModalProps {
  selectedAssetIds: (string | number)[];
  selectedAssets?: Asset[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const BulkAssignAssetModal: React.FC<BulkAssignAssetModalProps> = ({
  selectedAssetIds,
  selectedAssets = [],
  onClose,
  onSuccess,
}) => {
  const [group, setGroup] = useState<'INDIVIDUAL' | 'GROUP'>('INDIVIDUAL');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [remarks, setRemarks] = useState<string>('');

  // Employee search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Pagination for employee directory
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Search debounce timer
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(val.trim());
      setPage(1);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Request ID tracking to prevent race conditions
  const fetchReqIdRef = useRef<number>(0);

  const fetchEmployees = useCallback(async () => {
    const reqId = ++fetchReqIdRef.current;
    setLoadingEmployees(true);
    setEmployeesError(null);

    try {
      const res = await api.getEmployees({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        employee_status: 'Active',
        sort_by: 'full_name',
        sort_order: 'asc',
      });

      if (reqId !== fetchReqIdRef.current) return;
      setEmployees(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.total_pages || Math.max(1, Math.ceil((res.total || 0) / pageSize)));
    } catch (err: any) {
      if (reqId !== fetchReqIdRef.current) return;
      setEmployeesError(
        err?.message || 'Failed to load Workday employee directory. Please check your connection.'
      );
    } finally {
      if (reqId === fetchReqIdRef.current) {
        setLoadingEmployees(false);
      }
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;

  const handlePrevPage = () => {
    if (page > 1 && !loadingEmployees) {
      setPage(p => p - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages && !loadingEmployees) {
      setPage(p => p + 1);
    }
  };

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedUserId(emp.user_id);
    setSelectedUser(emp);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (selectedAssetIds.length === 0) {
      setSubmitError('No assets selected. Please select at least one asset.');
      return;
    }

    if (!group) {
      setSubmitError('The Managed By field is mandatory. Please select INDIVIDUAL or GROUP.');
      return;
    }

    if (!selectedUser) {
      setSubmitError('Selected User is mandatory. Please select a Workday employee from the list.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.bulkAssignAssets({
        asset_ids: selectedAssetIds,
        user_id: selectedUser.user_id,
        assigned_username: selectedUser.user_id,
        managed_by: group,
        assignment_type: 'MANUAL',
        asset_status: ASSET_STATUSES.ACTIVE,
        remarks: remarks.trim() || undefined,
      });

      onSuccess(
        response.message ||
          `Successfully assigned ${selectedAssetIds.length} assets to ${selectedUser.full_name} (${selectedUser.user_id}).`
      );
    } catch (err: any) {
      let errorMsg = 'Failed to persist bulk asset assignments. Please try again.';
      if (err?.status === 422 || err?.response?.status === 422) {
        const detail = err?.detail || err?.response?.data?.detail;
        if (Array.isArray(detail)) {
          errorMsg = `Validation error (HTTP 422): ${detail
            .map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d)))
            .join('; ')}`;
        } else if (typeof detail === 'string') {
          errorMsg = `Validation error (HTTP 422): ${detail}`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/75 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <UserRoundPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  Bulk Assign Assets
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 tabular-nums">
                  {selectedAssetIds.length} {selectedAssetIds.length === 1 ? 'asset' : 'assets'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scrollable Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Selected Assets Preview Strip */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-slate-500" />
                Target Assets ({selectedAssetIds.length})
              </span>
            </div>

            {/* Scrollable Asset Badges */}
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {selectedAssets.length > 0 ? (
                selectedAssets.map(asset => (
                  <span
                    key={asset.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 text-[11px] font-mono text-slate-800 shadow-2xs"
                    title={`${asset.model || ''} - Serial: ${asset.serial_number || ''}`}
                  >
                    <span className="font-bold">{asset.asset_number}</span>
                    {asset.model && (
                      <span className="text-slate-500 font-sans truncate max-w-[120px]">
                        ({asset.model})
                      </span>
                    )}
                  </span>
                ))
              ) : (
                selectedAssetIds.map(id => (
                  <span
                    key={id}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-2xs"
                  >
                    ID: {id}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Assignment Configuration: Managed By and Remarks matching Assign Asset User popup */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Managed By (Mandatory Dropdown) */}
            <div className="md:col-span-4 space-y-1.5">
              <label htmlFor="bulk-group-select" className="block text-xs font-bold text-slate-800">
                Managed By <span className="text-rose-500">*</span>
              </label>
              <select
                id="bulk-group-select"
                value={group}
                onChange={e => setGroup(e.target.value as 'INDIVIDUAL' | 'GROUP')}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-2xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="INDIVIDUAL">INDIVIDUAL</option>
                <option value="GROUP">GROUP</option>
              </select>
            </div>

            {/* Remarks (Optional Text Box) beside Managed By */}
            <div className="md:col-span-8 space-y-1.5">
              <label htmlFor="bulk-remarks-textarea" className="block text-xs font-bold text-slate-800">
                Remarks
              </label>
              <textarea
                id="bulk-remarks-textarea"
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter assignment remarks (optional)"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-2xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          {/* Selected User (Workday Employee Selector) */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Selected User <span className="text-rose-500">*</span>
              </label>

              {/* Selected User Indicator */}
              {selectedUser ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId(null);
                      setSelectedUser(null);
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Clear Selection
                  </button>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Selected: <strong>{selectedUser.full_name}</strong> (
                      <span className="font-mono">{selectedUser.user_id}</span>)
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-amber-700 font-medium">
                  * Please select one employee from the list below
                </span>
              )}
            </div>

            {/* Search Input for Employees */}
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, user ID, email, or department..."
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Clear employee search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Selectable Employee Card List */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/30">
              <div className="p-2.5 max-h-64 sm:max-h-72 overflow-y-auto">
                {loadingEmployees && employees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-500 space-y-2 bg-white rounded-lg border border-slate-100">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">Loading Workday employee records...</span>
                  </div>
                ) : employeesError && employees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-white rounded-lg border border-slate-100">
                    <AlertCircle className="w-7 h-7 text-rose-500 mb-2" />
                    <h4 className="text-xs font-semibold text-slate-800">Unable to load employee records</h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mt-1 mb-3">{employeesError}</p>
                    <button
                      type="button"
                      onClick={() => fetchEmployees()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Request</span>
                    </button>
                  </div>
                ) : employees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-white rounded-lg border border-slate-100">
                    <Users className="w-7 h-7 text-slate-300 mb-2" />
                    <h4 className="text-xs font-semibold text-slate-800">
                      {debouncedSearch ? 'No matching employees found' : 'No available employees'}
                    </h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mt-1 mb-3">
                      {debouncedSearch
                        ? `No active Workday employees match "${debouncedSearch}". Try searching by another name, user ID, email, or department.`
                        : 'No active employee records were returned.'}
                    </p>
                    {debouncedSearch && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium transition-colors cursor-pointer"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={`space-y-2 relative transition-opacity duration-150 ${
                      loadingEmployees ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    {employees.map(emp => {
                      const isSelected = Boolean(
                        (selectedUserId && emp.user_id.toLowerCase() === selectedUserId.toLowerCase()) ||
                        (selectedUser && emp.user_id.toLowerCase() === selectedUser.user_id.toLowerCase())
                      );

                      return (
                        <SelectableEmployeeCard
                          key={emp.user_id}
                          fullName={emp.full_name}
                          userId={emp.user_id}
                          jobTitle={emp.job_title}
                          workEmail={emp.work_email || (emp as any).email_work}
                          department={emp.department}
                          isSelected={isSelected}
                          onSelect={() => handleSelectEmployee(emp)}
                          selectionType="radio"
                          name="bulkAssignSelectedUser"
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Employee Pagination Footer */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs">
                <span className="text-slate-500 text-[11px]">
                  Showing <span className="font-semibold text-slate-800 tabular-nums">{startIndex}</span> to{' '}
                  <span className="font-semibold text-slate-800 tabular-nums">{endIndex}</span> of{' '}
                  <span className="font-semibold text-slate-800 font-mono tabular-nums">{totalCount}</span> employees
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={page <= 1 || loadingEmployees}
                    className="p-1 border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous employee page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] text-slate-600 font-medium px-1">
                    Page <span className="font-mono tabular-nums">{page}</span> of{' '}
                    <span className="font-mono tabular-nums">{Math.max(1, totalPages)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={page >= totalPages || loadingEmployees}
                    className="p-1 border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next employee page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submission Error Banner */}
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Assignment Failed:</span> {submitError}
              </div>
            </div>
          )}

          {/* Hidden submit trigger */}
          <button type="submit" className="hidden" tabIndex={-1} />
        </form>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
          <div className="text-xs text-slate-500">
            {selectedUser ? (
              <span>
                Assigning to <strong>{selectedUser.full_name}</strong>
              </span>
            ) : (
              <span>Select an employee above to proceed</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedUser || submitting || selectedAssetIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {submitting
                  ? 'Assigning Assets...'
                  : `Assign ${selectedAssetIds.length} ${
                      selectedAssetIds.length === 1 ? 'Asset' : 'Assets'
                    }`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
