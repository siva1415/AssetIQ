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

/* ==========================================================================
   AssetIQ Color System
   Midnight Navy: #14213D | Electric Blue: #4169E1 | Teal: #14B8A6
   Violet: #7C3AED | Amber: #F59E0B | Slate: #64748B
   ========================================================================== */

export const SOURCE_COLORS: Record<string, string> = {
  BIGFIX: '#4169E1', // Electric / Royal Blue
  BigFix: '#4169E1',
  bigfix: '#4169E1',
  JAMF: '#D9468F',   // Pink
  Jamf: '#D9468F',
  jamf: '#D9468F',
};

export function getSourceColor(source: string): string {
  const normalized = (source || '').trim().toUpperCase();
  if (normalized === 'BIGFIX') return '#4169E1';
  if (normalized === 'JAMF') return '#D9468F';
  return SOURCE_COLORS[normalized] || '#4169E1';
}

/**
 * Consistent asset status colors:
 * ACTIVE: #16A34A, NEED REVIEW: #F59E0B, IN STOCK: #3B82F6, RETIRED: #64748B, EXPIRED EOL: #DC2626
 */
export const ASSET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#16A34A',
  REVIEW: '#F59E0B',
  'NEED REVIEW': '#F59E0B',
  'IN STOCK': '#3B82F6',
  RETIRED: '#64748B',
  EXPIRED: '#DC2626',
};

/**
 * Consistent EOL status colors:
 * ACTIVE: #16A34A, EOL SOON: #F59E0B, EXPIRED: #DC2626, UNKNOWN: #64748B
 */
export const EOL_COLORS: Record<string, string> = {
  ACTIVE: '#16A34A',     // Green (>90 days)
  'EOL SOON': '#F59E0B', // Amber (0–90 days)
  EXPIRED: '#DC2626',    // Red
  UNKNOWN: '#64748B',    // Slate
};

export function getEolColor(status: string): string {
  const s = (status || '').trim().toUpperCase();
  if (s === 'ACTIVE' || s.startsWith('ACTIVE')) return '#16A34A';
  if (s === 'EOL SOON' || s === 'EOL_SOON' || s.includes('SOON')) return '#F59E0B';
  if (s === 'EXPIRED') return '#DC2626';
  if (s === 'UNKNOWN') return '#64748B';
  return EOL_COLORS[s] || '#64748B';
}

export interface ChartItem {
  name: string;
  count: number;
}

/**
 * Transforms category-to-count map or array into a sorted ChartItem array.
 */
export function parseCategoryMap(
  dataMap: unknown,
  options?: { filterUnknown?: boolean }
): ChartItem[] {
  if (!dataMap) return [];

  if (Array.isArray(dataMap)) {
    return dataMap
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const name = String(item.name || item.source || item.category || item.status || '').trim();
        const count = Number(item.count || item.total || 0);
        return { name, count: isNaN(count) ? 0 : Math.max(0, Math.round(count)) };
      })
      .filter((item) => item.name && item.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  if (typeof dataMap !== 'object') {
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

/**
 * Coordinated palette for Top 10 Departments:
 * Professional blue, teal, violet, and slate shades.
 */
export const DEPARTMENT_PALETTE: string[] = [
  '#4169E1', // Electric Blue
  '#14B8A6', // Teal
  '#7C3AED', // Violet
  '#2563EB', // Royal Blue
  '#0D9488', // Deep Teal
  '#6366F1', // Indigo
  '#0284C7', // Sky Blue
  '#8B5CF6', // Soft Violet
  '#0891B2', // Cyan Slate
  '#4F46E5', // Slate Indigo
];

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
 * Converts uppercase department names into readable title-style capitalization,
 * preserving meaningful acronyms (e.g. IT, HR, QA, R&D).
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

export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Consistent percentage formatting for dashboard charts & legends.
 */
export function formatChartPercentage(count: number, total: number): string {
  if (!total || total <= 0 || !count || count <= 0) {
    return '0%';
  }
  const rawPct = (count / total) * 100;
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
 * Shared dark tooltip style for Recharts ensuring 100% white (#FFFFFF) text
 * across all titles, labels, values, and list items.
 */
export const DASHBOARD_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    color: '#ffffff',
    fontSize: '12px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
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
  if (s === 'EOL SOON') return 'EOL soon (0–90 days)';
  if (s === 'EXPIRED') return 'Expired';
  if (s === 'UNKNOWN') return 'Unknown';
  return status;
};

/**
 * Shortens lengthy hardware model labels for chart readability while preserving
 * vital identifying details.
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

  // 3. Remove duplicate adjacent manufacturer names
  s = s.replace(/\b(Dell|HP|Lenovo|Apple|Cisco|Microsoft)\s+\1\b/gi, '$1');

  // 4. Compact Apple display size specifications: (16-inch, 2021) -> 16" 2021
  s = s.replace(/\((\d+)-inch(?:,\s*(\d{4}))?\)/gi, (_, size, yr) => yr ? `${size}" ${yr}` : `${size}"`);

  // 5. Remove redundant manufacturer prefix when product family name is inherently distinctive
  s = s.replace(/\bApple\s+(MacBook|Mac\s+Studio|Mac\s+mini|iMac|Mac\s+Pro)\b/gi, '$1');
  s = s.replace(/\bLenovo\s+(ThinkPad|ThinkStation|ThinkCentre|IdeaPad|Legion)\b/gi, '$1');
  s = s.replace(/\bMicrosoft\s+(Surface(?:\s+Pro|\s+Laptop|\s+Book|\s+Go|\s+Studio|\s+Hub)?)\b/gi, '$1');

  // 6. Remove redundant generic device type words
  s = s.replace(/\b(?:Notebook\s+PC|Desktop\s+PC|Laptop\s+PC|Personal\s+Computer|Computer\s+System)\b/gi, '');
  s = s.replace(/\b(?:Workstation|Notebook|Blade\s+Server|Blade)\b/gi, '');
  s = s.replace(/(?<!Surface\s)\bLaptop\b/gi, '');
  s = s.replace(/(?<!Surface\s)\bDesktop\b/gi, '');

  if (s.length > 20) {
    s = s.replace(/\bGen\s*(\d+)\b/gi, 'G$1');
    s = s.replace(/^Dell\s+(OptiPlex|Latitude|Precision|PowerEdge)\b/gi, '$1');
    s = s.replace(/^Cisco\s+(UCS)\b/gi, '$1');
  }

  s = s.replace(/\s{2,}/g, ' ').trim();

  const MAX_DISPLAY_LEN = 24;
  if (s.length > MAX_DISPLAY_LEN) {
    s = s.slice(0, MAX_DISPLAY_LEN - 1).trim() + '…';
  }

  return s;
}

export function formatExposureModels<T extends { model: string }>(
  items: T[]
): (T & { shortModel: string; originalModel: string })[] {
  const initial = items.map((item) => ({
    ...item,
    originalModel: item.model,
    shortModel: shortenHardwareModel(item.model),
  }));

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

/**
 * Custom YAxis tick renderer for Assets by Department that wraps lengthy
 * department names onto multiple lines without clipping or truncation,
 * ensuring each department label is perfectly aligned with its corresponding bar.
 */
export const renderDepartmentTick = (props: any) => {
  const { x, y, payload } = props;
  const rawText = String(payload?.value || '');
  const displayName = formatDepartmentDisplayName(rawText);

  // Wrap department names exceeding 14 characters onto multiple lines
  const words = displayName.split(/\s+/).filter(Boolean);
  let lines: string[] = [];
  if (displayName.length > 14 && words.length > 1) {
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      if ((currentLine + ' ' + words[i]).length <= 15) {
        currentLine += ' ' + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  } else {
    lines = [displayName];
  }

  const lineCount = lines.length;

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{displayName}</title>
      <text
        x={-8}
        y={0}
        textAnchor="end"
        fill="#334155"
        fontSize={11}
        fontWeight={500}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {lines.map((line, idx) => {
          let dyVal: number = 4;
          if (lineCount === 1) {
            dyVal = 4;
          } else if (idx === 0) {
            dyVal = -((lineCount - 1) * 6.5) + 3;
          } else {
            dyVal = 13;
          }

          return (
            <tspan key={idx} x={-8} dy={dyVal}>
              {line}
            </tspan>
          );
        })}
      </text>
    </g>
  );
};

/**
 * Custom YAxis tick renderer for EOL Exposure by Hardware Model that wraps
 * lengthy hardware model names onto multiple lines without clipping or truncation.
 */
export const renderModelTick = (props: any) => {
  const { x, y, payload } = props;
  const rawText = String(payload?.value || '');
  const words = rawText.split(' ');
  let lines: string[] = [];
  if (rawText.length > 16 && words.length > 1) {
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      if ((currentLine + ' ' + words[i]).length <= 16) {
        currentLine += ' ' + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  } else {
    lines = [rawText];
  }

  if (lines.length > 2) {
    lines = [lines[0], lines.slice(1).join(' ')];
    if (lines[1].length > 18) {
      lines[1] = lines[1].slice(0, 17).trim() + '…';
    }
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-6} y={0} textAnchor="end" fill="#334155" fontSize={10.5} fontWeight={500}>
        {lines.map((line, idx) => (
          <tspan key={idx} x={-6} dy={idx === 0 ? (lines.length > 1 ? -4 : 4) : 12}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

/**
 * Custom XAxis tick renderer for EOL Status Distribution vertical column chart.
 * Displays readable status labels centered below each column without overlapping or clipping.
 */
export const renderEolColumnTick = (props: any) => {
  const { x, y, payload } = props;
  const raw = String(payload?.value || '');
  const key = raw.toUpperCase();

  let title = raw;
  let subtitle = '';
  if (key.includes('ACTIVE')) {
    title = 'Active';
    subtitle = '> 90 days';
  } else if (key.includes('SOON')) {
    title = 'EOL Soon';
    subtitle = '0–90 days';
  } else if (key.includes('EXPIRED')) {
    title = 'Expired';
    subtitle = 'Past date';
  } else if (key.includes('UNKNOWN')) {
    title = 'Unknown';
    subtitle = 'No record';
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600}>
        <tspan x={0} dy={12}>
          {title}
        </tspan>
        {subtitle && (
          <tspan x={0} dy={13} fill="#64748b" fontSize={9.5} fontWeight={400}>
            {subtitle}
          </tspan>
        )}
      </text>
    </g>
  );
};

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
  const { dataRefreshKey, triggerDataRefresh } = useApp();
  const [data, setData] = useState<DashboardRedesignOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dedicated Hardware Asset Analysis state
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

  /* --------------------------------------------------------------------------
     Row 1 Data Processing: Assets by Source
     -------------------------------------------------------------------------- */
  const sourceData = useMemo(() => {
    const list = data?.assets_by_source ?? [];
    // Ensure both BigFix and Jamf are tracked, with live counts
    const bigfixItem = list.find((item) => (item.source || '').toUpperCase() === 'BIGFIX');
    const jamfItem = list.find((item) => (item.source || '').toUpperCase() === 'JAMF');

    const bigfixCount = bigfixItem ? bigfixItem.count : 0;
    const jamfCount = jamfItem ? jamfItem.count : 0;

    return [
      { source: 'BigFix', count: bigfixCount, color: '#4169E1' },
      { source: 'Jamf', count: jamfCount, color: '#D9468F' },
    ];
  }, [data]);

  const totalSourceCount = useMemo(
    () => sourceData.reduce((acc, curr) => acc + curr.count, 0),
    [sourceData]
  );

  /* --------------------------------------------------------------------------
     Row 1 Data Processing: Hardware Asset Analysis (3 Distinct Sections)
     -------------------------------------------------------------------------- */

  // Section A: By Operating System (Horizontal Bar Chart)
  // Exactly 3 categories: Windows 11, Windows 10, Mac
  const osChartData = useMemo(() => {
    const rawMap = hardwareData?.byOs ?? hardwareData?.by_os ?? data?.by_operating_system;
    let win11Count = 0;
    let win10Count = 0;
    let macCount = 0;

    if (rawMap && typeof rawMap === 'object') {
      const entries = Array.isArray(rawMap)
        ? rawMap.map((item: any) => [String(item.name || item.os || ''), Number(item.count || 0)])
        : Object.entries(rawMap);

      for (const [key, val] of entries) {
        if (!key) continue;
        const count = typeof val === 'number' ? val : Number(val) || 0;
        if (count <= 0) continue;

        const k = String(key).trim();
        const lower = k.toLowerCase();

        // Exact pre-grouped checks from backend
        if (k === 'Windows 11' || lower === 'windows 11') {
          win11Count += count;
        } else if (k === 'Windows 10' || lower === 'windows 10') {
          win10Count += count;
        } else if (k === 'Mac' || lower === 'mac') {
          macCount += count;
        }
        // Substring / version normalization grouping
        else if (lower.includes('windows 11') || lower.includes('win 11') || lower.includes('win11')) {
          win11Count += count;
        } else if (lower.includes('windows 10') || lower.includes('win 10') || lower.includes('win10')) {
          win10Count += count;
        } else if (
          lower.includes('macos') ||
          lower.includes('mac os') ||
          lower.includes('os x') ||
          lower.startsWith('mac') ||
          lower.includes('apple')
        ) {
          // Exclude Windows / Server
          if (!lower.includes('win') && !lower.includes('server')) {
            macCount += count;
          }
        }
      }
    }

    const items = [
      { name: 'Windows 11', count: win11Count, color: '#4169E1' }, // Electric Blue
      { name: 'Windows 10', count: win10Count, color: '#14B8A6' }, // Teal
      { name: 'Mac', count: macCount, color: '#7C3AED' },          // Violet
    ];

    const total = win11Count + win10Count + macCount;
    return { items, total };
  }, [hardwareData, data]);

  // Section B: By Device Type (Donut Chart)
  // Shows authoritative counts for Laptops and Desktops without duplicate summing
  const deviceTypeChartData = useMemo(() => {
    const rawMap = hardwareData?.byDevice ?? hardwareData?.by_device ?? data?.by_device_type;
    let laptopCount = 0;
    let desktopCount = 0;

    if (rawMap && typeof rawMap === 'object') {
      const entries: [string, number][] = Array.isArray(rawMap)
        ? rawMap.map((item: any) => [
            String(item.name || item.device_type || item.type || item.devicetype || ''),
            Number(item.count || item.total || 0),
          ])
        : Object.entries(rawMap).map(([k, v]) => [String(k), typeof v === 'number' ? v : Number(v) || 0]);

      // Direct authoritative lookup map
      // Exclude composite category keys (e.g. 'store-desktops', 'corporate-laptops') and totals
      const directMap = new Map<string, number>();
      for (const [key, val] of entries) {
        if (!key || val <= 0) continue;
        const clean = key.trim().toLowerCase();
        if (clean.includes('-') || clean.includes('_') || clean.includes('total') || clean.includes('all')) {
          continue;
        }
        directMap.set(clean, val);
      }

      const directLaptop =
        directMap.get('laptop') ??
        directMap.get('laptops') ??
        directMap.get('notebook') ??
        directMap.get('notebooks');
      const directDesktop =
        directMap.get('desktop') ??
        directMap.get('desktops') ??
        directMap.get('workstation') ??
        directMap.get('workstations');

      if (directLaptop !== undefined || directDesktop !== undefined) {
        laptopCount = directLaptop || 0;
        desktopCount = directDesktop || 0;
      } else {
        // Fallback: iterate entries while strictly skipping compound category keys
        for (const [key, val] of entries) {
          if (!key || val <= 0) continue;
          const lower = key.trim().toLowerCase();
          if (
            lower.includes('total') ||
            lower.includes('store') ||
            lower.includes('corporate') ||
            lower.includes('corp') ||
            lower.includes('-') ||
            lower.includes('_')
          ) {
            continue;
          }
          if (lower === 'laptop' || lower === 'laptops' || lower === 'notebook' || lower === 'notebooks') {
            laptopCount += val;
          } else if (lower === 'desktop' || lower === 'desktops' || lower === 'workstation' || lower === 'workstations') {
            desktopCount += val;
          }
        }
      }
    }

    const items = [
      { name: 'Laptops', count: laptopCount, color: '#635BFF' },  // Violet
      { name: 'Desktops', count: desktopCount, color: '#14B8A6' }, // Teal
    ];

    // Authoritative total derived strictly from Laptops + Desktops
    const total = laptopCount + desktopCount;
    return { items, total };
  }, [hardwareData, data]);

  // Section C: By Category (Donut Chart)
  // Shows ONLY: STORE (#4169E1) and CORPORATE (#14B8A6)
  const categoryChartData = useMemo(() => {
    const rawMap =
      hardwareData?.byCategory ??
      hardwareData?.by_category ??
      (data as any)?.by_category ??
      (data as any)?.byCategory;

    let storeCount = 0;
    let corporateCount = 0;

    if (rawMap && typeof rawMap === 'object') {
      const entries: [string, number][] = Array.isArray(rawMap)
        ? rawMap.map((item: any) => [
            String(item.name || item.category || ''),
            Number(item.count || item.total || 0),
          ])
        : Object.entries(rawMap).map(([k, v]) => [String(k), typeof v === 'number' ? v : Number(v) || 0]);

      for (const [key, val] of entries) {
        if (!key || val <= 0) continue;
        const upper = key.trim().toUpperCase();
        if (upper === 'STORE' || upper === 'STORES') {
          storeCount += val;
        } else if (upper === 'CORPORATE' || upper === 'CORP') {
          corporateCount += val;
        }
      }
    }

    // Fallback if only composite byDeviceTypeAndCategory was available
    if (storeCount === 0 && corporateCount === 0) {
      const fallbackMap =
        hardwareData?.byDeviceTypeAndCategory ??
        hardwareData?.by_device_type_and_category ??
        (data as any)?.by_device_type_and_category ??
        (data as any)?.byDeviceTypeAndCategory;
      if (fallbackMap && typeof fallbackMap === 'object') {
        const entries: [string, number][] = Array.isArray(fallbackMap)
          ? fallbackMap.map((item: any) => [
              String(item.name || item.category || ''),
              Number(item.count || item.total || 0),
            ])
          : Object.entries(fallbackMap).map(([k, v]) => [String(k), typeof v === 'number' ? v : Number(v) || 0]);
        for (const [key, val] of entries) {
          if (!key || val <= 0) continue;
          const upper = key.trim().toUpperCase();
          if (upper.startsWith('STORE')) {
            storeCount += val;
          } else if (upper.startsWith('CORP')) {
            corporateCount += val;
          }
        }
      }
    }

    const items = [
      { name: 'STORE', count: storeCount, color: '#4169E1' },      // Electric Blue
      { name: 'CORPORATE', count: corporateCount, color: '#14B8A6' }, // Teal
    ];

    const total = storeCount + corporateCount;
    return { items, total };
  }, [hardwareData, data]);

  /* --------------------------------------------------------------------------
     Row 2 Data Processing: Departments, EOL Status, EOL Exposure
     -------------------------------------------------------------------------- */
  const topDepartments = useMemo(() => {
    return (data?.assets_by_department ?? [])
      .filter((item) => {
        if (!item || typeof item.department !== 'string') return false;
        const trimmed = item.department.trim();
        if (!trimmed) return false;
        return trimmed.toLowerCase() !== 'unassigned';
      })
      .slice(0, 10);
  }, [data]);

  const totalTopDeptCount = useMemo(
    () => topDepartments.reduce((acc, curr) => acc + curr.count, 0),
    [topDepartments]
  );

  // EOL Status Distribution: Exactly 4 categories in order
  const eolStatusDistribution = useMemo(() => {
    const rawList = data?.eol_distribution ?? [];
    const countMap: Record<string, number> = {
      ACTIVE: 0,
      'EOL SOON': 0,
      EXPIRED: 0,
      UNKNOWN: 0,
    };

    for (const item of rawList) {
      if (!item) continue;
      const rawStatus = (item.status || '').trim().toUpperCase();
      const count = Number(item.count) || 0;
      if (rawStatus === 'ACTIVE' || rawStatus.startsWith('ACTIVE')) {
        countMap.ACTIVE += count;
      } else if (rawStatus === 'EOL SOON' || rawStatus === 'EOL_SOON' || rawStatus.includes('SOON')) {
        countMap['EOL SOON'] += count;
      } else if (rawStatus === 'EXPIRED') {
        countMap.EXPIRED += count;
      } else {
        countMap.UNKNOWN += count;
      }
    }

    const items = [
      {
        key: 'ACTIVE',
        label: 'Active (> 90 days)',
        count: countMap.ACTIVE,
        color: '#16A34A', // Active Green
      },
      {
        key: 'EOL SOON',
        label: 'EOL soon (0–90 days)',
        count: countMap['EOL SOON'],
        color: '#F59E0B', // Amber
      },
      {
        key: 'EXPIRED',
        label: 'Expired',
        count: countMap.EXPIRED,
        color: '#DC2626', // Red
      },
      {
        key: 'UNKNOWN',
        label: 'Unknown',
        count: countMap.UNKNOWN,
        color: '#64748B', // Slate
      },
    ];

    const totalFleet =
      data?.kpis?.total_assets ||
      items.reduce((sum, item) => sum + item.count, 0);

    return { items, totalFleet };
  }, [data]);

  const eolExposure = useMemo(() => data?.eol_exposure ?? [], [data]);
  const eolExposureFormatted = useMemo(
    () => formatExposureModels(eolExposure),
    [eolExposure]
  );

  if (loading && !data) {
    return (
      <div className="di-dashboard">
        <div className="di-loading-state">
          <span className="di-spinner" />
          <span>Loading AssetIQ dashboard metrics…</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="di-dashboard">
        <div className="di-error-state">
          <strong>Dashboard could not be loaded</strong>
          <p>{error}</p>
          <button className="di-refresh-btn" onClick={() => void loadDashboard()}>
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

      {/* Row 0 — Five KPI Cards */}
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

      {/* Row 1 — Assets by Source & Hardware Asset Analysis */}
      <div className="di-row-1">
        {/* Card 1: Assets by Source (Donut Chart - compact sizing) */}
        <ChartCard
          title="Assets by Source"
          description="Discovery platform telemetry (BigFix vs Jamf)"
          className="di-card-source"
        >
          {/* Legend in one single horizontal line above the donut */}
          <div className="di-source-legend-line">
            <span className="di-source-legend-item">
              <i className="di-source-legend-dot" style={{ backgroundColor: '#4169E1' }} />
              <span className="di-source-legend-name">BigFix</span>
              <span className="di-source-legend-count">{formatNumber(sourceData[0]?.count)}</span>
            </span>
            <span className="di-source-legend-item">
              <i className="di-source-legend-dot" style={{ backgroundColor: '#D9468F' }} />
              <span className="di-source-legend-name">Jamf</span>
              <span className="di-source-legend-count">{formatNumber(sourceData[1]?.count)}</span>
            </span>
          </div>

          <div className="di-source-chart-box">
            {totalSourceCount > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="count"
                      nameKey="source"
                      innerRadius={46}
                      outerRadius={66}
                      stroke="#ffffff"
                      strokeWidth={2}
                      paddingAngle={2}
                    >
                      {sourceData.map((item) => (
                        <Cell key={item.source} fill={item.color} />
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
                {/* Center Asset Count */}
                <div className="di-donut-center">
                  <span className="di-donut-center-val">{formatNumber(totalSourceCount)}</span>
                  <span className="di-donut-center-lbl">Total Assets</span>
                </div>
              </>
            ) : (
              <div className="di-empty">No discovery source data available</div>
            )}
          </div>
        </ChartCard>

        {/* Card 2: Hardware Asset Analysis (Three Sections Separated by Dividers) */}
        <ChartCard
          title="Hardware Asset Analysis"
          description="Asset distribution across operating systems, device types, and category profiles"
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
              <button className="di-retry-btn" onClick={() => void loadHardwareAnalysis()}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : (
            <div className="di-hardware-sections-container" data-testid="card-hardware-asset-analysis">
              {/* Section 1: By Operating System (Horizontal Bar Chart) */}
              <div className="di-hardware-section" data-testid="chart-by-operating-system">
                <div className="di-hardware-section-header">
                  <span className="di-hardware-section-title">By Operating System</span>
                </div>

                <div className="di-section-chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={osChartData.items}
                      margin={{ top: 12, right: 38, left: 2, bottom: 4 }}
                    >
                      <CartesianGrid stroke="#e8ecf2" strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={82}
                        tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(241, 245, 249, 0.65)' }}
                        contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                        itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                        labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                        formatter={(value: any, name: any, item: any) => [
                          `${formatNumber(value)} assets (${formatChartPercentage(Number(value), osChartData.total)})`,
                          item?.payload?.name || name,
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={18}
                      >
                        {osChartData.items.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
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
                </div>
              </div>

              {/* Section 2: By Device Type (Donut Chart) */}
              <div className="di-hardware-section" data-testid="chart-by-device-type">
                <div className="di-hardware-section-header">
                  <span className="di-hardware-section-title">By Device Type</span>
                </div>

                {/* Legends horizontally in a single line at top */}
                <div className="di-section-legend-line">
                  <span className="di-source-legend-item">
                    <i className="di-source-legend-dot" style={{ backgroundColor: '#635BFF' }} />
                    <span className="di-source-legend-name">Laptops</span>
                    <span className="di-source-legend-count">
                      {formatNumber(deviceTypeChartData.items[0]?.count)}
                    </span>
                  </span>
                  <span className="di-source-legend-item">
                    <i className="di-source-legend-dot" style={{ backgroundColor: '#14B8A6' }} />
                    <span className="di-source-legend-name">Desktops</span>
                    <span className="di-source-legend-count">
                      {formatNumber(deviceTypeChartData.items[1]?.count)}
                    </span>
                  </span>
                </div>

                <div className="di-section-chart-box">
                  {deviceTypeChartData.total > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={deviceTypeChartData.items}
                            dataKey="count"
                            nameKey="name"
                            innerRadius={46}
                            outerRadius={66}
                            stroke="#ffffff"
                            strokeWidth={2}
                            paddingAngle={2}
                          >
                            {deviceTypeChartData.items.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                            itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                            labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                            formatter={(value: any, name: any) => [
                              `${formatNumber(value)} devices (${formatChartPercentage(Number(value), deviceTypeChartData.total)})`,
                              String(name),
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="di-donut-center">
                        <span className="di-donut-center-val">
                          {formatNumber(deviceTypeChartData.total)}
                        </span>
                        <span className="di-donut-center-lbl">Devices</span>
                      </div>
                    </>
                  ) : (
                    <div className="di-empty">No device type data</div>
                  )}
                </div>
              </div>

              {/* Section 3: By Category (Donut Chart - STORE and CORPORATE only) */}
              <div
                className="di-hardware-section"
                data-testid="chart-by-category"
                data-secondary-testid="chart-by-device-type-and-category"
              >
                <div className="di-hardware-section-header">
                  <span className="di-hardware-section-title">By Category</span>
                </div>

                {/* Legend showing STORE and CORPORATE horizontally with live counts */}
                <div className="di-section-legend-line">
                  <span className="di-source-legend-item">
                    <i className="di-source-legend-dot" style={{ backgroundColor: '#4169E1' }} />
                    <span className="di-source-legend-name">STORE</span>
                    <span className="di-source-legend-count">
                      {formatNumber(categoryChartData.items[0]?.count)}
                    </span>
                  </span>
                  <span className="di-source-legend-item">
                    <i className="di-source-legend-dot" style={{ backgroundColor: '#14B8A6' }} />
                    <span className="di-source-legend-name">CORPORATE</span>
                    <span className="di-source-legend-count">
                      {formatNumber(categoryChartData.items[1]?.count)}
                    </span>
                  </span>
                </div>

                <div className="di-section-chart-box">
                  {categoryChartData.total > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData.items}
                            dataKey="count"
                            nameKey="name"
                            innerRadius={46}
                            outerRadius={66}
                            stroke="#ffffff"
                            strokeWidth={2}
                            paddingAngle={2}
                          >
                            {categoryChartData.items.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                            itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                            labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                            formatter={(value: any, name: any) => [
                              `${formatNumber(value)} assets (${formatChartPercentage(Number(value), categoryChartData.total)})`,
                              String(name),
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="di-donut-center">
                        <span className="di-donut-center-val">
                          {formatNumber(categoryChartData.total)}
                        </span>
                        <span className="di-donut-center-lbl">Assets</span>
                      </div>
                    </>
                  ) : (
                    <div className="di-empty">No category data</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 2 — Assets by Department | EOL Status Distribution | EOL Exposure by Hardware Model */}
      <div className="di-row-2">
        {/* Card 1: Assets by Department (Horizontal Bar Chart) */}
        <ChartCard
          title="Assets by Department"
          description="Top 10 departments ranked by active asset count"
        >
          <div className="di-row-2-chart-box">
            {topDepartments.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topDepartments}
                  margin={{ top: 10, right: 42, left: 8, bottom: 6 }}
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
                    width={146}
                    interval={0}
                    tick={renderDepartmentTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.65)' }}
                    formatter={(value: any) => [
                      `${formatNumber(value)} assets (${formatChartPercentage(Number(value), totalTopDeptCount)})`,
                      'Asset Count',
                    ]}
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
                    maxBarSize={16}
                  >
                    {topDepartments.map((dept, index) => (
                      <Cell
                        key={dept.department || index}
                        fill={DEPARTMENT_PALETTE[index % DEPARTMENT_PALETTE.length]}
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

        {/* Card 2: EOL Status Distribution (Vertical Column Chart) */}
        <ChartCard
          title="EOL Status Distribution"
          description="Asset lifecycle posture: Active, EOL soon, Expired, and Unknown"
        >
          <div className="di-row-2-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={eolStatusDistribution.items}
                margin={{ top: 22, right: 16, left: -10, bottom: 8 }}
              >
                <CartesianGrid stroke="#e8ecf2" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="key"
                  interval={0}
                  tick={renderEolColumnTick}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  height={42}
                />
                <YAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 10.5, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  width={36}
                  domain={[0, (dataMax: number) => Math.max(5, Math.ceil(dataMax * 1.15))]}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.65)' }}
                  formatter={(value: any, _name: any, item: any) => [
                    `${formatNumber(value)} assets (${formatChartPercentage(Number(value), eolStatusDistribution.totalFleet)})`,
                    item?.payload?.label || item?.payload?.key || 'Status',
                  ]}
                  contentStyle={DASHBOARD_TOOLTIP_STYLE.contentStyle}
                  itemStyle={DASHBOARD_TOOLTIP_STYLE.itemStyle}
                  labelStyle={DASHBOARD_TOOLTIP_STYLE.labelStyle}
                />
                <Bar
                  dataKey="count"
                  name="Assets"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                >
                  {eolStatusDistribution.items.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="top"
                    fill="#334155"
                    fontSize={11}
                    fontWeight={600}
                    formatter={(val: any) => formatNumber(val)}
                    offset={8}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Card 3: EOL Exposure by Hardware Model (Standard Horizontal Bar Chart) */}
        <ChartCard
          title="EOL Exposure by Hardware Model"
          description="Hardware models with expired or approaching lifecycle boundaries"
        >
          <div className="di-row-2-chart-box di-scrollable-y">
            {eolExposureFormatted.length ? (
              <div style={{ height: `${Math.max(280, eolExposureFormatted.length * 36)}px`, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={eolExposureFormatted}
                    margin={{ top: 8, right: 38, left: 6, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#e8ecf2" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 10.5, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortModel"
                      width={138}
                      tick={renderModelTick}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(241, 245, 249, 0.65)' }}
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
                      maxBarSize={18}
                      radius={[0, 4, 4, 0]}
                    >
                      {eolExposureFormatted.map((item) => (
                        <Cell
                          key={item.originalModel}
                          fill={getEolColor(item.eol_status)}
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
              </div>
            ) : (
              <div className="di-empty">No EOL exposure detected in fleet</div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Row 3 — Source Summary (Full Width) */}
      <div className="di-row-3">
        <ChartCard
          title="Source Summary"
          description="BigFix vs Jamf reconciliation: inventory, assignment governance, and end-of-life posture"
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
                      <span className="di-status-val di-status-val-green">
                        {row.active ? formatNumber(row.active) : '–'}
                      </span>
                    </td>
                    <td>
                      <span className="di-status-val di-status-val-amber">
                        {row.review ? formatNumber(row.review) : '–'}
                      </span>
                    </td>
                    <td>
                      <span className="di-status-val di-status-val-blue">
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
                      <span className="di-status-val di-status-val-green">
                        {row.eol_active ? formatNumber(row.eol_active) : '–'}
                      </span>
                    </td>
                    <td>
                      <span className="di-status-val di-status-val-amber">
                        {row.eol_soon ? formatNumber(row.eol_soon) : '–'}
                      </span>
                    </td>
                    <td>
                      <span className="di-status-val di-status-val-red">
                        {row.eol_expired ? formatNumber(row.eol_expired) : '–'}
                      </span>
                    </td>
                    <td>
                      <span className="di-status-val di-status-val-slate">
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
    </div>
  );
};