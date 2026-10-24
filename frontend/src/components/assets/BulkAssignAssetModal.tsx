import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X,
  Search,
  UserRoundPlus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  Loader2,
  Laptop,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Asset, Employee, ASSET_STATUSES, BulkAssignAssetFilters } from '../../types';
import { api } from '../../services/api';
import { SelectableEmployeeCard } from '../employees/SelectableEmployeeCard';

export interface BulkAssignResult {
  status: 'success' | 'partial' | 'failure';
  assignedCount: number;
  failedCount: number;
  totalProcessed: number;
  successfulAssetIds: (string | number)[];
  failedAssetIds: (string | number)[];
  isAllSuccess: boolean;
  message: string;
}

function parseAssignedCountFromMessage(msg?: string): number | null {
  if (!msg || typeof msg !== 'string') return null;
  const m1 = msg.match(/(?:completed successfully:\s*|successfully assigned\s+|assigned\s+)(\d[\d,]*)\s*asset/i);
  if (m1) return parseInt(m1[1].replace(/,/g, ''), 10);

  const m2 = msg.match(/(\d[\d,]*)\s*asset(?:\(s\)|s)?\s+assigned/i);
  if (m2) return parseInt(m2[1].replace(/,/g, ''), 10);

  const m3 = msg.match(/assigned\s+(\d[\d,]*)/i);
  if (m3) return parseInt(m3[1].replace(/,/g, ''), 10);

  return null;
}

export interface BulkAssignAssetModalProps {
  selectedAssetIds: (string | number)[];
  selectedAssets?: Asset[];
  isAllMatchingSelected?: boolean;
  matchingCount?: number;
  activeFilters?: BulkAssignAssetFilters;
  filterSummaryText?: string;
  onClose: () => void;
  onSuccess: (result: BulkAssignResult) => void;
}

type ModalStep = 'form' | 'confirm' | 'result';

export const BulkAssignAssetModal: React.FC<BulkAssignAssetModalProps> = ({
  selectedAssetIds,
  selectedAssets = [],
  isAllMatchingSelected = false,
  matchingCount = 0,
  activeFilters,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<ModalStep>('form');
  const [group, setGroup] = useState<'INDIVIDUAL' | 'GROUP'>('INDIVIDUAL');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [remarks, setRemarks] = useState<string>('');

  // Target count
  const targetCount = isAllMatchingSelected ? matchingCount : selectedAssetIds.length;

  // Resolve asset numbers for display
  const [resolvedAssetNumbers, setResolvedAssetNumbers] = useState<string[]>([]);
  const [loadingAssetNumbers, setLoadingAssetNumbers] = useState<boolean>(false);

  // For manually selected assets, map selected IDs to their asset numbers
  const manualAssetNumbers = useMemo(() => {
    const map = new Map<string | number, string>();
    selectedAssets.forEach(a => {
      if (a.id) map.set(a.id, a.asset_number || String(a.id));
    });
    return selectedAssetIds.map(id => map.get(id) || String(id));
  }, [selectedAssetIds, selectedAssets]);

  // Do not fetch asset numbers for all-matching selections; the summary only needs matchingCount.

  // Unified displayed asset numbers for Target Assets section
  const displayedAssetNumbers = useMemo(() => {
    if (isAllMatchingSelected) {
      if (resolvedAssetNumbers.length > 0) return resolvedAssetNumbers;
      return selectedAssets.map(a => a.asset_number || String(a.id));
    }
    return manualAssetNumbers;
  }, [isAllMatchingSelected, resolvedAssetNumbers, selectedAssets, manualAssetNumbers]);

  // Employee directory state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [assignmentResult, setAssignmentResult] = useState<BulkAssignResult | null>(null);

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

  // Request ID tracking for employee directory
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
    setFormValidationError(null);
  };

  // Step 1 -> Step 2: Validate form and transition to Confirmation Dialog
  const handleProceedToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    if (targetCount === 0) {
      setFormValidationError('No assets selected. Please select at least one asset to assign.');
      return;
    }

    if (!group) {
      setFormValidationError('Managed By is mandatory. Please select INDIVIDUAL or GROUP.');
      return;
    }

    if (!selectedUser) {
      setFormValidationError('Selected User is mandatory. Please select a Workday employee from the list.');
      return;
    }

    setStep('confirm');
  };

  // Step 2: Confirmation Dialog Action — Submit request exactly once
  const handleConfirmAssignment = async () => {
    if (submitting || !selectedUser) return;
    setSubmitting(true);

    const remarksTrimmed = remarks.trim();
    // Remarks contract:
    // If text entered, submit entered value.
    // If blank or whitespace, submit null so backend updates assets.remarks to SQL NULL.
    const remarksPayload = remarksTrimmed !== '' ? remarksTrimmed : null;

    try {
      const response = await api.bulkAssignAssets({
        asset_ids: isAllMatchingSelected ? undefined : selectedAssetIds,
        select_all_matching: isAllMatchingSelected,
        matching_count: targetCount,
        filters: isAllMatchingSelected ? activeFilters : undefined,
        user_id: selectedUser.user_id,
        assigned_username: selectedUser.user_id,
        managed_by: group,
        assignment_type: 'MANUAL',
        asset_status: ASSET_STATUSES.ACTIVE,
        remarks: remarksPayload,
      });

      // Extract failed items and count
      const failedIds = response.failed_asset_ids ?? [];
      const failedCount = response.failed_count ?? failedIds.length;

      // Extract assigned count with message fallback
      let assignedCount = response.assigned_count ?? 0;
      if (assignedCount === 0) {
        const msgParsed = parseAssignedCountFromMessage(response.message);
        if (msgParsed !== null && msgParsed > 0) {
          assignedCount = msgParsed;
        }
      }

      // Extract total processed count
      let totalProcessed = response.total_processed ?? 0;
      if (totalProcessed === 0) {
        totalProcessed = (assignedCount + failedCount) > 0 ? (assignedCount + failedCount) : targetCount;
      }

      // Check explicit business-level failure vs success
      const isExplicitFail =
        response.status === 'failure' ||
        response.status === 'failed' ||
        response.status === 'error' ||
        response.success === false;

      const isExplicitSuccess =
        response.status === 'success' ||
        response.status === 'ok' ||
        response.status === 'completed' ||
        response.success === true ||
        /successfully|completed successfully/i.test(response.message || '');

      if (!isExplicitFail && isExplicitSuccess && failedCount === 0) {
        if (assignedCount === 0 && totalProcessed > 0) {
          assignedCount = totalProcessed;
        } else if (totalProcessed === 0 && assignedCount > 0) {
          totalProcessed = assignedCount;
        }
      }

      const isAllSuccess = !isExplicitFail && failedCount === 0 && (assignedCount > 0 || totalProcessed > 0);
      if (isAllSuccess && assignedCount === 0 && totalProcessed > 0) {
        assignedCount = totalProcessed;
      }
      const isPartial = !isExplicitFail && failedCount > 0 && assignedCount > 0;
      const status: 'success' | 'partial' | 'failure' = isAllSuccess
        ? 'success'
        : isPartial
        ? 'partial'
        : 'failure';

      const finalMessage = response.message || (
        status === 'success'
          ? `Successfully assigned ${assignedCount.toLocaleString()} assets to ${selectedUser.full_name}.`
          : status === 'partial'
          ? `Assigned ${assignedCount.toLocaleString()} assets with ${failedCount.toLocaleString()} failures.`
          : `Bulk assignment failed.`
      );

      const result: BulkAssignResult = {
        status,
        assignedCount,
        failedCount,
        totalProcessed: totalProcessed > 0 ? totalProcessed : targetCount,
        successfulAssetIds: response.successful_asset_ids || [],
        failedAssetIds: failedIds,
        isAllSuccess,
        message: finalMessage,
      };

      setAssignmentResult(result);
      setStep('result');
    } catch (err: any) {
      console.error('[BulkAssignAssetModal] Assignment request failed:', err);
      let errorMsg = 'Failed to execute bulk asset assignment request.';
      if (err?.status === 422 || err?.response?.status === 422) {
        const detail = err?.detail || err?.response?.data?.detail;
        if (Array.isArray(detail)) {
          errorMsg = `Validation error (HTTP 422): ${detail
            .map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d)))
            .join('; ')}`;
        } else if (typeof detail === 'string') {
          errorMsg = `Validation error (HTTP 422): ${detail}`;
        }
      } else if (err?.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err?.message) {
        errorMsg = err.message;
      }

      const result: BulkAssignResult = {
        status: 'failure',
        assignedCount: 0,
        failedCount: targetCount,
        totalProcessed: targetCount,
        successfulAssetIds: [],
        failedAssetIds: isAllMatchingSelected ? [] : selectedAssetIds,
        isAllSuccess: false,
        message: errorMsg,
      };

      setAssignmentResult(result);
      setStep('result');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Result Dialog Action — Done button
  const handleDone = () => {
    if (assignmentResult) {
      onSuccess(assignmentResult);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* STEP 1: FORM MODAL VIEW                                                   */}
        {/* ========================================================================= */}
        {step === 'form' && (
          <>
            {/* Header */}
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
                      {targetCount.toLocaleString()} {targetCount === 1 ? 'asset' : 'assets'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleProceedToConfirmation} className="flex-1 overflow-y-auto p-5 space-y-4">
              {isAllMatchingSelected ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-slate-500" />
                    <h4 className="text-sm font-semibold text-slate-900">Target Assets</h4>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-md bg-emerald-50 px-3 py-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-xs leading-5 text-slate-700">
                      All <span className="font-semibold text-slate-900 tabular-nums">{targetCount.toLocaleString()}</span> matching assets will be included in the assignment.
                    </p>
                  </div>
                </div>
              ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-slate-500" />
                    Target Assets ({targetCount.toLocaleString()})
                  </span>
                  {isAllMatchingSelected && loadingAssetNumbers && (
                    <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                      Loading asset numbers...
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-white rounded border border-slate-200">
                  {displayedAssetNumbers.length > 0 ? (
                    displayedAssetNumbers.map((num, idx) => (
                      <span
                        key={`${num}-${idx}`}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-800 shadow-2xs"
                      >
                        {num}
                      </span>
                    ))
                  ) : loadingAssetNumbers ? (
                    <div className="flex items-center gap-2 py-2 px-1 text-xs text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Resolving matching asset numbers across pages...</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic p-1">No asset numbers found</span>
                  )}
                </div>
              </div>
              )}

              {/* Assignment Configuration: Managed By and Remarks */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Managed By */}
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

                {/* Remarks */}
                <div className="md:col-span-8 space-y-1.5">
                  <label htmlFor="bulk-remarks-textarea" className="block text-xs font-bold text-slate-800">
                    Remarks
                  </label>
                  <textarea
                    id="bulk-remarks-textarea"
                    rows={2}
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-2xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Workday Employee Selector */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Selected User <span className="text-rose-500">*</span>
                  </label>

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
                      * Please select one employee from the directory below
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

                {/* Employee Cards List */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/30">
                  <div className="p-2.5 max-h-60 sm:max-h-64 overflow-y-auto">
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

              {/* Form Validation Error Banner */}
              {formValidationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{formValidationError}</div>
                </div>
              )}
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
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceedToConfirmation}
                  disabled={!selectedUser || targetCount === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>
                    Review & Assign ({targetCount.toLocaleString()}{' '}
                    {targetCount === 1 ? 'Asset' : 'Assets'})
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: CONFIRMATION DIALOG (BEFORE SUBMITTING REQUEST)                    */}
        {/* ========================================================================= */}
        {step === 'confirm' && (
          <div className="p-6 space-y-5 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <UserRoundPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Bulk Asset Assignment
                </h3>
              </div>
            </div>

            {/* Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Number of Assets
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {targetCount.toLocaleString()}{' '}
                    {isAllMatchingSelected ? '(All matching across pages)' : 'selected assets'}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Managed By
                  </span>
                  <span className="font-semibold text-slate-900 px-2 py-0.5 rounded bg-white border border-slate-200 inline-block mt-0.5 font-mono text-[11px]">
                    {group}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Assigned Workday Employee
                  </span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {selectedUser?.full_name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ID: {selectedUser?.user_id}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Department & Title
                  </span>
                  <span className="text-slate-800 block mt-0.5 font-medium">
                    {selectedUser?.department || 'N/A'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {selectedUser?.job_title || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Assignment Remarks
                </span>
                {remarks.trim() ? (
                  <div className="p-2 bg-white border border-slate-200 rounded text-slate-800 whitespace-pre-wrap font-sans text-xs">
                    {remarks.trim()}
                  </div>
                ) : (
                  <div className="p-2 bg-slate-100/70 border border-slate-200/60 rounded text-slate-500 italic text-xs">
                    None
                  </div>
                )}
              </div>
            </div>

            {/* Warning in amber */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium text-amber-700">
                Warning: Please review the user assignment details carefully. This operation will update ownership across the selected assets.
              </span>
            </div>

            {/* Confirmation Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Assigning Assets...</span>
                  </>
                ) : (
                  <>
                    <UserRoundPlus className="w-4 h-4" />
                    <span>Confirm Assignment ({targetCount.toLocaleString()} Assets)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: COMPLETION CONFIRMATION DIALOG (BACKEND RESULT)                   */}
        {/* ========================================================================= */}
        {step === 'result' && assignmentResult && (
          <div className="p-6 space-y-5 animate-in fade-in duration-150">
            {/* Outcome Header */}
            <div className="flex items-start gap-3.5 pb-4 border-b border-slate-200">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  assignmentResult.status === 'success'
                    ? 'bg-emerald-100 text-emerald-700'
                    : assignmentResult.status === 'partial'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {assignmentResult.status === 'success' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : assignmentResult.status === 'partial' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {assignmentResult.status === 'success'
                    ? 'Bulk Assignment Successful'
                    : assignmentResult.status === 'partial'
                    ? 'Bulk Assignment Partially Successful'
                    : 'Bulk Assignment Failed'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {assignmentResult.status === 'success'
                    ? 'All selected assets have been attributed in the inventory database.'
                    : assignmentResult.status === 'partial'
                    ? 'Some assets were attributed successfully, but errors occurred on others.'
                    : 'The backend was unable to execute the assignment operation.'}
                </p>
              </div>
            </div>

            {/* Metrics 3-Column Card */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Processed
                </span>
                <span className="text-xl font-extrabold text-slate-800 tabular-nums">
                  {assignmentResult.totalProcessed.toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-center">
                <span className="block text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                  Successfully Assigned
                </span>
                <span className="text-xl font-extrabold text-emerald-700 tabular-nums">
                  {assignmentResult.assignedCount.toLocaleString()}
                </span>
              </div>

              <div
                className={`p-3.5 rounded-lg text-center border ${
                  assignmentResult.failedCount > 0
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <span className="block text-[11px] font-semibold uppercase tracking-wider">
                  Failed Assets
                </span>
                <span
                  className={`text-xl font-extrabold tabular-nums ${
                    assignmentResult.failedCount > 0 ? 'text-rose-700' : 'text-slate-600'
                  }`}
                >
                  {assignmentResult.failedCount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Result Message Banner */}
            <div
              className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 border ${
                assignmentResult.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : assignmentResult.status === 'partial'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex-1 font-medium leading-relaxed">
                {assignmentResult.message}
              </div>
            </div>

            {/* Failure Details (if any failed assets returned) */}
            {assignmentResult.failedAssetIds.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Failed Asset Identifiers ({assignmentResult.failedAssetIds.length})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    These selections are preserved for retry
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                  {assignmentResult.failedAssetIds.map(id => (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded bg-white border border-rose-200 text-[11px] font-mono text-rose-700"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Action */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleDone}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
