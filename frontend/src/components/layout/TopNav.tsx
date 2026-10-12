import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, RefreshCw, ToggleLeft, ToggleRight, Server } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface TopNavProps {
  onToggleMobileSidebar: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onToggleMobileSidebar }) => {
  const location = useLocation();
  const { mockMode, setMockMode, triggerDataRefresh, refreshHealth, health, apiBaseUrl } = useApp();

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return { breadcrumb: 'Overview', title: 'Dashboard' };
    if (path === '/assets') return { breadcrumb: 'Hardware Inventory', title: 'All Assets' };
    if (path === '/assets/windows') return { breadcrumb: 'Hardware Inventory', title: 'Windows Assets (BigFix)' };
    if (path === '/assets/mac') return { breadcrumb: 'Hardware Inventory', title: 'Mac Assets (Jamf)' };
    if (path === '/ownership') return { breadcrumb: 'Ownership & Identity', title: 'Asset Ownership' };
    if (path === '/eol-management' || path === '/eol') return { breadcrumb: 'Ownership & Identity', title: 'EOL Management' };
    if (path === '/admin-users') return { breadcrumb: 'Ownership & Identity', title: 'Admin Users' };
    if (path === '/reports') return { breadcrumb: 'Analytics', title: 'Reports' };
    if (path === '/users' || path === '/employees') return { breadcrumb: 'Identity', title: 'Users Management' };
    if (path === '/job-scheduler') return { breadcrumb: 'Automation', title: 'Job Scheduler' };
    if (path === '/audit-reports') return { breadcrumb: 'Compliance', title: 'Audit Reports' };
    if (path === '/settings' || path === '/admin') return { breadcrumb: 'System', title: 'Administration/Settings' };
    if (path === '/unassigned') return { breadcrumb: 'Hardware Inventory', title: 'Unassigned Assets' };
    if (path === '/exceptions') return { breadcrumb: 'Compliance', title: 'Exceptions & Flags' };
    return { breadcrumb: 'AssetIQ', title: 'Asset Governance Console' };
  };

  const { breadcrumb, title } = getPageInfo();

  const handleRefresh = async () => {
    triggerDataRefresh();
    await refreshHealth();
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 h-16 px-4 md:px-8 bg-white border-b border-slate-200 shadow-xs">
      {/* Zone 1: Breadcrumbs & Page Title */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <button
          onClick={onToggleMobileSidebar}
          className="p-1.5 text-slate-500 rounded-md hover:bg-slate-100 lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate font-medium">
            <span>{breadcrumb}</span>
          </div>
          <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight truncate">
            {title}
          </h1>
        </div>
      </div>

      {/* Zone 2: Mode Control & Backend Connection Status */}
      <div className="hidden sm:flex items-center gap-3">
        {/* Toggle between Mock Data and Live FastAPI */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span className="text-slate-600 font-medium">Data Source:</span>
          <button
            onClick={() => setMockMode(!mockMode)}
            className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
              mockMode ? 'text-amber-700 hover:text-amber-800' : 'text-blue-700 hover:text-blue-800'
            }`}
            title="Click to toggle between Mock Mode and Live FastAPI Backend"
          >
            {mockMode ? (
              <>
                <ToggleRight className="w-4 h-4 text-amber-600" />
                <span>Mock Mode (Preview)</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-blue-600" />
                <span>Live FastAPI</span>
              </>
            )}
          </button>
        </div>

        {/* Live URL badge */}
        {!mockMode && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-slate-600 font-mono bg-slate-100 rounded border border-slate-200">
            <Server className="w-3 h-3 text-slate-500" />
            <span className="truncate max-w-[150px]">{apiBaseUrl}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                health.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </div>
        )}
      </div>

      {/* Zone 3: 1 Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh Data</span>
          <span className="sm:hidden">Refresh</span>
        </button>
      </div>
    </header>
  );
};
