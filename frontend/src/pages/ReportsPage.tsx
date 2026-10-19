import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  X,
  AlertCircle,
  Monitor,
  PackageCheck,
  ClipboardCheck,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { AppleLogoIcon } from '../components/common/AppleLogoIcon';
import { WindowsLogoIcon } from '../components/common/WindowsLogoIcon';
import { api, ReportCardStats } from '../services/api';
import { useApp } from '../context/AppContext';

interface ReportCardConfig {
  id: 'master' | 'warranty' | 'bigfix' | 'jamf' | 'instock' | 'need-validation';
  title: string;
  description: string;
  count: number;
  exportFilenamePrefix: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}

export const ReportsPage: React.FC = () => {
  const { dataRefreshKey } = useApp();

  // Accurate Live Statistics for all six cards (never truncated)
  const [stats, setStats] = useState<ReportCardStats>({
    masterCount: 0,
    expiredCount: 0,
    expiringCount: 0,
    totalWarrantyIssues: 0,
    bigFixCount: 0,
    jamfCount: 0,
    inStockCount: 0,
    needValidationCount: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Card currently generating/downloading export
  const [exportingCardId, setExportingCardId] = useState<string | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Load Live Fleet Report Card Counts
  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cardStats = await api.getReportCardCounts();
      setStats(cardStats);
    } catch (err: any) {
      console.error('[ReportsPage] Failed to load card counts:', err);
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to load fleet report telemetry from backend API.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [dataRefreshKey]);

  // Export genuine XLSX report for a specific report card using GET /api/assets/export
  const handleExportCard = async (
    cardId: 'master' | 'warranty' | 'bigfix' | 'jamf' | 'instock' | 'need-validation',
    cardTitle: string
  ) => {
    if (exportingCardId) return;

    setExportingCardId(cardId);
    try {
      const result = await api.exportReportXlsx(cardId);

      if (result.count === 0 || result.blob.size === 0) {
        showToast(`No records found for ${cardTitle.replace(/_/g, ' ')}.`);
        return;
      }

      const cleanName = cardTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
      const todayStr = new Date().toISOString().slice(0, 10);
      const downloadFilename = result.filename || `AssetIQ_${cleanName}_${todayStr}.xlsx`;

      const url = window.URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const countMsg = typeof result.count === 'number' && result.count > 0 ? ` ${result.count.toLocaleString()}` : '';
      showToast(`Successfully exported${countMsg} records to ${downloadFilename}!`);
    } catch (err: any) {
      console.error(`[ReportsPage] Failed to export ${cardTitle}:`, err);
      showToast(err?.message || `Failed to export ${cardTitle.replace(/_/g, ' ')}. Please try again.`);
    } finally {
      setExportingCardId(null);
    }
  };

  // Six defined report cards with exact titles, descriptions, distinct icons, and database-backed counts
  const reportCards: ReportCardConfig[] = [
    {
      id: 'master',
      title: 'Master Hardware',
      description:
        'Complete inventory across BigFix and Jamf, including serial numbers, assigned users, and warranty details.',
      count: stats.masterCount,
      exportFilenamePrefix: 'Master_Hardware',
      icon: Monitor,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50 border-blue-200/60',
    },
    {
      id: 'bigfix',
      title: 'BIGFIX Assets',
      description:
        'Hardware assets managed through HCL BigFix, including Windows devices.',
      count: stats.bigFixCount,
      exportFilenamePrefix: 'BIGFIX_Assets',
      icon: WindowsLogoIcon,
      iconColor: 'text-[#0078d4]',
      iconBg: 'bg-sky-50 border-sky-200/60',
    },
    {
      id: 'jamf',
      title: 'JAMF Assets',
      description:
        'Hardware assets managed through Jamf, including Mac devices.',
      count: stats.jamfCount,
      exportFilenamePrefix: 'JAMF_Assets',
      icon: AppleLogoIcon,
      iconColor: 'text-slate-900',
      iconBg: 'bg-slate-100 border-slate-200/80',
    },
    {
      id: 'instock',
      title: 'IN STOCK Assets',
      description:
        'Unassigned laptops available in stockroom depots and ready for immediate deployment.',
      count: stats.inStockCount,
      exportFilenamePrefix: 'IN_STOCK_Assets',
      icon: PackageCheck,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 border-emerald-200/60',
    },
    {
      id: 'need-validation',
      title: 'NEED REVIEW Assets',
      description:
        'Assets requiring validation due to missing ownership details, unmatched Workday users, or incomplete inventory information.',
      count: stats.needValidationCount,
      exportFilenamePrefix: 'NEED_REVIEW_Assets',
      icon: ClipboardCheck,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 border-amber-200/60',
    },
    {
      id: 'warranty',
      title: 'EOL Compliance Assets',
      description:
        'Audit of assets with manufacturer warranty expired or expiring soon.',
      count: stats.totalWarrantyIssues,
      exportFilenamePrefix: 'EOL_Compliance_Assets',
      icon: ShieldAlert,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50 border-rose-200/60',
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadReportData}
            className="underline font-semibold hover:text-rose-950"
          >
            Retry
          </button>
        </div>
      )}

      {/* Six Report Cards Grid: Desktop 3 cols x 2 rows, Tablet 2 cols, Mobile 1 col */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
        {reportCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <div
              key={card.id}
              className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all duration-150 min-h-[220px]"
            >
              {/* Top row: Icon + Card title on the left, and total count on the right */}
              <div>
                <div className="flex items-start justify-between gap-3 min-h-[2.5rem]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg border shrink-0 flex items-center justify-center ${card.iconBg} ${card.iconColor}`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <h3
                      className="text-sm sm:text-base font-semibold text-slate-900 leading-snug"
                      title={card.title}
                    >
                      {card.title}
                    </h3>
                  </div>

                  {loading ? (
                    <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold font-mono bg-slate-100 text-slate-400 border border-slate-200/80 animate-pulse">
                      ...
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold font-mono bg-slate-100 text-slate-700 border border-slate-200/80">
                      {card.count.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Middle section: Short description with consistent line spacing and readable text */}
                <div className="my-3 min-h-[3.75rem] flex items-start">
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              {/* Bottom section: Distinct Excel green XLSX export button */}
              <div className="pt-4 border-t border-slate-100 mt-2">
                <button
                  onClick={() => handleExportCard(card.id, card.exportFilenamePrefix)}
                  disabled={exportingCardId === card.id || loading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold text-white bg-[#107c41] hover:bg-[#0d6535] active:bg-[#0a4f29] border border-[#0d6535] shadow-xs transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#107c41] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Export ${card.title} to XLSX`}
                >
                  {exportingCardId === card.id ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5 text-white/95" />
                      <span>Excel (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;