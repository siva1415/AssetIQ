import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { DashboardRedesignOverview, HardwareAnalysisResponse } from '../types';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';
import {
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Package,
  Users,
  RefreshCw,
} from 'lucide-react';
import './DashboardPage.css';

export const SOURCE_COLORS: Record<string, string> = {
  BIGFIX: '#4169E1', // Royal Blue
  BigFix: '#4169E1',
  bigfix: '#4169E1',
  JAMF: '#C2185B',   // Dark Pink
  Jamf: '#C2185B',
  jamf: '#C2185B',
};

export function getSourceColor(source: string): string {
  const normalized = (source || '').trim().toUpperCase();
  if (normalized === 'BIGFIX') return '#4169E1';
  if (normalized === 'JAMF') return '#C2185B';
  return SOURCE_COLORS[normalized] || '#4169E1';
}

export const EOL_COLORS: Record<string, string> = {
  ACTIVE: '#22C55E',      // Green (≥90 days)
  'EOL SOON': '#F97316',  // Orange (≤90 days)
  EXPIRED: '#EF4444',     // Red
  UNKNOWN: '#9CA3AF',     // Grey
};

export function getEolColor(status: string): string {
  const s = (status || '').trim().toUpperCase();
  if (s === 'ACTIVE' || s.startsWith('ACTIVE')) return '#22C55E';
  if (s === 'EOL SOON' || s === 'EOL_SOON' || s.includes('SOON')) return '#F97316';
  if (s === 'EXPIRED') return '#EF4444';
  if (s === 'UNKNOWN') return '#9CA3AF';
  return EOL_COLORS[s] || '#9CA3AF';
}

export interface ChartItem {
  name: string;
  count: number;
}

/**
 * Transforms category-to-count map into a sorted ChartItem array.
 * Validates numeric values, excludes null, empty, whitespace-only labels,
 * negative/zero counts, and missing/unknown values.
 * Preserves distinct categories returned by the API.
 */
export function parseCategoryMap(
  dataMap: unknown,
  options?: { filterUnknown?: boolean }
): ChartItem[] {
  if (!dataMap || typeof dataMap !== 'object' || Array.isArray(dataMap)) {
    return [];
  }

  const items: ChartItem[] = [];
  for (const [key, val] of Object.entries(dataMap as Record<string, unknown>)) {
    if (key === null || key === undefined) continue;
    const name = String(key).trim();
    if (!name || name === '—' || name === '-') continue;

    const lower = name.toLowerCase();
    if (
      lower === 'null' ||
      lower === 'undefined' ||
      lower === 'n/a' ||
      lower === 'none' ||
      lower === '""'
    ) {
      continue;
    }
    if (options?.filterUnknown && lower === 'unknown') {
      continue;
    }

    const count = typeof val === 'number' ? val : Number(val);
    if (isNaN(count) || count <= 0 || !isFinite(count)) {
      continue;
    }

    items.push({
      name,
      count: Math.round(count),
    });
  }

  return items.sort((a, b) => b.count - a.count);
}

export const OS_PALETTE: string[] = [
  '#4169E1', // Royal Blue
  '#8b5cf6', // Vivid Purple
  '#0d9488', // Teal
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#7c3aed', // Deep Violet
  '#f43f5e', // Rose
  '#4f46e5', // Indigo
  '#0284c7', // Sky Blue
  '#ea580c', // Tangerine
  '#14b8a6', // Bright Teal
  '#d946ef', // Fuchsia
];

export const KNOWN_OS_COLORS: Record<string, string> = {
  // Windows: royal blue, sky blue, vivid blue
  'Windows 11 Pro': '#4169E1',
  'Windows 10 Enterprise': '#0284c7',
  'Windows 11 Enterprise': '#0ea5e9',
  'Windows 10 Professional': '#3b82f6',
  'Windows 11 Professional': '#4169E1',
  'Windows 11': '#4169E1',
  'Windows 10': '#0284c7',
  Windows: '#4169E1',

  // macOS / Mac: vibrant purple / violet
  macOS: '#8b5cf6',
  Mac: '#8b5cf6',
  'macOS Sequoia': '#7c3aed',
  'macOS Sonoma': '#8b5cf6',
  'macOS Ventura': '#a855f7',
  'macOS Monterey': '#6366f1',

  // Red Hat / RHEL: vivid red
  'Red Hat': '#ef4444',
  RHEL: '#ef4444',
  'RED HAT ENTERPRISE LINUX': '#ef4444',
  'Red Hat Enterprise Linux': '#ef4444',

  // Linux / Ubuntu: vivid orange / tangerine / pink / yellow / teal
  Ubuntu: '#f97316',
  Linux: '#ea580c',
  'Debian GNU/Linux': '#ec4899',
  Debian: '#ec4899',
  AIX: '#eab308',
  'VMware ESXi': '#0d9488',
};

const OS_COLOR_CACHE = new Map<string, string>();

/**
 * Formats OS names for display according to short-form mapping rules:
 * - "RED HAT ENTERPRISE LINUX" / "Red Hat Enterprise Linux" -> "RHEL"
 * - "Red Hat Enterprise Linux 8.10 (Ootpa)" -> "RHEL 8.10 (Ootpa)"
 * - "RED HAT ENTERPRISE LINUX 9.8 (PLOW)" -> "RHEL 9.8 (PLOW)"
 * - "macOS" -> "Mac"
 * - "macOS 27.0.1" -> "Mac 27.0.1"
 * - "Windows" remains "Windows", "Windows 11 Professional" remains "Windows 11 Professional"
 * - Unrelated names (Debian GNU/Linux, Ubuntu, AIX, RHEL) remain unchanged.
 */
export function formatOsDisplayName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();

  // Red Hat Enterprise Linux prefix replacement (case-insensitive)
  const rhelRegex = /^red\s+hat\s+enterprise\s+linux(\b|$)/i;
  if (rhelRegex.test(trimmed)) {
    return trimmed.replace(rhelRegex, 'RHEL');
  }

  // macOS prefix replacement (case-insensitive)
  const macRegex = /^macos(\b|$)/i;
  if (macRegex.test(trimmed)) {
    return trimmed.replace(macRegex, 'Mac');
  }

  return trimmed;
}

export function getOsColor(name: string, index: number): string {
  const trimmed = (name || '').trim();
  if (OS_COLOR_CACHE.has(trimmed)) {
    return OS_COLOR_CACHE.get(trimmed)!;
  }
  if (KNOWN_OS_COLORS[trimmed]) {
    const c = KNOWN_OS_COLORS[trimmed];
    OS_COLOR_CACHE.set(trimmed, c);
    return c;
  }
  const mapped = formatOsDisplayName(trimmed);
  if (KNOWN_OS_COLORS[mapped]) {
    const c = KNOWN_OS_COLORS[mapped];
    OS_COLOR_CACHE.set(trimmed, c);
    return c;
  }

  const color = OS_PALETTE[index % OS_PALETTE.length];
  OS_COLOR_CACHE.set(trimmed, color);
  return color;
}

const KNOWN_ACRONYMS = new Set([
  'IT',
  'HR',
  'QA',
  'R&D',
  'BI',
  'PMO',
  'SOC',
  'NOC',
  'SRE',
  'AI',
  'ML',
  'UI',
  'UX',
  'ERP',
  'CRM',
]);

/**
 * Converts department names that are entirely uppercase into readable title-style capitalization,
 * preserving meaningful acronyms (e.g. IT, HR, QA, R&D).
 * Leaves already mixed-case department names intact.
 * Examples:
 * - "INFORMATION TECHNOLOGY" -> "Information Technology"
 * - "HUMAN RESOURCES" -> "Human Resources"
 * - "FINANCE AND ACCOUNTING" -> "Finance And Accounting"
 * - "OPERATIONS" -> "Operations"
 */
export function formatDepartmentDisplayName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  const hasLetters = /[a-zA-Z]/.test(trimmed);
  const isAllUpper = hasLetters && trimmed === trimmed.toUpperCase();

  if (!isAllUpper) {
    return trimmed;
  }

  return trimmed
    .split(/\s+/)
    .map((token) => {
      if (token.includes('/') || token.includes('-')) {
        return token
          .split(/([/-])/)
          .map((sub) => {
            if (sub === '/' || sub === '-') return sub;
            const clean = sub.replace(/[^a-zA-Z0-9&]/g, '').toUpperCase();
            if (KNOWN_ACRONYMS.has(clean)) return sub.toUpperCase();
            if (sub.length <= 1) return sub.toUpperCase();
            return sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase();
          })
          .join('');
      }
      const clean = token.replace(/[^a-zA-Z0-9&]/g, '').toUpperCase();
      if (KNOWN_ACRONYMS.has(clean)) {
        return token.toUpperCase();
      }
      if (token.length <= 1) {
        return token.toUpperCase();
      }
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(' ');
}

export const DEVICE_TYPE_COLORS: Record<string, string> = {
  Laptop: '#4F46E5',    // Vivid Indigo
  Desktop: '#0D9488',   // Bright Teal
  Server: '#EA580C',    // Vibrant Orange
  Tablet: '#8B5CF6',    // Vivid Purple
  Mobile: '#EC4899',    // Vivid Pink
  Virtual: '#06B6D4',   // Cyan
  Network: '#7C3AED',   // Deep Violet
  Other: '#64748B',     // Slate
};

export const DEVICE_TYPE_PALETTE: string[] = [
  '#4F46E5', // Indigo
  '#0D9488', // Teal
  '#EA580C', // Orange
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EAB308', // Yellow
  '#10B981', // Emerald
  '#7C3AED', // Violet
  '#F43F5E', // Rose
];

const DEVICE_COLOR_CACHE = new Map<string, string>();

export function getDeviceTypeColor(name: string, index: number): string {
  const trimmed = (name || '').trim();
  if (DEVICE_COLOR_CACHE.has(trimmed)) {
    return DEVICE_COLOR_CACHE.get(trimmed)!;
  }

  // Exact match
  if (DEVICE_TYPE_COLORS[trimmed]) {
    const c = DEVICE_TYPE_COLORS[trimmed];
    DEVICE_COLOR_CACHE.set(trimmed, c);
    return c;
  }

  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(DEVICE_TYPE_COLORS)) {
    if (key.toLowerCase() === lower) {
      DEVICE_COLOR_CACHE.set(trimmed, val);
      return val;
    }
  }

  // Substring/category matching
  if (lower.includes('laptop') || lower.includes('notebook')) {
    const c = DEVICE_TYPE_COLORS.Laptop;
    DEVICE_COLOR_CACHE.set(trimmed, c);
    return c;
  }
  if (lower.includes('desktop') || lower.includes('workstation')) {
    const c = DEVICE_TYPE_COLORS.Desktop;
    DEVICE_COLOR_CACHE.set(trimmed, c);
    return c;
  }
  if (lower.includes('server')) {
    const c = DEVICE_TYPE_COLORS.Server;
    DEVICE_COLOR_CACHE.set(trimmed, c);
    return c;
  }
  if (lower.includes('tablet') || lower.includes('ipad')) {
    const c = DEVICE_TYPE_COLORS.Tablet;
    DEVICE_COLOR_CACHE.set(trimmed, c);
    return c;
  }
  if (lower.includes('phone') || lower.includes('mobile')) {
    const c = DEVICE_TYPE_COLORS.Mobile;
    DEVICE_COLOR_CACHE.set(trimmed, c);
    return c;
  }

  const color = DEVICE_TYPE_PALETTE[index % DEVICE_TYPE_PALETTE.length];
  DEVICE_COLOR_CACHE.set(trimmed, color);
  return color;
}

/**
 * Tasteful, production-grade enterprise palette for Top 10 Departments:
 * Coordinated set of professional colors (blue, teal, indigo, violet, muted green)
 * Visually distinguishable, balanced contrast, restrained saturation, non-status-implying.
 */
export const DEPARTMENT_PALETTE: string[] = [
  '#4f46e5', // Indigo
  '#0d9488', // Teal
  '#2563eb', // Royal Blue
  '#7c3aed', // Violet
  '#059669', // Muted Emerald Green
  '#0284c7', // Sky Blue
  '#6366f1', // Slate Indigo
  '#0891b2', // Cyan Slate
  '#8b5cf6', // Soft Violet
  '#0f766e', // Deep Teal
];

export const KNOWN_DEPARTMENT_COLORS: Record<string, string> = {
  Engineering: '#4f46e5',
  Sales: '#0d9488',
  Marketing: '#2563eb',
  Operations: '#7c3aed',
  Finance: '#059669',
  Support: '#0284c7',
  Product: '#6366f1',
  'Human Resources': '#0891b2',
  HR: '#0891b2',
  IT: '#0f766e',
  Legal: '#8b5cf6',
};

const DEPARTMENT_COLOR_CACHE = new Map<string, string>();

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Consistent percentage formatting for dashboard charts & legends:
 * - Displays with one decimal place when the percentage is fractional (e.g. 12.5%, 8.3%, 0.4%)
 * - Displays whole numbers without unnecessary decimal places (e.g. 25%, 100%)
 * - Small non-zero percentages are never displayed as 0% (e.g. displays 0.4% or 0.1% instead of 0%)
 * - Avoids floating point precision errors
 */
export function formatChartPercentage(count: number, total: number): string {
  if (!total || total <= 0 || !count || count <= 0) {
    return '0%';
  }
  const rawPct = (count / total) * 100;
  // If non-zero but rounds to 0.0 at 1 decimal place, display '0.1%' so it is never 0%
  if (rawPct > 0 && rawPct < 0.05) {
    return '0.1%';
  }
  const rounded = Math.round(rawPct * 10) / 10;
  if (rounded % 1 === 0) {
    return `${Math.round(rounded)}%`;
  }
  return `${rounded.toFixed(1)}%`;
}

/**
 * Shared tooltip style for Recharts ensuring 100% white (#FFFFFF) hover text
 * across all titles, labels, values, and list items.
 */
export const DASHBOARD_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    color: '#ffffff',
    fontSize: '12px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    padding: '8px 12px',
  },
  itemStyle: {
    color: '#ffffff',
    fontSize: '12px',
  },
  labelStyle: {
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '4px',
  },
};

const labelForSource = (source: string) => {
  const s = (source || '').toUpperCase();
  if (s === 'BIGFIX') return 'BigFix';
  if (s === 'JAMF') return 'Jamf';
  return source;
};

const formatEolStatusLabel = (status: string) => {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') return 'Active (> 90 days)';
  if (s === 'EOL SOON') return 'EOL soon (< 90 days)';
  if (s === 'EXPIRED') return 'Expired';
  if (s === 'UNKNOWN') return 'Unknown';
  return status;
};

/**
 * Normalizes raw OS strings into clean, distinct categories for chart readability.
 * Excludes NULL, empty strings, and whitespace.
 */
export function normalizeOperatingSystemCategory(rawOs: any): string | null {
  if (!rawOs) return null;
  const s = String(rawOs).trim();
  if (
    !s ||
    s === '—' ||
    s === '-' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase() === 'unknown' ||
    s.toLowerCase() === 'n/a' ||
    s.toLowerCase() === 'none'
  ) {
    return null;
  }
  const lower = s.toLowerCase();
  if (lower.startsWith('windows') || lower.includes('win')) return 'Windows';
  if (lower.includes('macos') || lower.includes('mac os') || lower.includes('os x')) return 'macOS';
  if (
    lower.includes('red hat') ||
    lower.includes('ubuntu') ||
    lower.includes('linux') ||
    lower.includes('centos') ||
    lower.includes('debian') ||
    lower.includes('suse')
  ) {
    return 'Linux';
  }
  if (lower.includes('vmware') || lower.includes('esxi')) return 'VMware ESXi';
  return s;
}

/**
 * Normalizes raw device type strings into standardized capitalized forms.
 * Excludes NULL, empty strings, and whitespace.
 */
export function normalizeDeviceTypeCategory(rawDt: any): string | null {
  if (!rawDt) return null;
  const s = String(rawDt).trim();
  if (
    !s ||
    s === '—' ||
    s === '-' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase() === 'unknown' ||
    s.toLowerCase() === 'n/a' ||
    s.toLowerCase() === 'none'
  ) {
    return null;
  }
  const lower = s.toLowerCase();
  if (lower === 'laptop') return 'Laptop';
  if (lower === 'desktop') return 'Desktop';
  if (lower === 'server') return 'Server';
  if (lower === 'tablet') return 'Tablet';
  if (lower === 'mobile' || lower === 'phone') return 'Mobile';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Shorten lengthy hardware model labels for chart readability while preserving
 * vital identifying details (manufacturer, product family, model number, generation).
 */
export function shortenHardwareModel(rawModel: string): string {
  if (!rawModel) return '';
  let s = String(rawModel).trim();

  // 1. Remove trademark / copyright symbols
  s = s.replace(/[\u00AE\u2122]/g, '').replace(/\((?:TM|R|tm|r)\)/gi, '');

  // 2. Normalize legal/corporate manufacturer entities
  s = s.replace(/\bDell\s+(?:Inc\.?|Computer\s+Corporation|Corporation)(?=\s|$)/gi, 'Dell');
  s = s.replace(/\bHewlett-Packard(?:\s+Company)?(?=\s|$)/gi, 'HP');
  s = s.replace(/\bHP\s+(?:Inc\.?|Development\s+Company)(?=\s|$)/gi, 'HP');
  s = s.replace(/\bLenovo\s+(?:Group\s+Limited|Inc\.?|(?:\(United States\)\s+)?Inc\.?)(?=\s|$)/gi, 'Lenovo');
  s = s.replace(/\bApple\s+(?:Inc\.?|Computer,\s*Inc\.?)(?=\s|$)/gi, 'Apple');
  s = s.replace(/\bMicrosoft\s+Corporation(?=\s|$)/gi, 'Microsoft');
  s = s.replace(/\bCisco\s+(?:Systems,?\s+Inc\.?|Systems)(?=\s|$)/gi, 'Cisco');

  // 3. Remove duplicate adjacent manufacturer names (e.g. "HP HP", "Dell Dell")
  s = s.replace(/\b(Dell|HP|Lenovo|Apple|Cisco|Microsoft)\s+\1\b/gi, '$1');

  // 4. Compact Apple display size specifications: (16-inch, 2021) -> 16" 2021
  s = s.replace(/\((\d+)-inch(?:,\s*(\d{4}))?\)/gi, (_, size, yr) => yr ? `${size}" ${yr}` : `${size}"`);

  // 5. Remove redundant manufacturer prefix when the product family name is inherently distinctive
  s = s.replace(/\bApple\s+(MacBook|Mac\s+Studio|Mac\s+mini|iMac|Mac\s+Pro)\b/gi, '$1');
  s = s.replace(/\bLenovo\s+(ThinkPad|ThinkStation|ThinkCentre|IdeaPad|Legion)\b/gi, '$1');
  s = s.replace(/\bMicrosoft\s+(Surface(?:\s+Pro|\s+Laptop|\s+Book|\s+Go|\s+Studio|\s+Hub)?)\b/gi, '$1');

  // 6. Remove redundant generic device type words (without stripping product lines like Surface Laptop)
  s = s.replace(/\b(?:Notebook\s+PC|Desktop\s+PC|Laptop\s+PC|Personal\s+Computer|Computer\s+System)\b/gi, '');
  s = s.replace(/\b(?:Workstation|Notebook|Blade\s+Server|Blade)\b/gi, '');
  s = s.replace(/(?<!Surface\s)\bLaptop\b/gi, '');
  s = s.replace(/(?<!Surface\s)\bDesktop\b/gi, '');

  // 7. If model name is long, compress "Gen X" to "G{X}" or clean brand if family is prominent
  if (s.length > 20) {
    s = s.replace(/\bGen\s*(\d+)\b/gi, 'G$1');
    s = s.replace(/^Dell\s+(OptiPlex|Latitude|Precision|PowerEdge)\b/gi, '$1');
    s = s.replace(/^Cisco\s+(UCS)\b/gi, '$1');
  }

  // 8. Clean consecutive whitespace
  s = s.replace(/\s{2,}/g, ' ').trim();

  // 9. If still excessively long, truncate with ellipsis
  const MAX_DISPLAY_LEN = 24;
  if (s.length > MAX_DISPLAY_LEN) {
    s = s.slice(0, MAX_DISPLAY_LEN - 1).trim() + '…';
  }

  return s;
}

/**
 * Format model labels across the exposure dataset with collision detection.
 * If two different models produce the same shortened label, preserves distinguishing tokens.
 */
export function formatExposureModels<T extends { model: string }>(
  items: T[]
): (T & { shortModel: string; originalModel: string })[] {
  const initial = items.map((item) => ({
    ...item,
    originalModel: item.model,
    shortModel: shortenHardwareModel(item.model),
  }));

  // Detect collisions
  const countByShort = new Map<string, number>();
  for (const { shortModel } of initial) {
    countByShort.set(shortModel, (countByShort.get(shortModel) || 0) + 1);
  }

  return initial.map((item) => {
    let finalShort = item.shortModel;
    if ((countByShort.get(item.shortModel) || 0) > 1) {
      finalShort =
        item.originalModel.length <= 24
          ? item.originalModel
          : item.originalModel.slice(0, 23).trim() + '…';
    }
    return {
      ...item,
      shortModel: finalShort,
    };
  });
}

interface KpiTileProps {
  label: string;
  value: number;
  subtitle: string;
  tone: 'total' | 'active' | 'review' | 'stock' | 'employees';
  icon: React.ReactNode;
  testId?: string;
  valTestId?: string;
  secondaryTestId?: string;
}

const KpiTile: React.FC<KpiTileProps> = ({
  label,
  value,
  subtitle,
  tone,
  icon,
  testId,
  valTestId,
  secondaryTestId,
}) => (
  <div
    className={`di-kpi di-kpi-${tone}`}
    data-testid={testId}
    {...(secondaryTestId ? { 'data-secondary-testid': secondaryTestId } : {})}
    data-kpi-label={label}
    data-kpi-value={formatNumber(value)}
  >
    <div className="di-kpi-top">
      <span className="di-kpi-label">{label}</span>
      <span className="di-kpi-icon">{icon}</span>
    </div>
    <div
      className="di-kpi-value"
      data-testid={valTestId}
      {...(secondaryTestId ? { 'data-secondary-testid': `val-${secondaryTestId}` } : {})}
    >
      {formatNumber(value)}
    </div>
    <div className="di-kpi-subtitle">{subtitle}</div>
  </div>
);

const ChartCard: React.FC<{
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, description, className = '', children }) => (
  <section className={`di-card ${className}`}>
    <div className="di-card-header">
      <h3 className="di-card-title">{title}</h3>
      <p className="di-card-desc">{description}</p>
    </div>
    <div className="di-card-body">{children}</div>
  </section>
);

export const DashboardPage: React.FC = () => {
  const { dataRefreshKey } = useApp();
  const [data, setData] = useState<DashboardRedesignOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dedicated Hardware Asset Analysis state populated from GET /api/dashboard/hardware-analysis
  const [hardwareData, setHardwareData] = useState<HardwareAnalysisResponse | null>(null);
  const [hardwareLoading, setHardwareLoading] = useState<boolean>(true);
  const [hardwareError, setHardwareError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboardRedesignOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHardwareAnalysis = useCallback(async () => {
    setHardwareLoading(true);
    setHardwareError(null);
    try {
      const resp = await api.getHardwareAnalysis();
      if (!resp || typeof resp !== 'object' || Array.isArray(resp)) {
        throw new Error('Malformed hardware analysis response payload received from server.');
      }
      setHardwareData(resp);
    } catch (err: any) {
      console.error('[DashboardPage] Error fetching /api/dashboard/hardware-analysis:', err);
      setHardwareError(
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to load hardware analysis data.'
      );
    } finally {
      setHardwareLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    void loadHardwareAnalysis();
  }, [loadDashboard, loadHardwareAnalysis, dataRefreshKey]);

  const sourceData = useMemo(
    () => data?.assets_by_source.filter((item) => item.count > 0) ?? [],
    [data]
  );
  const totalSourceCount = useMemo(
    () => sourceData.reduce((acc, curr) => acc + curr.count, 0),
    [sourceData]
  );

  const topDepartments = useMemo(() => {
    return (data?.assets_by_department ?? [])
      .filter((item) => item && item.department && item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data]);

  const departmentColors = useMemo(() => {
    const usedColors = new Set<string>();
    return topDepartments.map((dept, idx) => {
      const name = (dept.department || '').trim();
      const formatted = formatDepartmentDisplayName(name);
      let color =
        KNOWN_DEPARTMENT_COLORS[name] ||
        KNOWN_DEPARTMENT_COLORS[formatted] ||
        DEPARTMENT_COLOR_CACHE.get(name);
      if (!color || usedColors.has(color)) {
        const available = DEPARTMENT_PALETTE.find((c) => !usedColors.has(c));
        color = available || DEPARTMENT_PALETTE[idx % DEPARTMENT_PALETTE.length];
        if (name) DEPARTMENT_COLOR_CACHE.set(name, color);
      }
      usedColors.add(color);
      return color;
    });
  }, [topDepartments]);

  const eolData = useMemo(
    () => data?.eol_distribution.filter((item) => item.count > 0) ?? [],
    [data]
  );
  const totalEolCount = useMemo(
    () => eolData.reduce((acc, curr) => acc + curr.count, 0),
    [eolData]
  );

  const eolExposure = useMemo(() => data?.eol_exposure ?? [], [data]);
  const eolExposureFormatted = useMemo(
    () => formatExposureModels(eolExposure),
    [eolExposure]
  );

  // Hardware Asset Analysis: Operating System distribution populated from GET /api/dashboard/hardware-analysis (byOs)
  const osDistribution = useMemo(() => {
    const rawMap = hardwareData?.byOs ?? (hardwareData as any)?.by_os;
    return parseCategoryMap(rawMap, { filterUnknown: true });
  }, [hardwareData]);

  const totalOsCount = useMemo(
    () => osDistribution.reduce((acc, curr) => acc + curr.count, 0),
    [osDistribution]
  );

  // Hardware Asset Analysis: Device Type distribution populated from GET /api/dashboard/hardware-analysis (byDevice)
  const deviceTypeDistribution = useMemo(() => {
    const rawMap = hardwareData?.byDevice ?? (hardwareData as any)?.by_device;
    return parseCategoryMap(rawMap, { filterUnknown: true });
  }, [hardwareData]);

  const totalDeviceTypeCount = useMemo(
    () => deviceTypeDistribution.reduce((acc, curr) => acc + curr.count, 0),
    [deviceTypeDistribution]
  );

  if (loading && !data) {
    return (
      <div className="di-dashboard">
        <div className="di-message">
          <span className="di-spinner" />
          Loading dashboard metrics…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="di-dashboard">
        <div className="di-error">
          <strong>Dashboard could not be loaded</strong>
          <p>{error}</p>
          <button onClick={() => void loadDashboard()}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis = data.kpis;
  const summaryTotals = data.source_summary.reduce(
    (totals, row) => ({
      total: totals.total + row.total,
      active: totals.active + row.active,
      review: totals.review + row.review,
      in_stock: totals.in_stock + row.in_stock,
      retired: totals.retired + row.retired,
      auto: totals.auto + row.auto,
      manual: totals.manual + row.manual,
      unassigned: totals.unassigned + row.unassigned,
      eol_active: totals.eol_active + row.eol_active,
      eol_soon: totals.eol_soon + row.eol_soon,
      eol_expired: totals.eol_expired + row.eol_expired,
      eol_unknown: totals.eol_unknown + row.eol_unknown,
    }),
    {
      total: 0,
      active: 0,
      review: 0,
      in_stock: 0,
      retired: 0,
      auto: 0,
      manual: 0,
      unassigned: 0,
      eol_active: 0,
      eol_soon: 0,
      eol_expired: 0,
      eol_unknown: 0,
    }
  );

  return (
    <div className="di-dashboard">
      {error && (
        <div className="di-inline-error">
          <span>{error}</span>
          <button onClick={() => void loadDashboard()}>Retry</button>
        </div>
      )}

      {/* Row 1 — Five KPI Cards */}
      <div className="di-kpis">
        <KpiTile
          label="Total Assets"
          value={kpis.total_assets}
          subtitle="Combined BigFix & Jamf fleet"
          tone="total"
          icon={<HardDrive className="w-4 h-4" />}
          testId="kpi-card-total-assets"
          valTestId="kpi-value-total-assets"
        />
        <KpiTile
          label="Active Assets"
          value={kpis.active_assets}
          subtitle="Assigned and operational"
          tone="active"
          icon={<CheckCircle2 className="w-4 h-4" />}
          testId="kpi-card-active-assets"
          valTestId="kpi-value-active-assets"
        />
        <KpiTile
          label="Need Review"
          value={kpis.review}
          subtitle="Requires owner validation"
          tone="review"
          icon={<AlertTriangle className="w-4 h-4" />}
          testId="kpi-card-need-review"
          valTestId="kpi-value-need-review"
          secondaryTestId="kpi-card-review"
        />
        <KpiTile
          label="In Stock"
          value={kpis.in_stock}
          subtitle="Available in stockroom"
          tone="stock"
          icon={<Package className="w-4 h-4" />}
          testId="kpi-card-instock"
          valTestId="kpi-value-instock"
          secondaryTestId="kpi-card-in-stock"
        />
        <KpiTile
          label="Employees"
          value={kpis.employee_count}
          subtitle="Workday identity directory"
          tone="employees"
          icon={<Users className="w-4 h-4" />}
          testId="kpi-card-employees"
          valTestId="kpi-value-employees"
          secondaryTestId="kpi-card-employee-count"
        />
      </div>

      {/* Row 2 — Three Analysis Cards: Assets by Source | Hardware Asset Analysis | Assets by Department */}
      <div className="di-chart-row-three">
        {/* 1. Assets by Source */}
        <ChartCard
          title="Assets by Source"
          description="Discovery platform telemetry (BigFix vs Jamf)"
          className="di-card-source"
        >
          <div className="di-chart-box">
            {sourceData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="count"
                    nameKey="source"
                    innerRadius={0}
                    outerRadius={74}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {sourceData.map((item) => (
                      <Cell
                        key={item.source}
                        fill={getSourceColor(item.source)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                    itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                    labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                    formatter={(value: any, name: any) => [
                      `${formatNumber(value)} assets (${formatChartPercentage(Number(value), totalSourceCount)})`,
                      labelForSource(String(name)),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="di-empty">No source data available</div>
            )}
          </div>
          <div className="di-legend">
            {sourceData.map((item) => {
              const pct = formatChartPercentage(item.count, totalSourceCount);
              return (
                <span key={item.source} className="di-legend-item">
                  <i style={{ background: getSourceColor(item.source) }} />
                  <span className="di-legend-name">{labelForSource(item.source)}</span>
                  <b className="di-legend-num">{formatNumber(item.count)}</b>
                  <span className="di-pct-pill">{pct}</span>
                </span>
              );
            })}
          </div>
        </ChartCard>

        {/* 2. Hardware Asset Analysis */}
        <ChartCard
          title="Hardware Asset Analysis"
          description="Breakdown by operating system and device type"
        >
          {hardwareLoading && !hardwareData ? (
            <div className="di-hardware-loading-box">
              <span className="di-spinner" />
              <span className="di-hardware-loading-text">Loading hardware analysis…</span>
            </div>
          ) : hardwareError && !hardwareData ? (
            <div className="di-hardware-error-box">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <p className="di-hardware-error-msg">{hardwareError}</p>
              <button
                className="di-retry-btn"
                onClick={() => void loadHardwareAnalysis()}
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : (
            <div className="di-hardware-analysis-grid" data-testid="card-hardware-asset-analysis">
              {/* Subchart A: By Operating System */}
              <div className="di-hardware-subchart" data-testid="chart-by-operating-system">
                <div className="di-hardware-subchart-header">
                  <span className="di-hardware-subchart-title">By Operating System</span>
                  {totalOsCount > 0 && (
                    <span className="di-hardware-subchart-badge">
                      {formatNumber(totalOsCount)}
                    </span>
                  )}
                </div>
                <div className="di-hardware-subchart-chart-box">
                  {osDistribution.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={osDistribution}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={0}
                          outerRadius={50}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {osDistribution.map((item, idx) => (
                            <Cell
                              key={item.name}
                              fill={getOsColor(item.name, idx)}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                          itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                          labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                          formatter={(value: any, name: any) => [
                            `${formatNumber(value)} assets (${formatChartPercentage(Number(value), totalOsCount)})`,
                            formatOsDisplayName(String(name)),
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="di-empty">No operating system data available</div>
                  )}
                </div>
                <div className="di-hardware-legend">
                  {osDistribution.map((item, idx) => {
                    const pct = formatChartPercentage(item.count, totalOsCount);
                    const color = getOsColor(item.name, idx);
                    const displayName = formatOsDisplayName(item.name);
                    return (
                      <div key={item.name} className="di-hardware-legend-row">
                        <span className="di-hardware-legend-left">
                          <i style={{ background: color }} />
                          <span className="di-hardware-legend-name" title={displayName}>
                            {displayName}
                          </span>
                        </span>
                        <span className="di-hardware-legend-right">
                          <b className="di-legend-num">{formatNumber(item.count)}</b>
                          <span className="di-pct-pill">{pct}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Subchart B: By Device Type */}
              <div className="di-hardware-subchart" data-testid="chart-by-device-type">
                <div className="di-hardware-subchart-header">
                  <span className="di-hardware-subchart-title">By Device Type</span>
                  {totalDeviceTypeCount > 0 && (
                    <span className="di-hardware-subchart-badge">
                      {formatNumber(totalDeviceTypeCount)}
                    </span>
                  )}
                </div>
                <div className="di-hardware-subchart-chart-box">
                  {deviceTypeDistribution.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={deviceTypeDistribution}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={0}
                          outerRadius={50}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {deviceTypeDistribution.map((item, idx) => (
                            <Cell
                              key={item.name}
                              fill={getDeviceTypeColor(item.name, idx)}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                          itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                          labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                          formatter={(value: any, name: any) => [
                            `${formatNumber(value)} assets (${formatChartPercentage(Number(value), totalDeviceTypeCount)})`,
                            String(name),
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="di-empty">No device type data available</div>
                  )}
                </div>
                <div className="di-hardware-legend">
                  {deviceTypeDistribution.map((item, idx) => {
                    const pct = formatChartPercentage(item.count, totalDeviceTypeCount);
                    const color = getDeviceTypeColor(item.name, idx);
                    return (
                      <div key={item.name} className="di-hardware-legend-row">
                        <span className="di-hardware-legend-left">
                          <i style={{ background: color }} />
                          <span className="di-hardware-legend-name" title={item.name}>
                            {item.name}
                          </span>
                        </span>
                        <span className="di-hardware-legend-right">
                          <b className="di-legend-num">{formatNumber(item.count)}</b>
                          <span className="di-pct-pill">{pct}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </ChartCard>

        {/* 3. Assets by Department */}
        <ChartCard
          title="Assets by Department"
          description="Top 10 departments by asset count"
        >
          <div className="di-chart-box di-department-chart-box">
            {topDepartments.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topDepartments}
                  margin={{ top: 8, right: 34, left: 2, bottom: 4 }}
                >
                  <CartesianGrid stroke="#e8ecf2" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="department"
                    width={125}
                    tick={{ fontSize: 11, fill: '#334155' }}
                    tickFormatter={(dept: any) => formatDepartmentDisplayName(String(dept))}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.65)' }}
                    formatter={(value: any) => [`${formatNumber(value)} assets`, 'Asset Count']}
                    labelFormatter={(label: any) =>
                      `Department: ${formatDepartmentDisplayName(String(label))}`
                    }
                    contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                    itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                    labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                  />
                  <Bar
                    dataKey="count"
                    name="Assets"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={18}
                  >
                    {topDepartments.map((dept, index) => (
                      <Cell
                        key={dept.department || index}
                        fill={departmentColors[index] || '#4f46e5'}
                      />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      fill="#334155"
                      fontSize={11}
                      fontWeight={600}
                      formatter={(val: any) => formatNumber(val)}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="di-empty">No department data available</div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Row 3 — EOL Status Distribution | EOL Exposure by Model */}
      <div className="di-chart-row-equal">
        {/* Left: EOL Status Distribution */}
        <ChartCard
          title="EOL Status Distribution"
          description="Hardware lifecycle support & expiration posture"
        >
          <div className="di-chart-box">
            {eolData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eolData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={0}
                    outerRadius={84}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {eolData.map((item) => (
                      <Cell
                        key={item.status}
                        fill={getEolColor(item.status)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${formatNumber(value)} assets (${formatChartPercentage(Number(value), totalEolCount)})`,
                      formatEolStatusLabel(String(name)),
                    ]}
                    contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                    itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                    labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="di-empty">No EOL status data available</div>
            )}
          </div>
          <div className="di-eol-legend">
            {eolData.map((item) => {
              const pct = formatChartPercentage(item.count, totalEolCount);
              return (
                <div key={item.status} className="di-eol-legend-item">
                  <span className="di-eol-legend-label">
                    <i style={{ background: getEolColor(item.status) }} />
                    <span className="di-eol-legend-text">
                      {formatEolStatusLabel(item.status)}
                    </span>
                  </span>
                  <div className="di-eol-legend-vals">
                    <b>{formatNumber(item.count)}</b>
                    <span className="di-pct-pill">{pct}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        {/* Right: EOL Exposure by Model */}
        <ChartCard
          title="EOL Exposure by Hardware Model"
          description="Models past or nearing end of life (bar height = assets affected)"
        >
          <div className="di-chart-box di-model-chart-box">
            <div className="di-model-chart-container">
              {eolExposureFormatted.length ? (
                <div
                  className="di-model-chart"
                  style={{
                    width: `${Math.max(100, eolExposureFormatted.length * 68)}px`,
                    minWidth: '100%',
                    height: '240px',
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={eolExposureFormatted}
                      margin={{ top: 20, right: 16, left: 0, bottom: 48 }}
                    >
                      <CartesianGrid stroke="#e8ecf2" strokeDasharray="4 4" vertical={false} />
                      <XAxis
                        dataKey="shortModel"
                        interval={0}
                        angle={-22}
                        textAnchor="end"
                        height={55}
                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        labelFormatter={(_label: any, payload: readonly any[]) => {
                          const fullModel = payload?.[0]?.payload?.originalModel || _label;
                          return `Model: ${fullModel}`;
                        }}
                        formatter={(value: any, _name: any, item: any) => [
                          `${formatNumber(value)} assets`,
                          formatEolStatusLabel(item?.payload?.eol_status || 'EOL status'),
                        ]}
                        contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                        itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                        labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                      />
                      <Bar
                        dataKey="count"
                        name="Affected assets"
                        maxBarSize={44}
                        radius={[4, 4, 0, 0]}
                      >
                        {eolExposureFormatted.map((item) => (
                          <Cell
                            key={item.originalModel}
                            fill={getEolColor(item.eol_status)}
                            tabIndex={0}
                            aria-label={`Model: ${item.originalModel}, ${formatNumber(item.count)} assets, EOL status: ${formatEolStatusLabel(item.eol_status)}`}
                          >
                            <title>{`${item.originalModel}: ${formatNumber(item.count)} assets (${formatEolStatusLabel(item.eol_status)})`}</title>
                          </Cell>
                        ))}
                        <LabelList
                          dataKey="count"
                          position="top"
                          fill="#334155"
                          fontSize={11}
                          fontWeight={600}
                          formatter={(val: any) => formatNumber(val)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="di-empty">No EOL exposure found</div>
              )}
            </div>
          </div>
          <div className="di-legend di-legend-wrap">
            {['EXPIRED', 'EOL SOON', 'UNKNOWN'].map((status) => (
              <span key={status} className="di-legend-item">
                <i style={{ background: getEolColor(status) }} />
                <span className="di-legend-name">
                  {status === 'EOL SOON'
                    ? 'EOL soon (< 90 days)'
                    : status.charAt(0) + status.slice(1).toLowerCase()}
                </span>
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 4 — Source Summary — full available width */}
      <ChartCard
        title="Source Summary"
        description="BigFix vs Jamf: inventory, assignment and end-of-life posture"
        className="di-source-table-card"
      >
        <div className="di-table-scroll">
          <table className="di-source-table">
            <colgroup>
              <col className="di-col-source" />
              <col className="di-col-total" />
              {Array.from({ length: 4 }, (_, i) => (
                <col key={`status-${i}`} className="di-col-metric" />
              ))}
              {Array.from({ length: 3 }, (_, i) => (
                <col key={`assignment-${i}`} className="di-col-metric" />
              ))}
              {Array.from({ length: 4 }, (_, i) => (
                <col key={`eol-${i}`} className="di-col-metric" />
              ))}
            </colgroup>
            <thead>
              <tr className="di-group-head">
                <th rowSpan={2}>Source</th>
                <th colSpan={5}>Asset status</th>
                <th colSpan={3}>Assignment</th>
                <th colSpan={4}>EOL status</th>
              </tr>
              <tr className="di-sub-head">
                <th>Total assets</th>
                <th>Active</th>
                <th>Need review</th>
                <th>In stock</th>
                <th>Retired</th>
                <th>Auto assigned</th>
                <th>Manual</th>
                <th>Unassigned</th>
                <th>Active</th>
                <th>EOL soon</th>
                <th>Expired</th>
                <th>Unknown</th>
              </tr>
            </thead>
            <tbody>
              {data.source_summary.map((row) => (
                <tr key={row.source}>
                  <td className="di-source-name">
                    <i style={{ background: getSourceColor(row.source) }} />
                    {labelForSource(row.source)}
                  </td>
                  <td className="di-cell-total">{formatNumber(row.total)}</td>
                  <td>
                    <span className="di-value-pill di-green">
                      {row.active ? formatNumber(row.active) : '–'}
                    </span>
                  </td>
                  <td>
                    <span className="di-value-pill di-amber">
                      {row.review ? formatNumber(row.review) : '–'}
                    </span>
                  </td>
                  <td>
                    <span className="di-value-pill di-grey">
                      {row.in_stock ? formatNumber(row.in_stock) : '–'}
                    </span>
                  </td>
                  <td>{row.retired ? formatNumber(row.retired) : '–'}</td>
                  <td className="di-separator">
                    {row.auto ? formatNumber(row.auto) : '–'}
                  </td>
                  <td>{row.manual ? formatNumber(row.manual) : '–'}</td>
                  <td>{row.unassigned ? formatNumber(row.unassigned) : '–'}</td>
                  <td className="di-separator">
                    <span className="di-value-pill di-green">
                      {row.eol_active ? formatNumber(row.eol_active) : '–'}
                    </span>
                  </td>
                  <td>
                    <span className="di-value-pill di-amber">
                      {row.eol_soon ? formatNumber(row.eol_soon) : '–'}
                    </span>
                  </td>
                  <td>
                    <span className="di-value-pill di-red">
                      {row.eol_expired ? formatNumber(row.eol_expired) : '–'}
                    </span>
                  </td>
                  <td>
                    <span className="di-value-pill di-grey">
                      {row.eol_unknown ? formatNumber(row.eol_unknown) : '–'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="di-cell-total">{formatNumber(summaryTotals.total)}</td>
                <td>{formatNumber(summaryTotals.active)}</td>
                <td>{formatNumber(summaryTotals.review)}</td>
                <td>{formatNumber(summaryTotals.in_stock)}</td>
                <td>{formatNumber(summaryTotals.retired)}</td>
                <td className="di-separator">{formatNumber(summaryTotals.auto)}</td>
                <td>{formatNumber(summaryTotals.manual)}</td>
                <td>{formatNumber(summaryTotals.unassigned)}</td>
                <td className="di-separator">{formatNumber(summaryTotals.eol_active)}</td>
                <td>{formatNumber(summaryTotals.eol_soon)}</td>
                <td>{formatNumber(summaryTotals.eol_expired)}</td>
                <td>{formatNumber(summaryTotals.eol_unknown)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>
    </div>
  );
};