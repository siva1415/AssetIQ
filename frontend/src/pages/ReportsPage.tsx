import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Laptop,
  Server,
  PackageCheck,
  ShieldAlert,
  Search,
  Download,
  CheckCircle2,
  RefreshCw,
  X,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  Asset,
  Employee,
  toStandardAssetStatus,
  toStandardEOLStatus,
  formatEolDate
} from '../types';

export const ReportsPage: React.FC = () => {
  const { dataRefreshKey } = useApp();

  // Navigation Tab State: 'analysis' (Report Analysis) vs 'builder' (Custom Filter & Export Builder)
  const [activeTab, setActiveTab] = useState<'analysis' | 'builder'>('analysis');

  // Selected Catalog Card in Tab 1
  const [selectedCatalogCard, setSelectedCatalogCard] = useState<
    'master' | 'warranty' | 'bigfix' | 'jamf' | 'instock'
  >('master');

  // Filters for Custom Builder (Tab 2)
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterAssignment, setFilterAssignment] = useState<string>('ALL');
  const [filterWarranty, setFilterWarranty] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

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

  // Live Statistics computed dynamically from real loaded assets
  const stats = useMemo(() => {
    let expired = 0;
    let expiring = 0;
    let bigfix = 0;
    let jamf = 0;
    let instock = 0;

    for (const a of assets) {
      if (a.source === 'BIGFIX') bigfix++;
      else if (a.source === 'JAMF') jamf++;

      const eolStatus = toStandardEOLStatus(a.calculated_eol_status || a.eol_status || a.eolStatus);
      const days = getDaysRemaining(a);
      if (eolStatus === 'EXPIRED' || (days !== null && days < 0)) {
        expired++;
      } else if (eolStatus === 'EOL SOON' || (days !== null && days >= 0 && days <= 90)) {
        expiring++;
      }

      const status = toStandardAssetStatus(a.asset_status);
      if (status === 'IN STOCK') {
        instock++;
      }
    }

    return {
      masterCount: assets.length,
      expiredCount: expired,
      expiringCount: expiring,
      totalWarrantyIssues: expired + expiring,
      bigFixCount: bigfix,
      jamfCount: jamf,
      inStockCount: instock
    };
  }, [assets]);

  // Tab 1: Catalog Card Assets Filtering
  const catalogReportAssets = useMemo(() => {
    switch (selectedCatalogCard) {
      case 'master':
        return assets;
      case 'warranty':
        return assets.filter(a => {
          const eolStatus = toStandardEOLStatus(
            a.calculated_eol_status || a.eol_status || a.eolStatus
          );
          const days = getDaysRemaining(a);
          return (
            eolStatus === 'EXPIRED' ||
            eolStatus === 'EOL SOON' ||
            (days !== null && days <= 90)
          );
        });
      case 'bigfix':
        return assets.filter(a => a.source === 'BIGFIX');
      case 'jamf':
        return assets.filter(a => a.source === 'JAMF');
      case 'instock':
        return assets.filter(a => {
          const status = toStandardAssetStatus(a.asset_status);
          return status === 'IN STOCK' || a.assignment_type === 'Unassigned';
        });
      default:
        return assets;
    }
  }, [assets, selectedCatalogCard]);

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
          if (standardStatus !== 'IN STOCK' && a.assignment_type !== 'Unassigned') {
            return false;
          }
        } else if (filterAssignment === 'IN_USE') {
          if (standardStatus === 'IN STOCK' || a.assignment_type === 'Unassigned') {
            return false;
          }
        }
      }

      // 3. Warranty Status
      if (filterWarranty !== 'ALL') {
        const eolStatus = toStandardEOLStatus(
          a.calculated_eol_status || a.eol_status || a.eolStatus
        );
        const days = getDaysRemaining(a);

        if (filterWarranty === 'EXPIRED') {
          if (eolStatus !== 'EXPIRED' && (days === null || days > 0)) {
            return false;
          }
        } else if (filterWarranty === 'EXPIRING_SOON') {
          if (eolStatus !== 'EOL SOON' && (days === null || days <= 0 || days > 90)) {
            return false;
          }
        } else if (filterWarranty === 'ACTIVE') {
          if (eolStatus === 'EXPIRED' || eolStatus === 'EOL SOON' || (days !== null && days <= 90)) {
            return false;
          }
        }
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

        if (
          !matchId &&
          !matchNum &&
          !matchSerial &&
          !matchModel &&
          !matchUser &&
          !matchEmpName
        ) {
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
      const eolStatus = toStandardEOLStatus(
        a.calculated_eol_status || a.eol_status || a.eolStatus
      );
      const days = getDaysRemaining(a);

      let warrantyLabel = 'Active';
      if (eolStatus === 'EXPIRED' || (days !== null && days <= 0)) {
        warrantyLabel = 'Expired';
      } else if (eolStatus === 'EOL SOON' || (days !== null && days <= 90)) {
        warrantyLabel = 'Expiring Soon (<90d)';
      }

      return {
        'Asset ID': a.asset_number || a.id,
        'Source': a.source === 'BIGFIX' ? 'BigFix' : 'Jamf',
        'Laptop Model': a.model,
        'Assigned User': a.verified_employee_name || emp?.full_name || a.assigned_username || 'Unassigned',
        'Status': a.asset_status === 'In Stock' ? 'In Use' : 'In Stock',
        'Warranty Expiry Date': formatEolDate(a.eol_date),
        'Warranty Status': warrantyLabel,
        'Serial Number': a.serial_number,
        'Operating System': a.os_name,
        'Department': a.department || emp?.department || 'N/A'
      };
    });
  };

  // Export to Excel (.xlsx) using SheetJS
  const handleExportExcel = (dataList: Asset[], titleName: string) => {
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
    showToast(`Successfully exported ${dataList.length} records to ${fileName}!`);
  };

  // Format date helper for exact match e.g. "30 Sep 2026"
  const formatDateDisplay = (dateStr?: string | null): string => {
    if (!dateStr || dateStr === '—') return '30 Sep 2026';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[d.getMonth()];
        const year = d.getFullYear();
        return `${day} ${month} ${year}`;
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

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

      {/* Primary Navigation Tabs */}
      <div className="px-6 pt-5 pb-2 bg-[#F8FAFC]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'analysis'
                ? 'bg-[#0B1527] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Report Analysis
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'builder'
                ? 'bg-[#0B1527] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Custom Filter &amp; Export Builder
          </button>
        </div>
      </div>

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
                    <h3 className="text-sm font-bold text-slate-900">
                      Master Hardware
                    </h3>
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
                    <button
                      onClick={() => handleExportCSV(assets, 'Master_Hardware')}
                      className="bg-[#F1F5F9] text-slate-700 hover:bg-slate-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
                    >
                      CSV
                    </button>
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
                    <h3 className="text-sm font-bold text-slate-900">
                      Warranty Compliance Issues
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Audit of {stats.totalWarrantyIssues} laptops with manufacturer warranty expired or expiring soon.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(catalogReportAssets, 'Warranty_Compliance_Issues')}
                      className="bg-[#E6004C] hover:bg-[#C80042] text-white font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download (.xlsx)</span>
                    </button>
                    <button
                      onClick={() => handleExportCSV(catalogReportAssets, 'Warranty_Compliance_Issues')}
                      className="bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E6] font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
                    >
                      CSV
                    </button>
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
                    <h3 className="text-sm font-bold text-slate-900">
                      BigFix Assets
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Hardware assets managed via HCL BigFix (Windows &amp; Linux laptops) with user assignment.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(assets.filter(a => a.source === 'BIGFIX'), 'BigFix_Assets')}
                      className="bg-[#E8F8F0] border border-[#BCE8D1] text-[#0D8249] hover:bg-[#D8F3E5] font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button
                      onClick={() => handleExportCSV(assets.filter(a => a.source === 'BIGFIX'), 'BigFix_Assets')}
                      className="bg-[#F1F5F9] text-slate-700 hover:bg-slate-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
                    >
                      CSV
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
                    <h3 className="text-sm font-bold text-slate-900">
                      Jamf Assets
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Apple macOS assets managed via Jamf Pro with models, assigned users, and coverage status.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(assets.filter(a => a.source === 'JAMF'), 'Jamf_Assets')}
                      className="bg-[#E8F8F0] border border-[#BCE8D1] text-[#0D8249] hover:bg-[#D8F3E5] font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button
                      onClick={() => handleExportCSV(assets.filter(a => a.source === 'JAMF'), 'Jamf_Assets')}
                      className="bg-[#F1F5F9] text-slate-700 hover:bg-slate-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
                    >
                      CSV
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
                    <h3 className="text-sm font-bold text-slate-900">
                      In-Stock Inventory
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[36px]">
                      Unassigned laptops stored in stockroom depots ready for immediate deployment.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(assets.filter(a =>  toStandardAssetStatus(a.asset_status) === 'IN STOCK'), 'In_Stock_Inventory')}
                      className="bg-[#FEF8E7] border border-[#FDE68A] text-[#B45309] hover:bg-[#FDF2D0] font-bold text-xs py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#B45309]" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button
                      onClick={() => handleExportCSV(assets.filter(a => toStandardAssetStatus(a.asset_status) === 'IN STOCK'), 'In_Stock_Inventory')}
                      className="bg-[#F1F5F9] text-slate-700 hover:bg-slate-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
                    >
                      CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM FILTER & EXPORT BUILDER */}
          {activeTab === 'builder' && (
            <div className="px-6 py-4 space-y-4">
              {/* Top Filter & Export Card Container */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
                {/* Title & Primary Export Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Custom Query &amp; Export Builder
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Filter and export records in Excel (.xlsx) or CSV (.csv) format.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleExportExcel(filteredReportAssets, 'Selection_Export')}
                      disabled={filteredReportAssets.length === 0}
                      className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs shadow-2xs transition-colors disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Export Selection (.xlsx)</span>
                    </button>

                    <button
                      onClick={() => handleExportCSV(filteredReportAssets, 'Selection_Export')}
                      disabled={filteredReportAssets.length === 0}
                      className="bg-[#F1F5F9] hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50"
                    >
                      Export CSV (.csv)
                    </button>
                  </div>
                </div>

                {/* Filter Toolbar Fields (4 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Source */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Source
                    </label>
                    <select
                      value={filterSource}
                      onChange={e => setFilterSource(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="ALL">All Sources (BigFix &amp; Jamf)</option>
                      <option value="BIGFIX">BigFix</option>
                      <option value="JAMF">Jamf Pro</option>
                    </select>
                  </div>

                  {/* 2. Assignment Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Assignment Status
                    </label>
                    <select
                      value={filterAssignment}
                      onChange={e => setFilterAssignment(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="IN_USE">In Use</option>
                      <option value="IN_STOCK">In Stock</option>
                    </select>
                  </div>

                  {/* 3. Warranty Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Warranty Status
                    </label>
                    <select
                      value={filterWarranty}
                      onChange={e => setFilterWarranty(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="ALL">All Warranty States</option>
                      <option value="ACTIVE">Active</option>
                      <option value="EXPIRING_SOON">Expiring Soon</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                  </div>

                  {/* 4. Keyword Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Keyword Filter
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search asset ID, model, serial..."
                        value={searchKeyword}
                        onChange={e => setSearchKeyword(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-slate-800 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      {searchKeyword && (
                        <button
                          onClick={() => setSearchKeyword('')}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Counter & Reset Filter Bar */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <span className="text-xs text-slate-600 font-normal">
                  Matching Records: <strong className="text-slate-900 font-bold">{stats.masterCount}</strong>
                </span>

                <button
                  onClick={() => {
                    setFilterSource('ALL');
                    setFilterAssignment('ALL');
                    setFilterWarranty('ALL');
                    setSearchKeyword('');
                  }}
                  className="text-xs text-blue-600 font-bold cursor-pointer hover:underline"
                >
                  Reset Filters
                </button>
              </div>

              {/* Data Table Matching Screenshot 2 */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4 font-bold">ASSET ID</th>
                        <th className="py-3 px-4 font-bold">SOURCE</th>
                        <th className="py-3 px-4 font-bold">LAPTOP MODEL</th>
                        <th className="py-3 px-4 font-bold">ASSIGNED USER</th>
                        <th className="py-3 px-4 font-bold">STATUS</th>
                        <th className="py-3 px-4 font-bold">WARRANTY EXPIRY DATE</th>
                        <th className="py-3 px-4 font-bold">WARRANTY STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredReportAssets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                            No matching records found for selected query.
                          </td>
                        </tr>
                      ) : (
                        filteredReportAssets.map((asset, idx) => {
                          const emp = getEmployeeByUserId(asset.assigned_username);
                          const eolStatus = toStandardEOLStatus(
                            asset.calculated_eol_status || asset.eol_status || asset.eolStatus
                          );
                          const days = getDaysRemaining(asset);

                          let warrantyPill = (
                            <span className="bg-[#DCFCE7] text-[#166534] font-bold text-[11px] px-2.5 py-0.5 rounded-md inline-block">
                              Active
                            </span>
                          );

                          if (eolStatus === 'EXPIRED' || (days !== null && days <= 0)) {
                            warrantyPill = (
                              <span className="bg-[#FEE2E2] text-[#991B1B] font-bold text-[11px] px-2.5 py-0.5 rounded-md inline-block">
                                Expired
                              </span>
                            );
                          } else if (
                            eolStatus === 'EOL SOON' ||
                            (days !== null && days <= 90)
                          ) {
                            warrantyPill = (
                              <span className="bg-[#FEF3C7] text-[#92400E] font-bold text-[11px] px-2.5 py-0.5 rounded-md inline-block">
                                Expiring Soon
                              </span>
                            );
                          }

                          return (
                            <tr key={asset.id || idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-[#2563EB]">
                                {asset.asset_number || asset.id}
                              </td>
                              <td className="py-3 px-4 font-bold text-xs">
                                <span className={asset.source === 'BIGFIX' ? 'text-[#2563EB]' : 'text-[#4F46E5]'}>
                                  {asset.source === 'BIGFIX' ? 'BigFix' : 'Jamf'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900">
                                {asset.model}
                              </td>
                              <td className="py-3 px-4 text-slate-700 font-medium">
                                {asset.verified_employee_name || emp?.full_name || asset.assigned_username || 'Unassigned'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="bg-[#DCFCE7] text-[#15803D] font-bold text-[11px] px-2.5 py-0.5 rounded-md inline-block">
                                  In Use
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                                {formatDateDisplay(asset.eol_date)}
                              </td>
                              <td className="py-3 px-4">{warrantyPill}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
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
