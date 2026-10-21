import React from 'react';
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
} from 'lucide-react';
import { PortalRole } from '../types';

export type MenuId =
  | 'dashboard'
  | 'hardware-inventory'
  | 'ownership-identity'
  | 'reports'
  | 'user-management'
  | 'job-scheduler'
  | 'audit-reports'
  | 'admin-settings';

export interface BaseMenuItem {
  id: MenuId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: PortalRole[];
}

export interface LinkMenuItem extends BaseMenuItem {
  type: 'link';
  path: string;
  matchPaths?: string[];
}

export interface GroupMenuItem extends BaseMenuItem {
  type: 'group';
  children: {
    id: string;
    label: string;
    path: string;
    matchPaths?: string[];
    icon: React.ComponentType<{ className?: string }>;
    allowedRoles?: PortalRole[];
  }[];
}

export type AppMenuItem = LinkMenuItem | GroupMenuItem;

/**
 * Authoritative role-to-menu mapping as specified in RBAC specification:
 * 
 * SUPERADMIN:
 * - Dashboard
 * - Hardware Inventory
 * - Ownership Management
 * - Reports
 * - User Management
 * - Job Scheduler
 * - Audit Logs
 * - Settings
 * 
 * ADMIN:
 * - Dashboard
 * - Hardware Inventory
 * - Ownership Management
 * - Reports
 * - User Management
 * 
 * VIEWER:
 * - Dashboard
 * - Hardware Inventory
 * - Reports
 */
export const ROLE_MENU_CONFIG: Record<PortalRole, string[]> = {
  SUPERADMIN: [
    'dashboard',
    'hardware-inventory',
    'ownership-identity',
    'reports',
    'user-management',
    'job-scheduler',
    'audit-reports',
    'admin-settings',
  ],
  ADMIN: [
    'dashboard',
    'hardware-inventory',
    'ownership-identity',
    'reports',
    'user-management',
  ],
  VIEWER: [
    'dashboard',
    'hardware-inventory',
    'reports',
  ],
};

export const MENU_ITEMS: AppMenuItem[] = [
  {
    type: 'link',
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    matchPaths: ['/', '/dashboard'],
    icon: LayoutDashboard,
    allowedRoles: ['SUPERADMIN', 'ADMIN', 'VIEWER'],
  },
  {
    type: 'group',
    id: 'hardware-inventory',
    label: 'Hardware Inventory',
    icon: HardDrive,
    allowedRoles: ['SUPERADMIN', 'ADMIN', 'VIEWER'],
    children: [
      { id: 'all-assets', label: 'All Assets', path: '/assets', matchPaths: ['/assets'], icon: HardDrive },
      { id: 'windows-assets', label: 'Windows Assets (BigFix)', path: '/assets/windows', matchPaths: ['/assets/windows'], icon: Monitor },
      { id: 'mac-assets', label: 'Mac Assets (Jamf)', path: '/assets/mac', matchPaths: ['/assets/mac'], icon: Laptop },
    ],
  },
  {
    type: 'group',
    id: 'ownership-identity',
    label: 'Ownership Management',
    icon: UserCheck,
    allowedRoles: ['SUPERADMIN', 'ADMIN'],
    children: [
      { id: 'asset-ownership', label: 'Asset Ownership', path: '/ownership', matchPaths: ['/ownership'], icon: UserCheck },
      { id: 'eol-management', label: 'EOL Management', path: '/eol-management', matchPaths: ['/eol-management', '/eol'], icon: Clock },
      { id: 'admin-users', label: 'Admin Users', path: '/admin-users', matchPaths: ['/admin-users'], icon: ShieldAlert },
    ],
  },
  {
    type: 'link',
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    matchPaths: ['/reports'],
    icon: FileBarChart,
    allowedRoles: ['SUPERADMIN', 'ADMIN', 'VIEWER'],
  },
  {
    type: 'link',
    id: 'user-management',
    label: 'User Management',
    path: '/users',
    matchPaths: ['/users', '/employees'],
    icon: Users,
    allowedRoles: ['SUPERADMIN', 'ADMIN'],
  },
  {
    type: 'link',
    id: 'job-scheduler',
    label: 'Job Scheduler',
    path: '/job-scheduler',
    matchPaths: ['/job-scheduler'],
    icon: RotateCw,
    allowedRoles: ['SUPERADMIN'],
  },
  {
    type: 'link',
    id: 'audit-reports',
    label: 'Audit Logs',
    path: '/audit-reports',
    matchPaths: ['/audit-reports', '/audit-logs'],
    icon: FileCheck2,
    allowedRoles: ['SUPERADMIN'],
  },
  {
    type: 'link',
    id: 'admin-settings',
    label: 'Settings',
    path: '/settings',
    matchPaths: ['/settings', '/admin'],
    icon: Settings,
    allowedRoles: ['SUPERADMIN'],
  },
];

/**
 * Normalizes any role string to standard uppercase PortalRole.
 * Defaults to 'VIEWER' if unknown or invalid to ensure least-privilege security.
 */
export function normalizeRole(roleRaw?: string | null): PortalRole {
  if (!roleRaw) return 'VIEWER';
  const clean = roleRaw.trim().toUpperCase();
  if (clean === 'SUPERADMIN' || clean === 'SUPER_ADMIN') return 'SUPERADMIN';
  if (clean === 'ADMIN') return 'ADMIN';
  if (clean === 'VIEWER') return 'VIEWER';
  return 'VIEWER';
}

/**
 * Returns whether a menu is visible for a given role.
 */
export function isMenuVisibleForRole(menuId: string, role?: string | null): boolean {
  const normRole = normalizeRole(role);
  const allowedMenuIds = ROLE_MENU_CONFIG[normRole] || [];
  return allowedMenuIds.includes(menuId);
}

/**
 * Checks if a specific pathname is authorized for a given role.
 */
export function isRouteAllowedForRole(pathname: string, role?: string | null): boolean {
  const normRole = normalizeRole(role);
  const normalizedPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';

  // Public/always allowed for authenticated users
  if (normalizedPath === '' || normalizedPath === '/' || normalizedPath === '/dashboard') {
    return true;
  }
  if (normalizedPath === '/login' || normalizedPath === '/reset-password' || normalizedPath === '/force-password-reset') {
    return true;
  }

  // Hardware inventory routes (accessible to ALL authenticated roles)
  if (
    normalizedPath === '/assets' ||
    normalizedPath === '/assets/windows' ||
    normalizedPath === '/assets/mac'
  ) {
    return true;
  }

  // Reports route (accessible to ALL authenticated roles)
  if (normalizedPath === '/reports') {
    return true;
  }

  // Ownership Management routes (SUPERADMIN and ADMIN only, blocked for VIEWER)
  if (
    normalizedPath === '/ownership' ||
    normalizedPath === '/eol-management' ||
    normalizedPath === '/eol' ||
    normalizedPath === '/admin-users' ||
    normalizedPath === '/unassigned' ||
    normalizedPath === '/exceptions'
  ) {
    return normRole === 'SUPERADMIN' || normRole === 'ADMIN';
  }

  // User Management routes (SUPERADMIN and ADMIN only, blocked for VIEWER)
  if (normalizedPath === '/users' || normalizedPath === '/employees') {
    return normRole === 'SUPERADMIN' || normRole === 'ADMIN';
  }

  // Job Scheduler (SUPERADMIN only)
  if (normalizedPath === '/job-scheduler') {
    return normRole === 'SUPERADMIN';
  }

  // Audit Logs (SUPERADMIN only)
  if (normalizedPath === '/audit-reports' || normalizedPath === '/audit-logs') {
    return normRole === 'SUPERADMIN';
  }

  // Settings (SUPERADMIN only)
  if (normalizedPath === '/settings' || normalizedPath === '/admin') {
    return normRole === 'SUPERADMIN';
  }

  // Any other routes default to allowing SUPERADMIN/ADMIN, but restrict VIEWER
  return normRole === 'SUPERADMIN';
}
