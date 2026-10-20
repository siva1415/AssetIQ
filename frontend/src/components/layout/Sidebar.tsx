import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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

interface FlyoutState {
  group: Extract<MenuItem, { type: 'group' }>;
  top: number;
  left: number;
}

const COLLAPSE_STORAGE_KEY = 'assetiq.sidebarCollapsed';

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
    label: 'Ownership Management',
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
    label: 'Settings',
    path: '/settings',
    icon: Settings,
  },
];

// Requirement: "The user icon should contains the frist two letter of the username example 'yeshwanth'->'YE','Sachin'->'SA'"
export const getUsernameAvatarInitials = (username?: string, name?: string): string => {
  const target = (username || name || 'US').trim().replace(/^@/, '');
  if (target.length >= 2) {
    return target.slice(0, 2).toUpperCase();
  }
  return (target + 'X').slice(0, 2).toUpperCase();
};

// Role-based avatar gradient (shared by expanded + collapsed profile)
const getAvatarRoleClasses = (role?: string): string => {
  if (role === 'super_admin') {
    return 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white border-purple-400/40';
  }
  if (role === 'viewer') {
    return 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white border-emerald-400/40';
  }
  return 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white border-blue-400/40';
};

const getRoleLabel = (role?: string): string => {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'viewer') return 'Viewer';
  return 'Admin';
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  // The collapse props are optional so this works whether or not AppContext provides them.
  const ctx = useApp() as ReturnType<typeof useApp> & {
    sidebarCollapsed?: boolean;
    toggleSidebarCollapse?: () => void;
  };
  const { currentUser, isSuperAdmin, isAdmin, isViewer, logout } = ctx;

  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  // Collapse state: prefer AppContext when it provides it, otherwise keep it locally (persisted).
  const contextHasCollapse =
    typeof ctx.sidebarCollapsed === 'boolean' && typeof ctx.toggleSidebarCollapse === 'function';

  const [localCollapsed, setLocalCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleLocalCollapse = useCallback(() => {
    setLocalCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }, []);

  const sidebarCollapsed: boolean = contextHasCollapse ? Boolean(ctx.sidebarCollapsed) : localCollapsed;
  const toggleSidebarCollapse: () => void = contextHasCollapse
    ? (ctx.toggleSidebarCollapse as () => void)
    : toggleLocalCollapse;

  // Expose the current sidebar width as a CSS variable so the page layout can follow it:
  //   className="lg:pl-[var(--sidebar-width)] transition-all duration-300"
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', sidebarCollapsed ? '68px' : '16rem');
  }, [sidebarCollapsed]);

  // Filter NAV_ITEMS strictly by role:
  // 1. Super Admin: complete access to all pages
  // 2. Admin: hide (audit reports, settings, job scheduler, users management)
  // 3. Viewers: only (dashboard, hardware inventory, reports) pages
  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (isSuperAdmin) return true;

    if (isViewer) {
      return (
        item.id === 'dashboard' ||
        item.id === 'hardware-inventory' ||
        item.id === 'reports'
      );
    }

    if (isAdmin) {
      // Hide audit reports, settings, job scheduler and users management for admin
      return (
        item.id !== 'audit-reports' &&
        item.id !== 'admin-settings' &&
        item.id !== 'job-scheduler' &&
        item.id !== 'users-management'
      );
    }

    return false;
  });

  const avatarInitials = getUsernameAvatarInitials(currentUser.username, currentUser.name);
  const avatarRoleClasses = getAvatarRoleClasses(currentUser.role);
  const roleLabel = getRoleLabel(currentUser.role);
  const displayName = currentUser.name || currentUser.username || 'Console User';

  const handleLogout = () => {
    if (onCloseMobile) onCloseMobile();
    logout();
    navigate('/login', { replace: true });
  };

  // Track expanded state for expandable groups in expanded mode
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'hardware-inventory': true,
    'ownership-identity': true,
  });

  // Flyout popover state for collapsed mode
  const [activeFlyout, setActiveFlyout] = useState<FlyoutState | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Close flyout on path change
  useEffect(() => {
    setActiveFlyout(null);
  }, [currentPath]);

  // Close flyout when sidebar expands
  useEffect(() => {
    if (!sidebarCollapsed) {
      setActiveFlyout(null);
    }
  }, [sidebarCollapsed]);

  // Handle outside click and Escape key to close flyout
  useEffect(() => {
    if (!activeFlyout) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveFlyout(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        !Object.values(groupButtonRefs.current).some(btn => btn?.contains(target))
      ) {
        setActiveFlyout(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeFlyout]);

  // Automatically expand parent group in expanded mode when current route belongs to it
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

  // Handle clicking parent group in collapsed mode
  const handleGroupIconClick = (
    group: Extract<MenuItem, { type: 'group' }>,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    if (activeFlyout?.group.id === group.id) {
      setActiveFlyout(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const approxHeight = 44 + group.children.length * 40;
    const maxTop = window.innerHeight - approxHeight - 16;
    const clampedTop = Math.max(16, Math.min(rect.top, maxTop));
    const left = rect.right + 10;

    setActiveFlyout({
      group,
      top: clampedTop,
      left,
    });
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
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0B132B] text-slate-200 border-r border-[#1C2541] transition-all duration-300 ease-in-out lg:translate-x-0 overflow-x-hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-[68px] w-64' : 'w-64'}`}
      >
        {/* AssetIQ Logo & Brand Header */}
        {sidebarCollapsed ? (
          /* Collapsed Header */
          <div className="flex flex-col items-center justify-center py-3.5 px-2 border-b border-[#1C2541] bg-[#080E21] shrink-0 gap-2">
            <div
              className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0"
              title="AssetIQ - Intelligence & Governance"
            >
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1C2541] transition-colors cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4 text-blue-400" />
            </button>
          </div>
        ) : (
          /* Expanded Header */
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#1C2541] bg-[#080E21] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-base font-bold tracking-tight text-white leading-none">
                  AssetIQ
                </span>
                <span className="text-[11px] font-normal text-slate-400 mt-1 truncate">
                  Intelligence &amp; Governance
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1C2541] transition-colors cursor-pointer shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Menu List */}
        <nav
          className={`flex-1 overflow-y-auto ${
            sidebarCollapsed ? 'px-2 py-3 space-y-2' : 'px-3 py-4 space-y-1.5'
          }`}
          aria-label="Main Navigation"
        >
          {visibleNavItems.map(item => {
            if (item.type === 'link') {
              const Icon = item.icon;
              const active = isLinkActive(item.path);

              if (sidebarCollapsed) {
                // Collapsed link icon button
                return (
                  <div key={item.id} className="flex justify-center">
                    <NavLink
                      to={item.path}
                      onClick={() => {
                        setActiveFlyout(null);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      title={item.label}
                      aria-label={item.label}
                      className={`group w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                        active
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-[#1C2541]'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                    </NavLink>
                  </div>
                );
              }

              // Expanded link item
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

            // Group: Hardware Inventory / Ownership Management
            const GroupIcon = item.icon;
            const isExpanded = Boolean(expandedGroups[item.id]);
            const groupActive = isGroupActive(item);
            const isFlyoutOpen = activeFlyout?.group.id === item.id;

            if (sidebarCollapsed) {
              // Collapsed group icon button
              return (
                <div key={item.id} className="flex justify-center">
                  <button
                    ref={el => {
                      groupButtonRefs.current[item.id] = el;
                    }}
                    type="button"
                    onClick={e => handleGroupIconClick(item, e)}
                    title={`${item.label} (Click to open submenu)`}
                    aria-label={item.label}
                    aria-haspopup="true"
                    aria-expanded={isFlyoutOpen}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative cursor-pointer ${
                      isFlyoutOpen
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-xs'
                        : groupActive
                        ? 'bg-blue-600/25 text-blue-400 ring-1 ring-blue-500/50'
                        : 'text-slate-400 hover:text-white hover:bg-[#1C2541]'
                    }`}
                  >
                    <GroupIcon
                      className={`w-5 h-5 shrink-0 ${
                        isFlyoutOpen
                          ? 'text-white'
                          : groupActive
                          ? 'text-blue-400'
                          : 'text-slate-400'
                      }`}
                    />
                    {/* Active indicator dot if a child route is active */}
                    {groupActive && !isFlyoutOpen && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[#0B132B]" />
                    )}
                  </button>
                </div>
              );
            }

            // Expanded group item
            return (
              <div key={item.id} className="space-y-1">
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

        {/* Logged-in User Profile Section (Left bottom user profile) */}
        {sidebarCollapsed ? (
          /* Collapsed User Profile */
          <div className="p-2.5 border-t border-[#1C2541] bg-[#080E21] shrink-0 flex flex-col items-center gap-2">
            {/* User icon containing first two letters of username (e.g. yeshwanth -> YE, Sachin -> SA) */}
            <div
              className={`w-8 h-8 rounded-full font-bold text-[11px] flex items-center justify-center shrink-0 shadow-sm border select-none tracking-wider ${avatarRoleClasses}`}
              title={`${displayName} (${roleLabel})${currentUser.username ? ` - @${currentUser.username}` : ''}`}
              aria-label={`User avatar ${avatarInitials}`}
            >
              {avatarInitials}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Expanded User Profile */
          <div className="p-3 border-t border-[#1C2541] bg-[#080E21] shrink-0">
            <div className="p-2.5 rounded-lg bg-[#1C2541]/50 border border-slate-700/40 flex items-center gap-3">
              {/* User icon containing first two letters of username (e.g. yeshwanth -> YE, Sachin -> SA) */}
              <div
                className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-sm border select-none tracking-wider ${avatarRoleClasses}`}
                title={`@${currentUser.username || 'user'}`}
                aria-label={`User avatar ${avatarInitials}`}
              >
                {avatarInitials}
              </div>

              {/* User Name & Role */}
              <div className="flex flex-col min-w-0 flex-1">
                <span
                  className="text-xs font-semibold text-white truncate leading-tight"
                  title={currentUser.name || currentUser.username}
                >
                  {displayName}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded ${
                      currentUser.role === 'super_admin'
                        ? 'bg-purple-900/60 text-purple-300 border border-purple-500/30'
                        : currentUser.role === 'viewer'
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
                        : 'bg-blue-900/60 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {roleLabel}
                  </span>
                  {currentUser.username && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[70px]">
                      @{currentUser.username}
                    </span>
                  )}
                </div>
              </div>

              {/* Logout Action Icon */}
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Submenu Popover / Flyout for Collapsed Mode (rendered via Portal to avoid clipping) */}
      {sidebarCollapsed &&
        activeFlyout &&
        createPortal(
          <div
            ref={flyoutRef}
            style={{
              position: 'fixed',
              top: `${activeFlyout.top}px`,
              left: `${activeFlyout.left}px`,
              zIndex: 100,
            }}
            className="w-60 bg-[#0B132B] text-slate-200 border border-[#1C2541] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="menu"
            aria-orientation="vertical"
            aria-label={`${activeFlyout.group.label} submenu`}
          >
            {/* Flyout Header */}
            <div className="px-3.5 py-2.5 border-b border-[#1C2541] bg-[#080E21] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <activeFlyout.group.icon className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-white tracking-wide truncate">
                  {activeFlyout.group.label}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-[#1C2541] shrink-0">
                {activeFlyout.group.children.length}
              </span>
            </div>

            {/* Flyout Submenu Children */}
            <div className="p-1.5 space-y-1">
              {activeFlyout.group.children.map(child => {
                const ChildIcon = child.icon;
                const childActive = isLinkActive(child.path);

                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => {
                      navigate(child.path);
                      setActiveFlyout(null);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer text-left ${
                      childActive
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-[#1C2541]'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChildIcon
                        className={`w-4 h-4 shrink-0 ${
                          childActive ? 'text-white' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{child.label}</span>
                    </div>
                    {childActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};