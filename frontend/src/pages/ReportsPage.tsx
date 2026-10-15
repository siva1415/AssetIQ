import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Laptop,
  Server,
  PackageCheck,
  ShieldAlert,
  Download,
  CheckCircle2,
  RefreshCw,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  Asset,
  Employee,
  ASSET_STATUSES,
  ASSET_STATUS_LABELS,
  toStandardAssetStatus,
  toStandardEOLStatus,
  formatEolDate
} from '../types';

type WarrantyBucket = 'EXPIRED' | 'EXPIRING' | 'ACTIVE';

export const ReportsPage: React.FC = () => {
  const { dataRefreshKey } = useApp();

  // Navigation Tab State: 'analysis' (Report Analysis) vs 'builder' (Custom Filter & Export Builder)
  const [activeTab] = useState<'analysis' | 'builder'>('analysis');

  // Selected Catalog Card in Tab 1
  const [selectedCatalogCard] = useState<
    'master' | 'warranty' | 'bigfix' | 'jamf' | 'instock' | 'need-validation'
  >('master');

  // Filters for Custom Builder (Tab 2)
  const [filterSource] = useState<string>('ALL');
  const [filterAssignment] = useState<string>('ALL');
  const [filterWarranty] = useState<string>('ALL');
  const [searchKeyword] = useState<string>('');

  // Data State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper function to safely extract days remaining
  const getDaysRemaining = (a: Asset): number | null => {
    if (a.days_remaining !== undefined && a.days_remaining !== null) return a.days_remaining;
    if (a.daysRemaining !== undefined && a.daysRemaining !== null) return a.daysRemaining;
    return null;
  };

  // SINGLE source of truth for warranty classification (used by stats, filters and export)
  //  - EXPIRED : status EXPIRED or days < 0
  //  - EXPIRING: status EOL SOON or 0 <= days <= 90
  //  - ACTIVE  : everything else
  const getWarrantyBucket = (a: Asset): WarrantyBucket => {
    const eolStatus = toStandardEOLStatus(a.calculated_eol_status || a.eol_status || a.eolStatus);
    const days = getDaysRemaining(a);
    if (eolStatus === 'EXPIRED' || (days !== null && days < 0)) return 'EXPIRED';
    if (eolStatus === 'EOL SOON' || (days !== null && days >= 0 && days <= 90)) return 'EXPIRING';
    return 'ACTIVE';
  };

  // Load Live Fleet and Workday Directory Data
  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetsResp, empResp] = await Promise.all([
        api.getAssets({ page: 1, page_size: 1000 }),
        api.getEmployees({ page: 1, page_size: 1000 })
      ]);

      setAssets(assetsResp.items || []);
      setEmployees(empResp.items || []);
    } catch (err: any) {
      console.error('[ReportsPage] Failed to load live fleet data:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load fleet report data from backend API.');
      setAssets([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [dataRefreshKey]);

  // Employee Lookup Helper
  const getEmployeeByUserId = (userId?: string | null): Employee | undefined => {
    if (!userId) return undefined;
    const target = userId.toLowerCase().trim();
    return employees.find(
      e =>
        (e.user_id && e.user_id.toLowerCase().trim() === target) ||
        (e.full_name && e.full_name.toLowerCase().trim() === target) ||
        (e.work_email && e.work_email.toLowerCase().trim() === target) ||
        (e.employee_id && e.employee_id.toLowerCase().trim() === target)
    );
  };

  // ---------------------------------------------------------------------------
  // Shared report lists: the card counts and the Excel exports use the SAME lists
  // so they can never disagree.
  // ---------------------------------------------------------------------------
  const bigFixAssets = useMemo(() => assets.filter(a => a.source === 'BIGFIX'), [assets]);
  const jamfAssets = useMemo(() => assets.filter(a => a.source === 'JAMF'), [assets]);

  const warrantyIssueAssets = useMemo(
    () => assets.filter(a => getWarrantyBucket(a) !== 'ACTIVE'),
    [assets]
  );

  const inStockAssets = useMemo(
    () => assets.filter(a => toStandardAssetStatus(a.asset_status) === ASSET_STATUSES.IN_STOCK),
    [assets]
  );

  // FIX: toStandardAssetStatus() returns 'NEED VALIDATION' (with a space) for
  // REVIEW / NEED VALIDATION / NEEDVALIDATION, so compare against that constant.
  const needValidationAssets = useMemo(
    () =>
      assets.filter(
        a => toStandardAssetStatus(a.asset_status) === ASSET_STATUSES.NEED_VALIDATION
      ),
    [assets]
  );

  // Live Statistics computed from the shared lists
  const stats = useMemo(() => {
    let expired = 0;
    let expiring = 0;
    for (const a of warrantyIssueAssets) {
      if (getWarrantyBucket(a) === 'EXPIRED') expired++;
      else expiring++;
    }

    return {
      masterCount: assets.length,
      expiredCount: expired,
      expiringCount: expiring,
      totalWarrantyIssues: warrantyIssueAssets.length,
      bigFixCount: bigFixAssets.length,
      jamfCount: jamfAssets.length,
      inStockCount: inStockAssets.length,
      needValidationCount: needValidationAssets.length
    };
  }, [assets, warrantyIssueAssets, bigFixAssets, jamfAssets, inStockAssets, needValidationAssets]);

  // Tab 1: Catalog Card Assets Filtering
  const catalogReportAssets = useMemo(() => {
    switch (selectedCatalogCard) {
      case 'master':
        return assets;
      case 'warranty':
        return warrantyIssueAssets;
      case 'bigfix':
        return bigFixAssets;
      case 'jamf':
        return jamfAssets;
      case 'instock':
        return inStockAssets;
      case 'need-validation':
        return needValidationAssets;
      default:
        return assets;
    }
  }, [
    assets,
    selectedCatalogCard,
    warrantyIssueAssets,
    bigFixAssets,
    jamfAssets,
    inStockAssets,
    needValidationAssets
  ]);

  // Tab 2: Custom Query Builder Assets Filtering
  const filteredReportAssets = useMemo(() => {
    return assets.filter(a => {
      // 1. Management Source
      if (filterSource !== 'ALL') {
        if (filterSource === 'BIGFIX' && a.source !== 'BIGFIX') return false;
        if (filterSource === 'JAMF' && a.source !== 'JAMF') return false;
      }

      // 2. Assignment Status
      if (filterAssignment !== 'ALL') {
        const standardStatus = toStandardAssetStatus(a.asset_status);
        if (filterAssignment === 'IN_STOCK') {
          if (standardStatus !== ASSET_STATUSES.IN_STOCK) return false;
        } else if (filterAssignment === 'IN_USE') {
          if (standardStatus === ASSET_STATUSES.IN_STOCK) return false;
        }
      }

      // 3. Warranty Status
      if (filterWarranty !== 'ALL') {
        const bucket = getWarrantyBucket(a);
        if (filterWarranty === 'EXPIRED' && bucket !== 'EXPIRED') return false;
        if (filterWarranty === 'EXPIRING_SOON' && bucket !== 'EXPIRING') return false;
        if (filterWarranty === 'ACTIVE' && bucket !== 'ACTIVE') return false;
      }

      // 4. Keyword Search
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase().trim();
        const emp = getEmployeeByUserId(a.assigned_username);
        const matchId = String(a.id || '').toLowerCase().includes(q);
        const matchNum = String(a.asset_number || '').toLowerCase().includes(q);
        const matchSerial = String(a.serial_number || '').toLowerCase().includes(q);
        const matchModel = String(a.model || '').toLowerCase().includes(q);
        const matchUser = String(a.assigned_username || a.verified_employee_name || '').toLowerCase().includes(q);
        const matchEmpName = String(emp?.full_name || '').toLowerCase().includes(q);

        if (!matchId && !matchNum && !matchSerial && !matchModel && !matchUser && !matchEmpName) {
          return false;
        }
      }

      return true;
    });
  }, [assets, employees, filterSource, filterAssignment, filterWarranty, searchKeyword]);

  // Transform Data for SheetJS Export
  const prepareExportData = (dataList: Asset[]) => {
    return dataList.map(a => {
      const emp = getEmployeeByUserId(a.assigned_username);
      const bucket = getWarrantyBucket(a);

      const warrantyLabel =
        bucket === 'EXPIRED' ? 'Expired' : bucket === 'EXPIRING' ? 'Expiring Soon (<90d)' : 'Active';

      return {
        'Asset ID': a.asset_number || a.assetNumber || a.id,
        'Source': a.source === 'BIGFIX' ? 'BigFix' : 'Jamf',
        'DeviceType': a.device_type || a.deviceType || a.devicetype || 'N/A',
        'Manufacturer': a.manufacturer || 'N/A',
        'Model': a.model,
        'Serial Number': a.serial_number || a.serialNumber,
        'Operating System': a.os_name || a.osName || 'N/A',
        'MacAddress': a.mac_address || a.macAddress || a.macaddress || 'N/A',
        'Computer ID': a.id,
        'Asset Status': ASSET_STATUS_LABELS[toStandardAssetStatus(a.asset_status)],
        'Warranty Expiry Date': formatEolDate(a.eol_date),
        'Warranty Status': warrantyLabel,
        'Managed By': a.managed_by || a.managedBy || 'N/A',
        'Assigned UserID': a.assigned_username || a.assignedUsername || emp?.user_id || '',
        'Assigned UserName':
          a.verified_employee_name || a.verifiedEmployeeName || emp?.full_name || 'Unassigned',
        'Department': a.department || emp?.department || 'N/A',
        'Remarks': a.remarks || a.notes || ''
      };
    });
  };

  // Export to Excel (.xlsx) using SheetJS
  const handleExportExcel = (dataList: Asset[], titleName: string) => {
    // FIX: never download a silent empty file
    if (!dataList.length) {
      showToast(`No records found for ${titleName.replace(/_/g, ' ')}.`);
      return;
    }

    const formattedData = prepareExportData(dataList);
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Governance');

    const cleanName = titleName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `AssetIQ_${cleanName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(wb, fileName);
    showToast(`Successfully exported ${dataList.length} records to ${fileName}!`);
  };

  // Export to CSV (.csv) using SheetJS
  const handleExportCSV = (dataList: Asset[], titleName: string) => {
    if (!dataList.length) {
      showToast(`No records found for ${titleName.replace(/_/g, ' ')}.`);
      return;
    }

    const formattedData = prepareExportData(dataList);
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanName = titleName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `AssetIQ_${cleanName}_${new Date().toISOString().slice(0, 10)}.csv`;

    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Successfully exported ${dataList.length} records to ${fileName}!`);
  };

  // Keep helpers referenced so strict "noUnusedLocals" builds don't complain
  void handleExportCSV;
  void filteredReportAssets;
  void catalogReportAssets;

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-900 font-sans pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-2xl border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {loading ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl mx-6 mt-4 space-y-3">
          <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">
            Loading governance report telemetry...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl mx-6 mt-4 text-rose-800 text-xs font-medium">
          {error}
        </div>
      ) : (
        <>
          {/* TAB 1: REPORT ANALYSIS (CATALOG CARDS) */}
          {activeTab === 'analysis' && (
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* 1. Master Hardware */}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-all ${
                    selectedCatalogCard === 'master'
                      ? 'border-slate-900 ring-2 ring-slate-900'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="p-2.5 bg-[#EFF6FF] text-[#2563EB] rounded-xl">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <span className="px-3 py-1 bg-[#DBEAFE] text-[#1E40AF] text-xs font-bold rounded-lg font-mono">
                        {stats.masterCount} Assets
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Master Hardware</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Complete inventory across BigFix &amp; Jamf with serial numbers, users, and warranty details.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(assets, 'Master_Hardware')}
                      className="bg-[#E8F8F0] border border-[#BCE8D1] text-[#0D8249] hover:bg-[#D8F3E5] font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    {/* <button
                      onClick={() => handleExportCSV(assets, 'Master_Hardware')}
                      className="bg-[#F1F5F9] text-slate-700 hover:bg-slate-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
                    >
                      CSV
                    </button> */}
                  </div>
                </div>

                {/* 2. Warranty Compliance Issues */}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-all ${
                    selectedCatalogCard === 'warranty'
                      ? 'border-rose-600 ring-2 ring-rose-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="p-2.5 bg-[#FFF1F2] text-[#E11D48] rounded-xl">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 bg-[#FFE4E6] text-[#9F1239] text-xs font-bold rounded-lg font-mono">
                          {stats.expiredCount} Expired
                        </span>
                        <span className="px-2.5 py-1 bg-[#FEF3C7] text-[#92400E] text-xs font-bold rounded-lg font-mono">
                          {stats.expiringCount} Expiring
                        </span>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Warranty Compliance Issues</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Audit of {stats.totalWarrantyIssues} laptops with manufacturer warranty expired or expiring soon.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(warrantyIssueAssets, 'Warranty_Compliance_Issues')}
                      className="bg-[#E6004C] hover:bg-[#C80042] text-white font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                    >
                     <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    {/* <button
                      onClick={() => handleExportCSV(warrantyIssueAssets, 'Warranty_Compliance_Issues')}
                      className="bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E6] font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
                    >
                      CSV
                    </button> */}
                  </div>
                </div>

                {/* 3. BigFix Assets */}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-all ${
                    selectedCatalogCard === 'bigfix'
                      ? 'border-blue-600 ring-2 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="p-2.5 bg-[#EFF6FF] text-[#2563EB] rounded-xl">
                        <Server className="w-4 h-4" />
                      </div>
                      <span className="px-3 py-1 bg-[#DBEAFE] text-[#1E40AF] text-xs font-bold rounded-lg font-mono">
                        {stats.bigFixCount} Units
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">BigFix Assets</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Hardware assets managed via HCL BigFix (Windows &amp; Linux laptops) with user assignment.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(bigFixAssets, 'BigFix_Assets')}
                      className="bg-[#E8F8F0] border border-[#BCE8D1] text-[#0D8249] hover:bg-[#D8F3E5] font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* 4. Jamf Assets */}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-all ${
                    selectedCatalogCard === 'jamf'
                      ? 'border-indigo-600 ring-2 ring-indigo-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="p-2.5 bg-[#EFF6FF] text-[#2563EB] rounded-xl">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <span className="px-3 py-1 bg-[#DBEAFE] text-[#1E40AF] text-xs font-bold rounded-lg font-mono">
                        {stats.jamfCount} Units
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Jamf Assets</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Apple macOS assets managed via Jamf Pro with models, assigned users, and coverage status.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(jamfAssets, 'Jamf_Assets')}
                      className="bg-[#E8F8F0] border border-[#BCE8D1] text-[#0D8249] hover:bg-[#D8F3E5] font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* 5. In-Stock Inventory */}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-all ${
                    selectedCatalogCard === 'instock'
                      ? 'border-amber-600 ring-2 ring-amber-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="p-2.5 bg-[#FFFBEB] text-[#D97706] rounded-xl">
                        <PackageCheck className="w-4 h-4" />
                      </div>
                      <span className="px-3 py-1 bg-[#FEF3C7] text-[#92400E] text-xs font-bold rounded-lg font-mono">
                        {stats.inStockCount} Ready
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">In-Stock Inventory</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Unassigned laptops stored in stockroom depots ready for immediate deployment.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(inStockAssets, 'In_Stock_Inventory')}
                      className="bg-[#FEF8E7] border border-[#FDE68A] text-[#B45309] hover:bg-[#FDF2D0] font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#B45309]" />
                      <span>Excel (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* 6. Need Validation / Review */}
                <div
                  className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-all ${
                    selectedCatalogCard === 'need-validation'
                      ? 'border-amber-600 ring-2 ring-amber-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="p-2.5 bg-[#FFFBEB] text-[#D97706] rounded-xl">
                        <PackageCheck className="w-4 h-4" />
                      </div>
                      <span className="px-3 py-1 bg-[#FEF3C7] text-[#92400E] text-xs font-bold rounded-lg font-mono">
                        {stats.needValidationCount} To Review
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Need-Validation Assets</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Asset user details not matching with Workday.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(needValidationAssets, 'Need_Validation_Assets')}
                      className="bg-[#FEF8E7] border border-[#FDE68A] text-[#B45309] hover:bg-[#FDF2D0] font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#B45309]" />
                      <span>Excel (.xlsx)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;