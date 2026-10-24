import React, { useState, useEffect } from 'react';
import { X, HardDrive, Pencil, Check, Loader2, UserRoundPlus, CheckCircle2 } from 'lucide-react';
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
  editable?: boolean;
  onAssetUpdated?: (updated: Asset) => void;
  allowAssignUser?: boolean;
  onAssignUser?: (asset: Asset) => void;
  assignmentSuccessMessage?: string | null;
  onDismissAssignmentSuccessMessage?: () => void;
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({
  asset,
  onClose,
  editable = false,
  onAssetUpdated,
  allowAssignUser = false,
  onAssignUser,
  assignmentSuccessMessage,
  onDismissAssignmentSuccessMessage,
}) => {
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(asset);
  const [employeeDetails, setEmployeeDetails] = useState<Employee | null>(null);

  // Field editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessField, setSaveSuccessField] = useState<string | null>(null);

  useEffect(() => {
    setCurrentAsset(asset);
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
    setSaveSuccessField(null);

    let isCancelled = false;
    const assetId = asset?.id || asset?.asset_number;
    if (assetId) {
      api
        .getAssetById(assetId)
        .then(fullAsset => {
          if (!isCancelled && fullAsset) {
            setCurrentAsset(prev => (prev ? { ...prev, ...fullAsset } : fullAsset));
          }
        })
        .catch(() => {
          // Gracefully retain initial asset
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [asset]);

  useEffect(() => {
    let isCancelled = false;

    if (!currentAsset || !currentAsset.assigned_username) {
      setEmployeeDetails(null);
      return;
    }

    // If asset already embeds employee details, pre-populate state
    if (currentAsset.employee || currentAsset.workday_employee || currentAsset.matched_employee) {
      const empData = (currentAsset.employee || currentAsset.workday_employee || currentAsset.matched_employee) as any;
      setEmployeeDetails({
        id: empData.id ?? empData.employee_id ?? '',
        employee_id: empData.employee_id ?? currentAsset.verified_employee_id ?? '',
        user_id: empData.user_id ?? currentAsset.assigned_username,
        full_name: empData.full_name ?? currentAsset.verified_employee_name ?? currentAsset.full_name ?? '',
        work_email: empData.work_email ?? currentAsset.work_email ?? currentAsset.email_work ?? '',
        department: empData.department ?? currentAsset.department ?? '',
        division: empData.division ?? currentAsset.division ?? '',
        job_title: empData.job_title ?? currentAsset.job_title ?? '',
        employee_status: empData.employee_status ?? currentAsset.employee_status ?? 'Active',
        manager_username: empData.manager_username ?? empData.manager_user_name ?? currentAsset.manager_username ?? currentAsset.manager_user_name ?? null,
        manager_user_name: empData.manager_user_name ?? empData.manager_username ?? currentAsset.manager_user_name ?? currentAsset.manager_username ?? null,
        manager_name: empData.manager_name ?? currentAsset.manager_name ?? null,
        reporting_evp: empData.reporting_evp ?? empData.reportingEvp ?? currentAsset.reporting_evp ?? currentAsset.reportingEvp ?? null,
        reporting_evp_job_title:
          empData.reporting_evp_job_title ??
          empData.reportingEvpJobTitle ??
          currentAsset.reporting_evp_job_title ??
          currentAsset.reportingEvpJobTitle ??
          null,
        location: empData.location ?? '',
        hire_date: empData.hire_date ?? '',
      });
    }

    // Attempt to retrieve full Workday employee profile
    const lookupKey = currentAsset.verified_employee_id || currentAsset.assigned_username;
    api
      .getEmployeeById(lookupKey)
      .then(emp => {
        if (!isCancelled) {
          setEmployeeDetails(emp);
        }
      })
      .catch(() => {
        if (currentAsset.verified_employee_id && currentAsset.assigned_username && lookupKey !== currentAsset.assigned_username) {
          api
            .getEmployeeById(currentAsset.assigned_username)
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
  }, [currentAsset]);

  if (!currentAsset) return null;

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

  // Model + Manufacturer formatted as "Manufacturer - Model"
  const getModelManufacturerDisplay = (): string => {
    if (!currentAsset) return '—';
    const manufacturer = (currentAsset.manufacturer || '').trim();
    const model = (currentAsset.model || '').trim();
    if (manufacturer && model) {
      return `${manufacturer} - ${model}`;
    }
    return manufacturer || model || '—';
  };
  const formattedModelManufacturer = getModelManufacturerDisplay();

  // Category formatted dynamically from asset.category returned by GET /api/assets (e.g. STORE or CORPORATE)
  const getCategoryDisplay = (): string => {
    if (!currentAsset) return '—';
    const rawCategory =
      currentAsset.category ??
      (currentAsset as any).Category ??
      (currentAsset as any).asset_category ??
      (currentAsset as any).assetCategory ??
      (currentAsset as any)['Category'] ??
      (currentAsset.department &&
       (currentAsset.department.toLowerCase().includes('operations') ||
        currentAsset.department.toLowerCase().includes('retail') ||
        currentAsset.department.toLowerCase().includes('store'))
        ? 'STORE'
        : 'CORPORATE');
    if (rawCategory === undefined || rawCategory === null) return '—';
    const trimmed = String(rawCategory).trim();
    return trimmed ? trimmed.toUpperCase() : '—';
  };
  const displayedCategory = getCategoryDisplay();

  // Field edit handlers
  const handleStartEdit = (field: string, currentValue: any) => {
    setEditingField(field);
    let val = '';
    if (field === 'asset_status') {
      const raw = String(currentValue ?? currentAsset?.asset_status ?? 'ACTIVE').trim().toUpperCase().replace(/_/g, ' ');
      if (raw === 'IN STOCK' || raw === 'INSTOCK') {
        val = 'INSTOCK';
      } else if (raw === 'REVIEW' || raw === 'NEED VALIDATION' || raw === 'NEEDVALIDATION') {
        val = 'REVIEW';
      } else if (raw === 'EXPIRED') {
        val = 'EXPIRED';
      } else {
        val = 'ACTIVE';
      }
    } else if (field === 'category') {
      val = String(currentValue ?? displayedCategory ?? 'CORPORATE').trim().toUpperCase();
      if (val !== 'STORE' && val !== 'CORPORATE') {
        val = 'CORPORATE';
      }
    } else if (field === 'managed_by') {
      val = String(currentValue ?? currentAsset?.managed_by ?? 'INDIVIDUAL').trim().toUpperCase();
      if (val !== 'GROUP' && val !== 'INDIVIDUAL') {
        val = 'INDIVIDUAL';
      }
    } else if (field === 'devicetype') {
      val = String(currentValue ?? currentAsset?.devicetype ?? currentAsset?.device_type ?? 'Laptop').trim();
      if (val.toLowerCase() === 'desktop') {
        val = 'Desktop';
      } else {
        val = 'Laptop';
      }
    } else {
      val = currentValue !== undefined && currentValue !== null && currentValue !== '—' ? String(currentValue) : '';
    }
    setEditValue(val);
    setSaveError(null);
    setSaveSuccessField(null);
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  };

  const handleSave = async (field: string) => {
    if (!currentAsset || isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const assetId = currentAsset.id || currentAsset.asset_number;
      const payload: Record<string, any> = {};

      if (field === 'serial_number') {
        payload.serial_number = editValue.trim();
      } else if (field === 'manufacturer') {
        payload.manufacturer = editValue.trim();
      } else if (field === 'model') {
        payload.model = editValue.trim();
      } else if (field === 'os_name') {
        payload.os_name = editValue.trim();
      } else if (field === 'devicetype') {
        payload.devicetype = editValue;
        payload.device_type = editValue;
      } else if (field === 'managed_by') {
        payload.managed_by = editValue;
      } else if (field === 'category') {
        payload.category = editValue;
      } else if (field === 'asset_status') {
        payload.asset_status = editValue;
      }

      const updated = await api.updateAsset(assetId, payload);
      const mergedAsset: Asset = {
        ...currentAsset,
        ...updated,
        ...(field === 'serial_number' ? { serial_number: editValue.trim(), serialNumber: editValue.trim() } : {}),
        ...(field === 'manufacturer' ? { manufacturer: editValue.trim() } : {}),
        ...(field === 'model' ? { model: editValue.trim() } : {}),
        ...(field === 'os_name' ? { os_name: editValue.trim(), osName: editValue.trim() } : {}),
        ...(field === 'devicetype' ? { devicetype: editValue, device_type: editValue, deviceType: editValue } : {}),
        ...(field === 'managed_by' ? { managed_by: editValue, managedBy: editValue } : {}),
        ...(field === 'category' ? { category: editValue } : {}),
        ...(field === 'asset_status' ? { asset_status: editValue as any, assetStatus: editValue } : {}),
      };

      setCurrentAsset(mergedAsset);
      setEditingField(null);
      setSaveSuccessField(field);
      setTimeout(() => {
        setSaveSuccessField(prev => (prev === field ? null : prev));
      }, 3000);

      if (onAssetUpdated) {
        onAssetUpdated(mergedAsset);
      }
    } catch (err: any) {
      console.error('Failed to update asset field:', err);
      setSaveError(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reusable field renderer with inline pencil button
  const renderField = (
    fieldKey: string,
    fieldLabel: string,
    currentValue: any,
    inputType: 'text' | 'select',
    options?: string[],
    customDisplay?: React.ReactNode,
    valueClassName: string = 'text-slate-900 font-medium'
  ) => {
    const isEditing = editingField === fieldKey;

    if (isEditing) {
      return (
        <div>
          <span className="text-slate-500 block mb-1">{fieldLabel}</span>
          <div className="flex flex-col gap-1.5">
            {inputType === 'text' ? (
              <input
                type="text"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave(fieldKey);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                  }
                }}
                disabled={isSaving}
                data-testid={`input-${fieldKey}`}
                aria-label={fieldLabel}
                className="w-full px-2 py-1 text-xs font-medium border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                autoFocus
              />
            ) : (
              <select
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave(fieldKey);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                  }
                }}
                disabled={isSaving}
                data-testid={`input-${fieldKey}`}
                aria-label={fieldLabel}
                className="w-full px-2 py-1 text-xs font-medium border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                autoFocus
              >
                {options?.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSave(fieldKey)}
                disabled={isSaving}
                data-testid={`save-${fieldKey}`}
                className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                data-testid={`cancel-${fieldKey}`}
                className="px-2 py-0.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
            {saveError && (
              <span className="text-[10.5px] text-rose-600 font-medium block">{saveError}</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <span className="text-slate-500 block mb-0.5">{fieldLabel}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {customDisplay ? (
            customDisplay
          ) : (
            <span className={valueClassName}>{displayVal(currentValue)}</span>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => handleStartEdit(fieldKey, currentValue)}
              aria-label={`Edit ${fieldLabel}`}
              data-testid={`edit-${fieldKey}`}
              className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer inline-flex items-center"
              title={`Edit ${fieldLabel}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {saveSuccessField === fieldKey && (
            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
      </div>
    );
  };

  // Derive Employee Status
  const getDerivedEmployeeStatus = (): 'Active' | 'Inactive' | 'Not in Workday' | 'Unassigned' => {
    if (!currentAsset.assigned_username || currentAsset.assigned_username.trim() === '') {
      return 'Unassigned';
    }

    if (currentAsset.workday_status === 'Not Found in Workday' || currentAsset.workday_status === 'Admin Account') {
      return 'Not in Workday';
    }

    const hasMatch = Boolean(
      employeeDetails ||
      (currentAsset.verified_employee_name && currentAsset.verified_employee_name.trim() !== '') ||
      (currentAsset.verified_employee_id && currentAsset.verified_employee_id.trim() !== '') ||
      (currentAsset.full_name && currentAsset.full_name.trim() !== '') ||
      currentAsset.workday_status === 'Matched'
    );

    if (!hasMatch) {
      return 'Not in Workday';
    }

    const rawEmpStatus = (
      employeeDetails?.employee_status ||
      currentAsset.employee_status ||
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
  const isMatchedEmployee = employeeStatus === 'Active' || employeeStatus === 'Inactive';

  const displayedUsername =
    employeeStatus === 'Unassigned'
      ? '—'
      : displayVal(currentAsset.assigned_username);

  const displayedFullName = isMatchedEmployee
    ? displayVal(employeeDetails?.full_name || currentAsset.full_name || currentAsset.verified_employee_name)
    : '—';

  const displayedWorkEmail = isMatchedEmployee
    ? displayVal(employeeDetails?.work_email || currentAsset.email_work || currentAsset.work_email)
    : '—';

  const displayedDivision = isMatchedEmployee
    ? displayVal(employeeDetails?.division || currentAsset.division)
    : '—';

  const displayedDepartment = isMatchedEmployee
    ? displayVal(employeeDetails?.department || (currentAsset as any)?.workday_employee?.department || (currentAsset as any)?.employee?.department || currentAsset.department)
    : '—';

  const displayedJobTitle = isMatchedEmployee
    ? displayVal(employeeDetails?.job_title || currentAsset.job_title)
    : '—';

  const rawManagerUserName =
    employeeDetails?.manager_user_name ??
    employeeDetails?.manager_username ??
    (employeeDetails as any)?.managerUsername ??
    (employeeDetails as any)?.manager_user ??
    currentAsset.manager_user_name ??
    currentAsset.manager_username ??
    currentAsset.managerUsername ??
    (currentAsset as any)?.manager_user ??
    currentAsset.employee?.manager_user_name ??
    currentAsset.employee?.manager_username ??
    (currentAsset.employee as any)?.managerUsername ??
    (currentAsset.workday_employee as any)?.manager_user_name ??
    (currentAsset.workday_employee as any)?.manager_username ??
    (currentAsset.workday_employee as any)?.managerUsername ??
    (currentAsset.matched_employee as any)?.manager_user_name ??
    (currentAsset.matched_employee as any)?.manager_username ??
    null;

  const displayedManagerUserName = isMatchedEmployee
    ? displayVal(rawManagerUserName)
    : '—';

  const rawManagerName =
    employeeDetails?.manager_name ??
    (employeeDetails as any)?.managerName ??
    currentAsset.manager_name ??
    currentAsset.managerName ??
    currentAsset.employee?.manager_name ??
    (currentAsset.employee as any)?.managerName ??
    (currentAsset.workday_employee as any)?.manager_name ??
    (currentAsset.matched_employee as any)?.manager_name ??
    null;

  const displayedManagerName = isMatchedEmployee
    ? displayVal(rawManagerName)
    : '—';

  // Helper to format reporting EVP into "<full_name>(<user_id>)" and extract job title
  const getReportingEvpInfo = (
    rawEvp: any,
    rawJobTitle?: any
  ): { displayText: string; jobTitle: string | null } => {
    if (rawEvp === null || rawEvp === undefined) {
      return { displayText: '-', jobTitle: null };
    }

    let fullName = '';
    let userId = '';
    let jobTitle: string | null = null;

    const sanitizeTitle = (val: any): string | null => {
      if (val === null || val === undefined) return null;
      const s = String(val).trim();
      if (
        !s ||
        s === '-' ||
        s === '—' ||
        s.toLowerCase() === 'null' ||
        s.toLowerCase() === 'undefined' ||
        s.toLowerCase() === 'none'
      ) {
        return null;
      }
      return s;
    };

    if (typeof rawEvp === 'object') {
      fullName = String(
        rawEvp.full_name ??
        rawEvp.fullName ??
        rawEvp.name ??
        rawEvp['Full Name'] ??
        rawEvp['full_name'] ??
        ''
      ).trim();
      userId = String(
        rawEvp.user_id ??
        rawEvp.userId ??
        rawEvp.username ??
        rawEvp['User ID'] ??
        rawEvp['user_id'] ??
        rawEvp.employee_id ??
        ''
      ).trim();
      const objTitle =
        rawEvp.job_title ??
        rawEvp.jobTitle ??
        rawEvp.title ??
        rawEvp['Job Title'] ??
        rawEvp['job_title'] ??
        rawEvp.role ??
        rawEvp.designation;
      jobTitle = sanitizeTitle(objTitle);
    } else {
      const str = String(rawEvp).trim();
      if (
        !str ||
        str === '-' ||
        str === '—' ||
        str.toLowerCase() === 'null' ||
        str.toLowerCase() === 'none' ||
        str.toLowerCase() === 'undefined'
      ) {
        return { displayText: '-', jobTitle: null };
      }

      // Check if multi-line string: Line 1 name/id, Line 2 job title
      const lines = str.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        const pMatch = lines[0].match(/^([^(]+?)\s*\(([^)]+)\)/);
        if (pMatch) {
          fullName = pMatch[1].trim();
          userId = pMatch[2].trim();
        } else {
          fullName = lines[0];
        }
        jobTitle = sanitizeTitle(lines[1]);
      } else {
        // Check for "Name(USER_ID) - Job Title"
        const dashMatch = str.match(/^([^(]+?)\s*\(([^)]+)\)\s*[-–—]\s*(.+)$/);
        if (dashMatch) {
          fullName = dashMatch[1].trim();
          userId = dashMatch[2].trim();
          jobTitle = sanitizeTitle(dashMatch[3]);
        } else {
          // Standard parenthesis format: "Jane Smith(JS MITH)" or "Jane Smith (JS MITH)"
          const parenMatch = str.match(/^([^(]+?)\s*\(([^)]+)\)$/);
          if (parenMatch) {
            fullName = parenMatch[1].trim();
            userId = parenMatch[2].trim();
          } else {
            fullName = str;
          }
        }
      }
    }

    if (!fullName && !userId) {
      return { displayText: '-', jobTitle: null };
    }

    if (
      (fullName === '-' || fullName === '—' || fullName.toLowerCase() === 'null' || fullName.toLowerCase() === 'undefined') &&
      !userId
    ) {
      return { displayText: '-', jobTitle: null };
    }

    let displayText = '-';
    if (fullName && userId) {
      displayText = `${fullName}(${userId})`;
    } else {
      displayText = fullName || userId || '-';
    }

    // Secondary fallback for job title from rawJobTitle parameter
    if (!jobTitle && rawJobTitle) {
      jobTitle = sanitizeTitle(rawJobTitle);
    }

    return { displayText, jobTitle };
  };

  const rawReportingEvp =
    currentAsset.reporting_evp ??
    currentAsset.reportingEvp ??
    (currentAsset as any)['Reporting EVP'] ??
    (currentAsset as any)['reporting_evp'] ??
    currentAsset.employee?.reporting_evp ??
    currentAsset.workday_employee?.reporting_evp ??
    currentAsset.matched_employee?.reporting_evp ??
    employeeDetails?.reporting_evp ??
    (employeeDetails as any)?.reportingEvp ??
    null;

  const rawReportingEvpJobTitle =
    currentAsset.reporting_evp_job_title ??
    currentAsset.reportingEvpJobTitle ??
    (currentAsset as any)['Reporting EVP Job Title'] ??
    (currentAsset as any)['reporting_evp_job_title'] ??
    (currentAsset as any)['Reporting EVP Title'] ??
    (currentAsset as any)['reporting_evp_title'] ??
    currentAsset.employee?.reporting_evp_job_title ??
    currentAsset.employee?.reportingEvpJobTitle ??
    currentAsset.workday_employee?.reporting_evp_job_title ??
    currentAsset.workday_employee?.reportingEvpJobTitle ??
    currentAsset.matched_employee?.reporting_evp_job_title ??
    currentAsset.matched_employee?.reportingEvpJobTitle ??
    employeeDetails?.reporting_evp_job_title ??
    (employeeDetails as any)?.reportingEvpJobTitle ??
    (typeof rawReportingEvp === 'object' && rawReportingEvp !== null
      ? (rawReportingEvp.job_title ?? rawReportingEvp.jobTitle ?? rawReportingEvp.title)
      : null) ??
    null;

  const reportingEvpInfo = isMatchedEmployee
    ? getReportingEvpInfo(rawReportingEvp, rawReportingEvpJobTitle)
    : { displayText: '-', jobTitle: null };

  const displayedReportingEvp = reportingEvpInfo.displayText;
  const displayedReportingEvpJobTitle = displayedReportingEvp !== '-' ? reportingEvpInfo.jobTitle : null;

  // Backend-calculated remaining days
  const rawDaysRemaining = currentAsset.days_remaining ?? currentAsset.daysRemaining;

  // Remarks display: show saved remarks, or '—' if empty/whitespace
  const getRemarksDisplay = (): string => {
    const raw = currentAsset.remarks ?? currentAsset.notes ?? (currentAsset as any)?.remarks_text;
    if (raw === undefined || raw === null) return '—';
    const str = String(raw).trim();
    return str.length > 0 ? str : '—';
  };
  const displayedRemarks = getRemarksDisplay();

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
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Assignment Success Alert */}
            {assignmentSuccessMessage && (
              <div
                className="flex items-center justify-between p-3.5 rounded-lg border text-xs bg-emerald-50 border-emerald-200 text-emerald-800 shadow-2xs animate-in fade-in duration-150"
                data-testid="drawer-assignment-success"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{assignmentSuccessMessage}</span>
                </div>
                {onDismissAssignmentSuccessMessage && (
                  <button
                    onClick={onDismissAssignmentSuccessMessage}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Status Strip: 1. Asset Status, 2. EOL, 3. Assignment Type */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div className="relative">
                <span className="block text-[11px] text-slate-500 mb-1">Asset Status</span>
                {editingField === 'asset_status' ? (
                  <div className="flex flex-col gap-1.5">
                    <select
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSave('asset_status');
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancel();
                        }
                      }}
                      disabled={isSaving}
                      data-testid="input-asset_status"
                      aria-label="Asset Status"
                      className="w-full px-1.5 py-1 text-xs font-semibold border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      autoFocus
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="REVIEW">REVIEW</option>
                      <option value="INSTOCK">INSTOCK</option>
                      <option value="EXPIRED">EXPIRED</option>
                    </select>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSave('asset_status')}
                        disabled={isSaving}
                        data-testid="save-asset_status"
                        className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSaving}
                        data-testid="cancel-asset_status"
                        className="px-2 py-0.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                    {saveError && (
                      <span className="text-[10px] text-rose-600 font-medium block">{saveError}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={currentAsset.asset_status} type="asset_status" uppercase />
                    {editable && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit('asset_status', currentAsset.asset_status)}
                        aria-label="Edit Asset Status"
                        data-testid="edit-asset_status"
                        className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer inline-flex items-center"
                        title="Edit Asset Status"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {saveSuccessField === 'asset_status' && (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">EOL</span>
                <StatusBadge status={currentAsset.eol_status || 'UNKNOWN'} type="eol_status" uppercase />
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">Assignment Type</span>
                <StatusBadge status={currentAsset.assignment_type} type="assignment" uppercase />
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
                      {displayVal(currentAsset.asset_number || currentAsset.assetNumber)}
                    </span>
                    {(currentAsset.asset_number || currentAsset.assetNumber) && (
                      <CopyButton text={currentAsset.asset_number || currentAsset.assetNumber} label="Asset Number" />
                    )}
                  </div>
                </div>

                {editable ? (
                  <>
                    {renderField(
                      'manufacturer',
                      'Manufacturer',
                      currentAsset.manufacturer,
                      'text',
                      undefined,
                      undefined,
                      'text-slate-900 font-medium break-words'
                    )}
                    {renderField(
                      'model',
                      'Model',
                      currentAsset.model,
                      'text',
                      undefined,
                      undefined,
                      'text-slate-900 font-medium break-words'
                    )}
                  </>
                ) : (
                  <div>
                    <span className="text-slate-500 block">Model + Manufacturer</span>
                    <span className="text-slate-900 font-medium break-words">{formattedModelManufacturer}</span>
                  </div>
                )}

                {renderField(
                  'serial_number',
                  'Serial Number',
                  currentAsset.serialNumber || currentAsset.serial_number,
                  'text',
                  undefined,
                  undefined,
                  'font-mono text-slate-900 font-semibold'
                )}

                <div>
                  <span className="text-slate-500 block mb-1">Discovery Source</span>
                  <SourceBadge source={currentAsset.source} />
                </div>

                {renderField(
                  'devicetype',
                  'Device Type',
                  currentAsset.devicetype || currentAsset.device_type,
                  'select',
                  ['Laptop', 'Desktop'],
                  undefined,
                  'text-slate-900'
                )}

                {renderField(
                  'os_name',
                  'Operating System',
                  currentAsset.osName || currentAsset.os_name,
                  'text',
                  undefined,
                  undefined,
                  'text-slate-900 font-medium'
                )}

                <div>
                  <span className="text-slate-500 block">MAC Address</span>
                  <span className="font-mono text-slate-900">{displayVal(currentAsset.macAddress || currentAsset.mac_address || currentAsset.macaddress)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">EOL Date</span>
                  <span className="font-mono text-slate-900 font-medium">{formatEolDate(currentAsset.eolDate || currentAsset.eol_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">EOL Days Remaining</span>
                  <span
                    className={`font-mono font-medium ${
                      toStandardEOLStatus(currentAsset.eol_status) === 'UNKNOWN' || rawDaysRemaining === null || rawDaysRemaining === undefined
                        ? 'text-slate-500'
                        : Number(rawDaysRemaining) <= 0
                        ? 'text-rose-600 font-semibold'
                        : Number(rawDaysRemaining) <= 90
                        ? 'text-amber-600 font-semibold'
                        : 'text-emerald-700 font-semibold'
                    }`}
                  >
                    {toStandardEOLStatus(currentAsset.eol_status) === 'UNKNOWN' || rawDaysRemaining === null || rawDaysRemaining === undefined || isNaN(Number(rawDaysRemaining))
                      ? '—'
                      : `${rawDaysRemaining} days`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Last Discovery Report</span>
                  <span className="font-mono text-slate-700">
                    {formatDiscoveryDate(currentAsset.lastDiscoveryDate || currentAsset.last_report_time || currentAsset.lastreporttime)}
                  </span>
                </div>

                {renderField(
                  'managed_by',
                  'Managed By',
                  currentAsset.managed_by,
                  'select',
                  ['GROUP', 'INDIVIDUAL'],
                  <ManagedByBadge managedBy={currentAsset.managed_by} />
                )}

                {renderField(
                  'category',
                  'Category',
                  displayedCategory,
                  'select',
                  ['STORE', 'CORPORATE'],
                  <span
                    data-testid="asset-category-value"
                    data-field="category"
                    className="text-slate-900 font-medium"
                  >
                    {displayVal(displayedCategory)}
                  </span>
                )}
              </div>
            </div>

            {/* Assigned User */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Assigned User
                  </h3>
                  {allowAssignUser && (
                    <button
                      type="button"
                      onClick={() => currentAsset && onAssignUser?.(currentAsset)}
                      className="p-0.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 rounded transition-colors cursor-pointer inline-flex items-center"
                      title="Assign / Reassign User"
                      aria-label="Assign / Reassign User"
                      data-testid="assign-reassign-user-button"
                    >
                      <UserRoundPlus className="w-3.5 h-3.5 stroke-[2.25]" />
                    </button>
                  )}
                </div>
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
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Manager Name</span>
                  <span className="font-medium text-slate-900">
                    {displayedManagerName}
                  </span>
                </div>

                {/* 9. Reporting EVP */}
                <div
                  className="flex items-start justify-between py-1"
                  data-field="reporting_evp"
                  data-testid="reporting-evp-row"
                >
                  <span className="text-slate-500 pt-0.5">Reporting EVP</span>
                  <div className="text-right">
                    <span
                      data-testid="reporting-evp-name"
                      data-field="reporting_evp_name"
                      className={`font-medium block leading-snug ${
                        displayedReportingEvp === '-' ? 'text-slate-400 font-medium' : 'text-slate-900'
                      }`}
                    >
                      {displayedReportingEvp}
                    </span>
                    {displayedReportingEvp !== '-' && displayedReportingEvpJobTitle && (
                      <span
                        data-testid="reporting-evp-job-title"
                        data-field="reporting_evp_job_title"
                        className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5"
                      >
                        {displayedReportingEvpJobTitle}
                      </span>
                    )}
                  </div>
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
