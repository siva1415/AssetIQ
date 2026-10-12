import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Asset, Employee } from '../../types';
import { api } from '../../services/api';
import { SourceBadge } from '../common/SourceBadge';
import { StatusBadge } from '../common/StatusBadge';

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

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load Workday employees on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingEmployees(true);
    setEmployeesError(null);

    api
      .getEmployees({ page: 1, page_size: 500 })
      .then(res => {
        if (!isMounted) return;
        setEmployees(res.items);

        // Prepopulate current assignment if asset has an assigned user
        if (asset.assigned_username) {
          const currentUsername = asset.assigned_username.toLowerCase().trim();
          const currentEmp = res.items.find(
            e =>
              e.user_id.toLowerCase() === currentUsername ||
              (asset.verified_employee_id && e.employee_id === asset.verified_employee_id)
          );
          if (currentEmp) {
            setSelectedUser(currentEmp);
          }
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setEmployeesError(err?.message || 'Failed to load Workday employee directory.');
      })
      .finally(() => {
        if (isMounted) setLoadingEmployees(false);
      });

    return () => {
      isMounted = false;
    };
  }, [asset.assigned_username, asset.verified_employee_id]);

  // Filter employees by searchQuery (Full Name, User ID, Work Email)
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.trim().toLowerCase();
    return employees.filter(
      emp =>
        emp.full_name.toLowerCase().includes(q) ||
        emp.user_id.toLowerCase().includes(q) ||
        emp.work_email.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

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
        managed_by: group,
        remarks: remarks.trim() || undefined,
      });

      onSuccess(
        response.message ||
          `Asset ${asset.asset_number} successfully assigned to ${selectedUser.full_name} (${selectedUser.user_id}).`
      );
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to persist asset assignment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <UserRoundPen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Assign Asset User</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200/80 font-bold text-slate-700">
                  {asset.asset_number}
                </span>
              </div>
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
              {/* Asset Number */}
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Asset Number</span>
                <span className="font-mono font-bold text-slate-900 break-all block">
                  {asset.asset_number}
                </span>
              </div>

              {/* Source Badge */}
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Source</span>
                <div className="inline-flex mt-0.5">
                  <SourceBadge source={asset.source} />
                </div>
              </div>

              {/* Full Model Value without truncation */}
              <div className="col-span-2 sm:col-span-4 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Model</span>
                <span className="font-medium text-slate-900 break-words leading-relaxed block">
                  {asset.model || '—'}
                </span>
              </div>

              {/* Serial Number */}
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Serial Number</span>
                <span className="font-mono font-semibold text-slate-800 break-all block">
                  {asset.serial_number}
                </span>
              </div>

              {/* Current Assigned User */}
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <span className="text-slate-500 block text-[11px] mb-1">Current Assigned User</span>
                {asset.assigned_username ? (
                  <div className="break-words">
                    <span className="font-mono font-bold text-blue-700 block">
                      {asset.assigned_username}
                    </span>
                    {asset.verified_employee_name && (
                      <span className="font-sans font-normal text-slate-600 text-[11px] block mt-0.5">
                        {asset.verified_employee_name}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
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
                <div className="p-6 text-center text-xs text-rose-600">
                  {employeesError}
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No Workday employees match &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="w-10 py-2.5 px-3 text-center">Select</th>
                        <th className="py-2.5 px-3">Full Name</th>
                        <th className="py-2.5 px-3">User ID</th>
                        <th className="py-2.5 px-3">Job Title</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEmployees.map(emp => {
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
                                <span className="truncate max-w-[200px]" title={emp.job_title}>
                                  {emp.job_title}
                                </span>
                              </div>
                            </td>

                            {/* 4. Department */}
                            <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                              <div className="flex items-center gap-1">
                                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[180px]" title={emp.department}>
                                  {emp.department}
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
