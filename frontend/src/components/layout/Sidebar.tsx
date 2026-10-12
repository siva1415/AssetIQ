import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  HardDrive,
  Monitor,
  Laptop,
  UserCheck,
  Clock,
  ShieldAlert,
  FileBarChart,
  Users,
  RotateCw,
  FileCheck2,
  Settings,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile?: () => void;
}

type MenuItem =
  | {
      type: 'link';
      id: string;
      label: string;
      path: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  | {
      type: 'group';
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      children: {
        id: string;
        label: string;
        path: string;
        icon: React.ComponentType<{ className?: string }>;
      }[];
    };

// Single, authoritative navigation configuration
const NAV_ITEMS: MenuItem[] = [
  {
    type: 'link',
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    type: 'group',
    id: 'hardware-inventory',
    label: 'Hardware Inventory',
    icon: HardDrive,
    children: [
      { id: 'all-assets', label: 'All Assets', path: '/assets', icon: HardDrive },
      { id: 'windows-assets', label: 'Windows Assets (BigFix)', path: '/assets/windows', icon: Monitor },
      { id: 'mac-assets', label: 'Mac Assets (Jamf)', path: '/assets/mac', icon: Laptop },
    ],
  },
  {
    type: 'group',
    id: 'ownership-identity',
    label: 'Ownership & Identity',
    icon: UserCheck,
    children: [
      { id: 'asset-ownership', label: 'Asset Ownership', path: '/ownership', icon: UserCheck },
      { id: 'eol-management', label: 'EOL Management', path: '/eol-management', icon: Clock },
      { id: 'admin-users', label: 'Admin Users', path: '/admin-users', icon: ShieldAlert },
    ],
  },
  {
    type: 'link',
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: FileBarChart,
  },
  {
    type: 'link',
    id: 'users-management',
    label: 'Users Management',
    path: '/users',
    icon: Users,
  },
  {
    type: 'link',
    id: 'job-scheduler',
    label: 'Job Scheduler',
    path: '/job-scheduler',
    icon: RotateCw,
  },
  {
    type: 'link',
    id: 'audit-reports',
    label: 'Audit Reports',
    path: '/audit-reports',
    icon: FileCheck2,
  },
  {
    type: 'link',
    id: 'admin-settings',
    label: 'Administration/Settings',
    path: '/settings',
    icon: Settings,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  const { mockMode, health } = useApp();
  const location = useLocation();
  const currentPath = location.pathname;

  // Track expanded state for expandable groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'hardware-inventory': true,
    'ownership-identity': true,
  });

  // Automatically expand parent group when current route belongs to it
  useEffect(() => {
    NAV_ITEMS.forEach(item => {
      if (item.type === 'group') {
        const isChildActive = item.children.some(child => {
          if (child.path === '/eol-management') {
            return currentPath === '/eol-management' || currentPath === '/eol';
          }
          return currentPath === child.path || (child.path !== '/' && currentPath.startsWith(child.path + '/'));
        });

        if (isChildActive) {
          setExpandedGroups(prev => ({
            ...prev,
            [item.id]: true,
          }));
        }
      }
    });
  }, [currentPath]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isLinkActive = (path: string): boolean => {
    if (path === '/dashboard') {
      return currentPath === '/' || currentPath === '/dashboard';
    }
    if (path === '/eol-management') {
      return currentPath === '/eol-management' || currentPath === '/eol';
    }
    if (path === '/settings') {
      return currentPath === '/settings' || currentPath === '/admin';
    }
    if (path === '/users') {
      return currentPath === '/users' || currentPath === '/employees';
    }
    return currentPath === path;
  };

  const isGroupActive = (group: Extract<MenuItem, { type: 'group' }>): boolean => {
    return group.children.some(child => isLinkActive(child.path));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Main Dark Navy Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-[#0B132B] text-slate-200 border-r border-[#1C2541] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* AssetIQ Logo & Brand Header */}
        <div className="flex flex-col px-5 py-5 border-b border-[#1C2541] bg-[#080E21] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold tracking-tight text-white leading-none">
                AssetIQ
              </span>
              <span className="text-[11px] font-normal text-slate-400 mt-1 truncate">
                Asset Governance
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 tracking-wide uppercase font-medium">
            Intelligence &amp; Governance
          </p>
        </div>

        {/* Navigation Menu List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5" aria-label="Main Navigation">
          {NAV_ITEMS.map(item => {
            if (item.type === 'link') {
              const Icon = item.icon;
              const active = isLinkActive(item.path);

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={`group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    active
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-[#1C2541]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                </NavLink>
              );
            }

            // Group: Hardware Inventory / Ownership & Identity
            const GroupIcon = item.icon;
            const isExpanded = Boolean(expandedGroups[item.id]);
            const groupActive = isGroupActive(item);

            return (
              <div key={item.id} className="space-y-1">
                {/* Single Parent Menu Item Button */}
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    groupActive
                      ? 'text-white bg-[#1C2541]/90 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-[#1C2541]'
                  }`}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <GroupIcon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        groupActive ? 'text-blue-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </button>

                {/* Submenu items */}
                {isExpanded && (
                  <ul className="pl-4 space-y-0.5 border-l border-slate-700/50 ml-3">
                    {item.children.map(child => {
                      const ChildIcon = child.icon;
                      const childActive = isLinkActive(child.path);

                      return (
                        <li key={child.id}>
                          <NavLink
                            to={child.path}
                            onClick={onCloseMobile}
                            className={`group flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              childActive
                                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                                : 'text-slate-300 hover:text-white hover:bg-[#1C2541]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <ChildIcon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  childActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                                }`}
                              />
                              <span className="truncate">{child.label}</span>
                            </div>
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer info: Backend status and Mock indicator */}
        <div className="p-3 border-t border-[#1C2541] bg-[#080E21] text-xs shrink-0">
          <div className="p-2.5 rounded bg-[#1C2541]/70 border border-slate-700/50 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Backend Mode</span>
              <span
                className={`font-semibold ${
                  mockMode ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {mockMode ? 'Mock Preview' : 'FastAPI Live'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              {health.status === 'connected' || health.status === 'mock' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : health.status === 'checking' ? (
                <div className="w-3 h-3 rounded-full border border-blue-400 border-t-transparent animate-spin shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className="truncate text-slate-300">
                {mockMode
                  ? 'Mock API Ready'
                  : health.status === 'connected'
                  ? `Live (${health.latencyMs}ms)`
                  : health.status === 'checking'
                  ? 'Checking Live API...'
                  : 'FastAPI Offline'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
