import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import michaelsLogo from '../../assets/Logo.svg';

interface TopNavProps {
  onToggleMobileSidebar: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onToggleMobileSidebar }) => {
  const location = useLocation();
  const { triggerDataRefresh, refreshHealth } = useApp();

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return { breadcrumb: 'Overview', title: 'Dashboard' };
    if (path === '/assets') return { breadcrumb: 'Hardware Inventory', title: 'All Assets' };
    if (path === '/assets/windows') return { breadcrumb: 'Hardware Inventory', title: 'Windows Assets (BigFix)' };
    if (path === '/assets/mac') return { breadcrumb: 'Hardware Inventory', title: 'Mac Assets (Jamf)' };
    if (path === '/ownership') return { breadcrumb: 'Ownership Management', title: 'Asset Ownership' };
    if (path === '/eol-management' || path === '/eol') return { breadcrumb: 'Ownership Management', title: 'EOL Management' };
    if (path === '/admin-users') return { breadcrumb: 'Ownership Management', title: 'Admin Users' };
    if (path === '/reports') return { breadcrumb: 'Analytics', title: 'Reports' };
    if (path === '/users' || path === '/employees') return { breadcrumb: 'Identity', title: 'Users Management' };
    if (path === '/job-scheduler') return { breadcrumb: 'Automation', title: 'Job Scheduler' };
    if (path === '/audit-reports') return { breadcrumb: 'Compliance', title: 'Audit Reports' };
    if (path === '/settings' || path === '/admin') return { breadcrumb: 'System', title: 'Settings' };
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
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 h-16 px-4 md:px-8 bg-white border-b border-slate-200 shadow-xs relative">
      {/* Zone 1: Breadcrumbs & Page Title (Left) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 max-w-[35%] sm:max-w-[32%] md:max-w-[35%] z-10">
        <button
          onClick={onToggleMobileSidebar}
          className="p-1.5 text-slate-500 rounded-md hover:bg-slate-100 lg:hidden shrink-0"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 truncate font-medium">
            <span>{breadcrumb}</span>
          </div>
          <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-900 tracking-tight truncate">
            {title}
          </h1>
        </div>
      </div>

      {/* Zone 2: Michaels Customer Logo (Top-Center) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none px-2 max-w-[30%] sm:max-w-[35%] md:max-w-[38%]">
        <img
          src={michaelsLogo}
          alt="Michaels"
          className="h-[13px] sm:h-[21px] md:h-[24px] w-auto max-w-full object-contain pointer-events-auto"
        />
      </div>

      {/* Zone 3: Primary Action (Right) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-10">
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
