import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, RefreshCw, Maximize, Minimize } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import michaelsLogo from '../../assets/logo.svg';

interface TopNavProps {
  onToggleMobileSidebar: () => void;
}

const getFullscreenElement = (): Element | null => {
  if (typeof document === 'undefined') return null;
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement ||
    null
  );
};

export const TopNav: React.FC<TopNavProps> = ({ onToggleMobileSidebar }) => {
  const location = useLocation();
  const { triggerDataRefresh, refreshHealth } = useApp();

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return !!getFullscreenElement();
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!getFullscreenElement());
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (getFullscreenElement()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      } else {
        const docEl = (document.documentElement || document.body) as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request failed or was not allowed by browser/host:', err);
    }
  };

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return { breadcrumb: 'Overview', title: 'Dashboard' };
    if (path === '/assets') return { breadcrumb: 'HardwareInventory', title: 'All Assets' };
    if (path === '/assets/windows') return { breadcrumb: 'HardwareInventory', title: 'Windows Assets (BigFix)' };
    if (path === '/assets/mac') return { breadcrumb: 'HardwareInventory', title: 'Mac Assets (Jamf)' };
    if (path === '/ownership') return { breadcrumb: 'Ownership & Identity', title: 'Asset Ownership' };
    if (path === '/eol-management' || path === '/eol') return { breadcrumb: 'Ownership & Identity', title: 'EOL Management' };
    if (path === '/admin-users') return { breadcrumb: 'Ownership & Identity', title: 'Admin Users' };
    if (path === '/reports') return { breadcrumb: 'Analytics', title: 'Reports' };
    if (path === '/users' || path === '/employees') return { breadcrumb: 'Identity', title: 'Users Management' };
    if (path === '/job-scheduler') return { breadcrumb: 'Automation', title: 'Job Scheduler' };
    if (path === '/audit-reports' || path === '/audit-logs') return { breadcrumb: 'Compliance', title: 'Audit Logs' };
    if (path === '/settings' || path === '/admin') return { breadcrumb: 'System', title: 'Settings' };
    if (path === '/unassigned') return { breadcrumb: 'HardwareInventory', title: 'Unassigned Assets' };
    if (path === '/exceptions') return { breadcrumb: 'Compliance', title: 'Exceptions & Flags' };
    return { breadcrumb: 'AssetIQ', title: 'Asset Governance Console' };
  };

  const { breadcrumb, title } = getPageInfo();

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      triggerDataRefresh();
      await refreshHealth();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 h-14 px-4 sm:px-6 md:px-8 bg-white border-b border-[#DCE5F1] shadow-2xs relative">
      {/* Zone 1: Menu Toggle & Breadcrumbs / Page Title (Left) */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 max-w-[32%] sm:max-w-[38%] z-10">
        <button
          onClick={onToggleMobileSidebar}
          className="p-1.5 text-slate-700 hover:text-slate-900 rounded-md hover:bg-slate-100 shrink-0 cursor-pointer transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-slate-500 font-medium leading-none mb-1">
            {breadcrumb}
          </span>
          <h1 className="text-sm sm:text-base font-bold text-[#14213D] tracking-tight leading-none truncate">
            {title}
          </h1>
        </div>
      </div>

      {/* Zone 2: Centered Michaels Logo (Horizontally centered relative to the header width, slightly reduced size) */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10"
        aria-label="Michaels Logo"
      >
        <img
          src={michaelsLogo}
          alt="Michaels"
          className="h-5 sm:h-6 max-h-6.5 w-auto max-w-[100px] sm:max-w-[125px] md:max-w-[140px] object-contain select-none pointer-events-auto"
        />
      </div>

      {/* Zone 3: Top-Right actions (same Refresh Data button & Full Screen icon across all pages including Dashboard) */}
      <div className="flex items-center gap-2 shrink-0 z-10">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-xs cursor-pointer shrink-0 disabled:opacity-65"
          title="Refresh Data"
          aria-label="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className="inline-flex items-center justify-center h-[30px] w-[30px] text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
