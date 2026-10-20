import React, { useState, useEffect } from 'react';
import { X, HardDrive } from 'lucide-react';
import { Asset, Employee, formatEolDate, toStandardEOLStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { SourceBadge } from '../common/SourceBadge';
import { ManagedByBadge } from '../common/ManagedByBadge';
import { CopyButton } from '../common/CopyButton';
import { api } from '../../services/api';

interface AssetDetailDrawerProps {
  asset: Asset | null;
  onClose: () => void;
  onNavigateToEmployee?: (userId: string) => void;
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({
  asset,
  onClose,
}) => {
  const [employeeDetails, setEmployeeDetails] = useState<Employee | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!asset || !asset.assigned_username) {
      setEmployeeDetails(null);
      return;
    }

    // If asset already embeds employee details, pre-populate state
    if (asset.employee || asset.workday_employee || asset.matched_employee) {
      const empData = (asset.employee || asset.workday_employee || asset.matched_employee) as any;
      setEmployeeDetails({
        id: empData.id ?? empData.employee_id ?? '',
        employee_id: empData.employee_id ?? asset.verified_employee_id ?? '',
        user_id: empData.user_id ?? asset.assigned_username,
        full_name: empData.full_name ?? asset.verified_employee_name ?? asset.full_name ?? '',
        work_email: empData.work_email ?? asset.work_email ?? asset.email_work ?? '',
        department: empData.department ?? asset.department ?? '',
        division: empData.division ?? asset.division ?? '',
        job_title: empData.job_title ?? asset.job_title ?? '',
        employee_status: empData.employee_status ?? asset.employee_status ?? 'Active',
        manager_username: empData.manager_username ?? empData.manager_user_name ?? asset.manager_username ?? asset.manager_user_name ?? null,
        manager_user_name: empData.manager_user_name ?? empData.manager_username ?? asset.manager_user_name ?? asset.manager_username ?? null,
        manager_name: empData.manager_name ?? asset.manager_name ?? null,
        location: empData.location ?? '',
        hire_date: empData.hire_date ?? '',
      });
    }

    // Attempt to retrieve full Workday employee profile
    const lookupKey = asset.verified_employee_id || asset.assigned_username;
    api
      .getEmployeeById(lookupKey)
      .then(emp => {
        if (!isCancelled) {
          setEmployeeDetails(emp);
        }
      })
      .catch(() => {
        if (asset.verified_employee_id && asset.assigned_username && lookupKey !== asset.assigned_username) {
          api
            .getEmployeeById(asset.assigned_username)
            .then(emp => {
              if (!isCancelled) {
                setEmployeeDetails(emp);
              }
            })
            .catch(() => {
              // Graceful fallback
            });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [asset]);

  if (!asset) return null;

  // Derive Employee Status:
  // 1. "Unassigned" if no assigned username or employee assignment exists
  // 2. "Not in Workday" if assigned username exists, but no matching Workday employee is found
  // 3. "Active" if matching Workday employee has Active status
  // 4. "Inactive" if matching Workday employee has Inactive (or Terminated) status
  const getDerivedEmployeeStatus = (): 'Active' | 'Inactive' | 'Not in Workday' | 'Unassigned' => {
    if (!asset.assigned_username || asset.assigned_username.trim() === '') {
      return 'Unassigned';
    }

    // Explicit workday non-match check
    if (asset.workday_status === 'Not Found in Workday' || asset.workday_status === 'Admin Account') {
      return 'Not in Workday';
    }

    const hasMatch = Boolean(
      employeeDetails ||
      (asset.verified_employee_name && asset.verified_employee_name.trim() !== '') ||
      (asset.verified_employee_id && asset.verified_employee_id.trim() !== '') ||
      (asset.full_name && asset.full_name.trim() !== '') ||
      asset.workday_status === 'Matched'
    );

    if (!hasMatch) {
      return 'Not in Workday';
    }

    const rawEmpStatus = (
      employeeDetails?.employee_status ||
      asset.employee_status ||
      ''
    ).toLowerCase();

    if (rawEmpStatus === 'active') {
      return 'Active';
    }

    if (rawEmpStatus === 'inactive' || rawEmpStatus === 'terminated') {
      return 'Inactive';
    }

    return 'Active';
  };

  const employeeStatus = getDerivedEmployeeStatus();

  // Helper to format text or render dash
  const displayVal = (val: any): string => {
    if (val === undefined || val === null) return '—';
    const str = String(val).trim();
    if (!str || str === '' || str === 'undefined' || str === 'null') {
      return '—';
    }
    return str;
  };

  const formatDiscoveryDate = (dateVal?: string | null): string => {
    if (!dateVal || dateVal.trim() === '' || dateVal === '—') return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      return d.toLocaleString();
    } catch {
      return dateVal;
    }
  };

  // When Status = Not in Workday, only Username and Status are shown; all other employee fields are "—".
  // When Status = Unassigned, Username is "—", Status is "Unassigned", and all other employee fields are "—".
  const isMatchedEmployee = employeeStatus === 'Active' || employeeStatus === 'Inactive';

  const displayedUsername =
    employeeStatus === 'Unassigned'
      ? '—'
      : displayVal(asset.assigned_username);

  const displayedFullName = isMatchedEmployee
    ? displayVal(employeeDetails?.full_name || asset.full_name || asset.verified_employee_name)
    : '—';

  const displayedWorkEmail = isMatchedEmployee
    ? displayVal(employeeDetails?.work_email || asset.email_work || asset.work_email)
    : '—';

  const displayedDivision = isMatchedEmployee
    ? displayVal(employeeDetails?.division || asset.division)
    : '—';

  const displayedDepartment = isMatchedEmployee
    ? displayVal(employeeDetails?.department || (asset as any)?.workday_employee?.department || (asset as any)?.employee?.department || asset.department)
    : '—';

  const displayedJobTitle = isMatchedEmployee
    ? displayVal(employeeDetails?.job_title || asset.job_title)
    : '—';

  const rawManagerUserName =
    employeeDetails?.manager_user_name ??
    employeeDetails?.manager_username ??
    (employeeDetails as any)?.managerUsername ??
    (employeeDetails as any)?.manager_user ??
    asset.manager_user_name ??
    asset.manager_username ??
    asset.managerUsername ??
    (asset as any)?.manager_user ??
    asset.employee?.manager_user_name ??
    asset.employee?.manager_username ??
    (asset.employee as any)?.managerUsername ??
    (asset.workday_employee as any)?.manager_user_name ??
    (asset.workday_employee as any)?.manager_username ??
    (asset.workday_employee as any)?.managerUsername ??
    (asset.matched_employee as any)?.manager_user_name ??
    (asset.matched_employee as any)?.manager_username ??
    null;

  const displayedManagerUserName = isMatchedEmployee
    ? displayVal(rawManagerUserName)
    : '—';

  const rawManagerName =
    employeeDetails?.manager_name ??
    (employeeDetails as any)?.managerName ??
    asset.manager_name ??
    asset.managerName ??
    asset.employee?.manager_name ??
    (asset.employee as any)?.managerName ??
    (asset.workday_employee as any)?.manager_name ??
    (asset.matched_employee as any)?.manager_name ??
    null;

  const displayedManagerName = isMatchedEmployee
    ? displayVal(rawManagerName)
    : '—';

  // Backend-calculated remaining days
  const rawDaysRemaining = asset.days_remaining ?? asset.daysRemaining;

  // Remarks display: show saved remarks, or '—' if empty/whitespace
  const getRemarksDisplay = (): string => {
    const raw = asset.remarks ?? asset.notes ?? (asset as any)?.remarks_text;
    if (raw === undefined || raw === null) return '—';
    const str = String(raw).trim();
    return str.length > 0 ? str : '—';
  };
  const displayedRemarks = getRemarksDisplay();

  // Model + Manufacturer formatted as "Manufacturer - Model"
  const getModelManufacturerDisplay = (): string => {
    if (!asset) return '—';
    const manufacturer = (asset.manufacturer || '').trim();
    const model = (asset.model || '').trim();
    if (manufacturer && model) {
      return `${manufacturer} - ${model}`;
    }
    return manufacturer || model || '—';
  };
  const formattedModelManufacturer = getModelManufacturerDisplay();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  View Asset & Ownership Details
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status Strip: 1. Asset Status, 2. EOL, 3. Assignment Type */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">Asset Status</span>
                <StatusBadge status={asset.asset_status} type="asset_status" uppercase />
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">EOL</span>
                <StatusBadge status={asset.eol_status || 'UNKNOWN'} type="eol_status" uppercase />
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">Assignment Type</span>
                <StatusBadge status={asset.assignment_type} type="assignment" uppercase />
              </div>
            </div>

            {/* Hardware Identity */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Hardware Identification
              </h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Asset Number</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="font-mono text-slate-900 font-bold text-[13.33px]"
                      style={{ fontSize: 'calc(12px + 1pt)' }}
                    >
                      {displayVal(asset.asset_number || asset.assetNumber)}
                    </span>
                    {(asset.asset_number || asset.assetNumber) && (
                      <CopyButton text={asset.asset_number || asset.assetNumber} label="Asset Number" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">Model + Manufacturer</span>
                  <span className="text-slate-900 font-medium break-words">{formattedModelManufacturer}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Serial Number</span>
                  <span className="font-mono text-slate-900 font-semibold">{displayVal(asset.serialNumber || asset.serial_number)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Discovery Source</span>
                  <SourceBadge source={asset.source} />
                </div>
                <div>
                  <span className="text-slate-500 block">Device Type</span>
                  <span className="text-slate-900">{displayVal(asset.devicetype)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Operating System</span>
                  <span className="text-slate-900 font-medium">{displayVal(asset.osName || asset.os_name)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">MAC Address</span>
                  <span className="font-mono text-slate-900">{displayVal(asset.macAddress || asset.mac_address || asset.macaddress)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">EOL Date</span>
                  <span className="font-mono text-slate-900 font-medium">{formatEolDate(asset.eolDate || asset.eol_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">EOL Days Remaining</span>
                  <span
                    className={`font-mono font-medium ${
                      toStandardEOLStatus(asset.eol_status) === 'UNKNOWN' || rawDaysRemaining === null || rawDaysRemaining === undefined
                        ? 'text-slate-500'
                        : Number(rawDaysRemaining) <= 0
                        ? 'text-rose-600 font-semibold'
                        : Number(rawDaysRemaining) <= 90
                        ? 'text-amber-600 font-semibold'
                        : 'text-emerald-700 font-semibold'
                    }`}
                  >
                    {toStandardEOLStatus(asset.eol_status) === 'UNKNOWN' || rawDaysRemaining === null || rawDaysRemaining === undefined || isNaN(Number(rawDaysRemaining))
                      ? '—'
                      : `${rawDaysRemaining} days`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Last Discovery Report</span>
                  <span className="font-mono text-slate-700">
                    {formatDiscoveryDate(asset.lastDiscoveryDate || asset.last_report_time || asset.lastreporttime)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Managed By</span>
                  <ManagedByBadge managedBy={asset.managed_by} />
                </div>
              </div>
            </div>

            {/* Assigned User */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Assigned User
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. Status */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Status</span>
                  <StatusBadge status={employeeStatus} type="employee" uppercase />
                </div>

                {/* 2. Username */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Username</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {displayedUsername}
                  </span>
                </div>

                {/* 4. Full Name */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-medium text-slate-900">
                    {displayedFullName}
                  </span>
                </div>

                {/* 5. Work Email */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Work Email</span>
                  <span className="font-mono text-slate-900 truncate max-w-[260px]" title={displayedWorkEmail !== '—' ? displayedWorkEmail : ''}>
                    {displayedWorkEmail}
                  </span>
                </div>

                {/* Department */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Department</span>
                  <span className="text-slate-900 font-medium truncate max-w-[260px]" title={displayedDepartment !== '—' ? displayedDepartment : ''}>
                    {displayedDepartment}
                  </span>
                </div>

                {/* 6. Job Title */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Job Title</span>
                  <span className="text-slate-900 font-medium truncate max-w-[260px]" title={displayedJobTitle !== '—' ? displayedJobTitle : ''}>
                    {displayedJobTitle}
                  </span>
                </div>

                {/* 7. Manager UserName */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Manager UserName</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {displayedManagerUserName}
                  </span>
                </div>

                {/* 8. Manager Name */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Manager Name</span>
                  <span className="font-medium text-slate-900">
                    {displayedManagerName}
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Remarks
              </h3>
              <div
                className={`text-xs whitespace-pre-wrap break-words leading-relaxed ${
                  displayedRemarks === '—' ? 'text-slate-400 font-medium' : 'text-slate-800'
                }`}
              >
                {displayedRemarks}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
