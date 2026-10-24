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
  Clock,
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
 * ACTIVE: #16A34A, EOL SOON: #D97706, EXPIRED: #DC2626, UNKNOWN: #64748B
 */
export const EOL_COLORS: Record<string, string> = {
  ACTIVE: '#16A34A',     // Green
  'EOL SOON': '#D97706', // Amber (0–90 days)
  EXPIRED: '#DC2626',    // Red
  UNKNOWN: '#64748B',    // Slate
};

export function getEolColor(status: string): string {
  const s = (status || '').trim().toUpperCase();
  if (s === 'ACTIVE' || s.startsWith('ACTIVE')) return '#16A34A';
  if (s === 'EOL SOON' || s === 'EOL_SOON' || s.includes('SOON')) return '#D97706';
  if (s === 'EXPIRED') return '#DC2626';
  if (s === 'UNKNOWN') return '#64748B';
  return EOL_COLORS[s] || '#64748B';
}

/**
 * Operating System Palette:
 * Windows 11: #2563EB | Windows 10: #F97316 | Mac: #16A34A
 */
export const OS_PALETTE: Record<string, string> = {
  'Windows 11': '#2563EB',
  'Windows 10': '#F97316',
  Mac: '#16A34A',
};

export function getOsColor(osName: string): string {
  const norm = (osName || '').trim();
  const lower = norm.toLowerCase();
  if (norm === 'Windows 11' || lower.includes('windows 11') || lower.includes('win 11') || lower.includes('win11')) {
    return '#2563EB';
  }
  if (norm === 'Windows 10' || lower.includes('windows 10') || lower.includes('win 10') || lower.includes('win10')) {
    return '#F97316';
  }
  if (norm === 'Mac' || lower.includes('mac') || lower.includes('apple') || lower.includes('macos') || lower.includes('os x')) {
    return '#16A34A';
  }
  return OS_PALETTE[norm] || '#2563EB';
}

/**
 * Device Type Palette:
 * Laptop: #DB2777 | Desktop: #EAB308
 */
export const DEVICE_TYPE_PALETTE: Record<string, string> = {
  Laptop: '#DB2777',
  Laptops: '#DB2777',
  Desktop: '#EAB308',
  Desktops: '#EAB308',
};

export function getDeviceTypeColor(deviceType: string): string {
  const norm = (deviceType || '').trim();
  const lower = norm.toLowerCase();
  if (lower.includes('laptop') || lower.includes('notebook')) {
    return '#DB2777';
  }
  if (lower.includes('desktop') || lower.includes('workstation')) {
    return '#EAB308';
  }
  return DEVICE_TYPE_PALETTE[norm] || '#DB2777';
}

/**
 * Category Palette:
 * STORE: #0D9488 | CORPORATE: #7C3AED
 */
export const CATEGORY_PALETTE: Record<string, string> = {
  STORE: '#0D9488',
  CORPORATE: '#7C3AED',
};

export function getCategoryColor(category: string): string {
  const norm = (category || '').trim().toUpperCase();
  if (norm.startsWith('STORE')) {
    return '#0D9488';
  }
  if (norm.startsWith('CORP')) {
    return '#7C3AED';
  }
  return CATEGORY_PALETTE[norm] || '#0D9488';
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
 * 1. #2563EB, 2. #0D9488, 3. #DB2777, 4. #D97706, 5. #7C3AED,
 * 6. #0891B2, 7. #65A30D, 8. #EA580C, 9. #4F46E5, 10. #A16207
 */
export const DEPARTMENT_PALETTE: string[] = [
  '#2563EB',
  '#0D9488',
  '#DB2777',
  '#D97706',
  '#7C3AED',
  '#0891B2',
  '#65A30D',
  '#EA580C',
  '#4F46E5',
  '#A16207',
];

export const DEPARTMENT_FALLBACK_PALETTE: string[] = [
  '#0284C7',
  '#9333EA',
  '#059669',
  '#E11D48',
  '#D97706',
  '#4F46E5',
  '#0D9488',
  '#475569',
  '#CA8A04',
  '#C026D3',
];

const INITIAL_DEPARTMENT_COLOR_MAP: Record<string, string> = {
  'engineering': '#2563EB',
  'finance': '#0D9488',
  'marketing': '#DB2777',
  'sales': '#D97706',
  'human resources': '#7C3AED',
  'hr': '#7C3AED',
  'security & compliance': '#0891B2',
  'security and compliance': '#0891B2',
  'security': '#0891B2',
  'product': '#65A30D',
  'contractor services': '#EA580C',
  'contractors': '#EA580C',
  'contractor': '#EA580C',
  'executive': '#4F46E5',
  'infrastructure': '#A16207',
};

const departmentColorCache = new Map<string, string>(
  Object.entries(INITIAL_DEPARTMENT_COLOR_MAP)
);

export function getDepartmentColor(departmentName: string): string {
  const raw = (departmentName || '').trim();
  if (!raw) return DEPARTMENT_PALETTE[0];
  const key = raw.toLowerCase();

  const cached = departmentColorCache.get(key);
  if (cached) return cached;

  const assignedColors = new Set(departmentColorCache.values());
  const nextAvailable = DEPARTMENT_PALETTE.find((c) => !assignedColors.has(c));

  let color: string;
  if (nextAvailable) {
    color = nextAvailable;
  } else {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const fallbackIdx = Math.abs(hash) % DEPARTMENT_FALLBACK_PALETTE.length;
    color = DEPARTMENT_FALLBACK_PALETTE[fallbackIdx];
  }

  departmentColorCache.set(key, color);
  return color;
}

/**
 * Coordinated palette for EOL Exposure by Hardware Model:
 * 1. #7C3AED, 2. #0284C7, 3. #CA8A04, 4. #DB2777, 5. #059669,
 * 6. #C2410C, 7. #4F46E5, 8. #0F766E, 9. #A21CAF, 10. #854D0E
 */
export const HARDWARE_MODEL_PALETTE: string[] = [
  '#7C3AED',
  '#0284C7',
  '#CA8A04',
  '#DB2777',
  '#059669',
  '#C2410C',
  '#4F46E5',
  '#0F766E',
  '#A21CAF',
  '#854D0E',
];

export const HARDWARE_MODEL_FALLBACK_PALETTE: string[] = [
  '#2563EB',
  '#0D9488',
  '#D97706',
  '#DC2626',
  '#65A30D',
  '#0891B2',
  '#EA580C',
  '#9333EA',
  '#475569',
  '#16A34A',
];

const INITIAL_MODEL_COLOR_MAP: Record<string, string> = {
  // 1. Lenovo ThinkPad X1 Carbon Gen 8
  'lenovo thinkpad x1 carbon gen 8': '#7C3AED',
  'thinkpad x1 carbon gen 8': '#7C3AED',
  'thinkpad x1 carbon g8': '#7C3AED',
  // 2. Apple Inc. MacBook Air 13" M1
  'apple inc. macbook air 13" m1': '#0284C7',
  'apple macbook air 13" m1': '#0284C7',
  'macbook air 13" m1': '#0284C7',
  // 3. HP Inc. EliteBook 840 G8
  'hp inc. elitebook 840 g8': '#CA8A04',
  'hp elitebook 840 g8': '#CA8A04',
  'elitebook 840 g8': '#CA8A04',
  // 4. Dell Inc. PowerEdge R640
  'dell inc. poweredge r640': '#DB2777',
  'dell poweredge r640': '#DB2777',
  'poweredge r640': '#DB2777',
  // 5. Cisco Systems UCS B200 M5 Blade
  'cisco systems ucs b200 m5 blade': '#059669',
  'cisco ucs b200 m5 blade': '#059669',
  'ucs b200 m5 blade': '#059669',
  'ucs b200 m5': '#059669',
  // 6. Apple Inc. MacBook Pro 14" M1 Pro
  'apple inc. macbook pro 14" m1 pro': '#C2410C',
  'apple macbook pro 14" m1 pro': '#C2410C',
  'macbook pro 14" m1 pro': '#C2410C',
  // 7. Generic / Custom Build Custom Rack Unit
  'generic / custom build custom rack unit': '#4F46E5',
  'custom rack unit': '#4F46E5',
  // 8. MacBook Pro 16" M2 Pro
  'macbook pro 16" m2 pro': '#0F766E',
  'apple inc. macbook pro 16" m2 pro': '#0F766E',
  // 9. Precision 7680 Workstation
  'precision 7680 workstation': '#A21CAF',
  'dell inc. precision 7680 workstation': '#A21CAF',
  'precision 7680': '#A21CAF',
  // 10. ThinkPad T14s Gen 4
  'thinkpad t14s gen 4': '#854D0E',
  'lenovo thinkpad t14s gen 4': '#854D0E',
  'thinkpad t14s g4': '#854D0E',
};

const hardwareModelColorCache = new Map<string, string>(
  Object.entries(INITIAL_MODEL_COLOR_MAP)
);

export function getHardwareModelColor(modelName: string): string {
  const raw = (modelName || '').trim();
  if (!raw) return HARDWARE_MODEL_PALETTE[0];
  const key = raw.toLowerCase();

  const cached = hardwareModelColorCache.get(key);
  if (cached) return cached;

  const simplified = key
    .replace(/\b(apple\s+inc\.?|apple|dell\s+inc\.?|dell|lenovo|hp\s+inc\.?|hp|cisco\s+systems|cisco)\b/gi, '')
    .trim();
  if (simplified && hardwareModelColorCache.has(simplified)) {
    const col = hardwareModelColorCache.get(simplified)!;
    hardwareModelColorCache.set(key, col);
    return col;
  }

  const assignedColors = new Set(hardwareModelColorCache.values());
  const nextAvailable = HARDWARE_MODEL_PALETTE.find((c) => !assignedColors.has(c));

  let color: string;
  if (nextAvailable) {
    color = nextAvailable;
  } else {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const fallbackIdx = Math.abs(hash) % HARDWARE_MODEL_FALLBACK_PALETTE.length;
    color = HARDWARE_MODEL_FALLBACK_PALETTE[fallbackIdx];
  }

  hardwareModelColorCache.set(key, color);
  if (simplified) {
    hardwareModelColorCache.set(simplified, color);
  }
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
  tone: 'total' | 'active' | 'review' | 'stock' | 'employees' | 'eol_soon';
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
    const rawMap =
      hardwareData?.byOs ??
      hardwareData?.by_os ??
      hardwareData?.byOperatingSystem ??
      hardwareData?.by_operating_system ??
      data?.by_operating_system;
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
      { name: 'Windows 11', count: win11Count, color: getOsColor('Windows 11') }, // #2563EB
      { name: 'Windows 10', count: win10Count, color: getOsColor('Windows 10') }, // #F97316
      { name: 'Mac', count: macCount, color: getOsColor('Mac') },                 // #16A34A
    ];

    const apiTotalOs =
      hardwareData?.total_os_assets ??
      hardwareData?.totalOsAssets ??
      hardwareData?.total_operating_system_assets ??
      hardwareData?.totalOperatingSystemAssets ??
      (data as any)?.total_os_assets ??
      (data as any)?.totalOsAssets;

    const total =
      typeof apiTotalOs === 'number' && !isNaN(apiTotalOs) && apiTotalOs >= 0
        ? apiTotalOs
        : (win11Count + win10Count + macCount);

    return { items, total };
  }, [hardwareData, data]);

  // Section B: By Device Type (Donut Chart)
  // Shows authoritative counts for Laptops and Desktops without duplicate summing
  const deviceTypeChartData = useMemo(() => {
    const rawMap =
      hardwareData?.byDevice ??
      hardwareData?.by_device ??
      hardwareData?.byDeviceType ??
      hardwareData?.by_device_type ??
      data?.by_device_type;
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
      // Exclude composite category keys and totals
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
      { name: 'Laptops', count: laptopCount, color: getDeviceTypeColor('Laptops') },  // #DB2777
      { name: 'Desktops', count: desktopCount, color: getDeviceTypeColor('Desktops') }, // #EAB308
    ];

    const apiTotalDevice =
      hardwareData?.total_device_assets ??
      hardwareData?.totalDeviceAssets ??
      hardwareData?.total_device_type_assets ??
      hardwareData?.totalDeviceTypeAssets ??
      (data as any)?.total_device_assets ??
      (data as any)?.totalDeviceAssets;

    const total =
      typeof apiTotalDevice === 'number' && !isNaN(apiTotalDevice) && apiTotalDevice >= 0
        ? apiTotalDevice
        : (laptopCount + desktopCount);

    return { items, total };
  }, [hardwareData, data]);

  // Section C: By Category (Donut Chart)
  // Shows ONLY: STORE (#0D9488) and CORPORATE (#7C3AED)
  // Does not mix devicetype values (Laptop, Desktop, etc.) and uses revised by_category / byCategory schema
  const categoryChartData = useMemo(() => {
    const rawData =
      hardwareData?.byCategory ??
      hardwareData?.by_category ??
      (data as any)?.by_category ??
      (data as any)?.byCategory;

    let storeCount = 0;
    let corporateCount = 0;
    let apiStorePct: number | undefined = undefined;
    let apiCorpPct: number | undefined = undefined;

    if (rawData && typeof rawData === 'object') {
      if (Array.isArray(rawData)) {
        for (const item of rawData) {
          if (!item || typeof item !== 'object') continue;
          const rawKey = String(item.name || item.category || (item as any).key || '').trim().toUpperCase();
          const count = typeof item.count === 'number' ? item.count : Number(item.count || item.total || 0) || 0;
          const pct =
            typeof item.percentage === 'number'
              ? item.percentage
              : typeof (item as any).percent === 'number'
              ? (item as any).percent
              : undefined;

          // Strictly accept only STORE and CORPORATE; do not mix devicetype values
          if (rawKey === 'STORE' || rawKey === 'STORES') {
            storeCount += count;
            if (pct !== undefined && !isNaN(pct)) apiStorePct = pct;
          } else if (rawKey === 'CORPORATE' || rawKey === 'CORP') {
            corporateCount += count;
            if (pct !== undefined && !isNaN(pct)) apiCorpPct = pct;
          }
        }
      } else {
        // Dictionary format: e.g. { STORE: 120, CORPORATE: 350 }
        for (const [key, val] of Object.entries(rawData)) {
          if (!key) continue;
          const upper = key.trim().toUpperCase();
          const count = typeof val === 'number' ? val : Number(val) || 0;

          // Strictly accept only STORE and CORPORATE; do not mix devicetype values
          if (upper === 'STORE' || upper === 'STORES') {
            storeCount += count;
          } else if (upper === 'CORPORATE' || upper === 'CORP') {
            corporateCount += count;
          }
        }
      }
    }

    // Category Total: Use total_category_assets / totalCategoryAssets where available
    const apiTotalCategory =
      hardwareData?.total_category_assets ??
      hardwareData?.totalCategoryAssets ??
      (hardwareData as any)?.total_category ??
      (hardwareData as any)?.totalCategory ??
      (data as any)?.total_category_assets ??
      (data as any)?.totalCategoryAssets;

    const total =
      typeof apiTotalCategory === 'number' && !isNaN(apiTotalCategory) && apiTotalCategory >= 0
        ? apiTotalCategory
        : (storeCount + corporateCount);

    // Calculate exact percentages returned or calculated from the category counts
    const storePercentage =
      apiStorePct !== undefined
        ? apiStorePct
        : total > 0
        ? Number(((storeCount / total) * 100).toFixed(1))
        : 0;

    const corporatePercentage =
      apiCorpPct !== undefined
        ? apiCorpPct
        : total > 0
        ? Number(((corporateCount / total) * 100).toFixed(1))
        : 0;

    // Display both categories consistently, including categories with zero assets
    const items = [
      {
        name: 'STORE',
        count: storeCount,
        percentage: storePercentage,
        color: getCategoryColor('STORE'), // #0D9488
      },
      {
        name: 'CORPORATE',
        count: corporateCount,
        percentage: corporatePercentage,
        color: getCategoryColor('CORPORATE'), // #7C3AED
      },
    ];

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
        color: getEolColor('ACTIVE'), // #16A34A
      },
      {
        key: 'EOL SOON',
        label: 'EOL soon (0–90 days)',
        count: countMap['EOL SOON'],
        color: getEolColor('EOL SOON'), // #D97706
      },
      {
        key: 'EXPIRED',
        label: 'Expired',
        count: countMap.EXPIRED,
        color: getEolColor('EXPIRED'), // #DC2626
      },
      {
        key: 'UNKNOWN',
        label: 'Unknown',
        count: countMap.UNKNOWN,
        color: getEolColor('UNKNOWN'), // #64748B
      },
    ];

    const totalFleet =
      data?.kpis?.total_assets ||
      items.reduce((sum, item) => sum + item.count, 0);

    return { items, totalFleet };
  }, [data]);

  const eolSoonCount = useMemo(() => {
    return (
      (data?.kpis as any)?.eol_soon ??
      eolStatusDistribution.items.find((item) => item.key === 'EOL SOON')?.count ??
      0
    );
  }, [data, eolStatusDistribution]);

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

      {/* Row 0 — Six KPI Cards */}
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
          label="EOL SOON"
          value={eolSoonCount}
          subtitle="Within 0–90 days"
          tone="eol_soon"
          icon={<Clock className="w-4 h-4" />}
          testId="kpi-card-eol-soon"
          valTestId="kpi-value-eol-soon"
          secondaryTestId="kpi-card-eol-soon-count"
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
                    <i className="di-source-legend-dot" style={{ backgroundColor: getDeviceTypeColor('Laptops') }} />
                    <span className="di-source-legend-name">Laptops</span>
                    <span className="di-source-legend-count">
                      {formatNumber(deviceTypeChartData.items[0]?.count)}
                    </span>
                  </span>
                  <span className="di-source-legend-item">
                    <i className="di-source-legend-dot" style={{ backgroundColor: getDeviceTypeColor('Desktops') }} />
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
              >
                <div className="di-hardware-section-header">
                  <span className="di-hardware-section-title">By Category</span>
                </div>

                {/* Legend showing STORE and CORPORATE horizontally with exact counts and percentages */}
                <div className="di-section-legend-line">
                  <span className="di-source-legend-item">
                    <i className="di-source-legend-dot" style={{ backgroundColor: getCategoryColor('STORE') }} />
                    <span className="di-source-legend-name">STORE</span>
                    <span className="di-source-legend-count">
                      {formatNumber(categoryChartData.items[0]?.count)} ({categoryChartData.items[0]?.percentage !== undefined ? `${categoryChartData.items[0].percentage}%` : formatChartPercentage(categoryChartData.items[0]?.count, categoryChartData.total)})
                    </span>
                  </span>
                  <span className="di-source-legend-item">
                    <i className="di-source-legend-dot" style={{ backgroundColor: getCategoryColor('CORPORATE') }} />
                    <span className="di-source-legend-name">CORPORATE</span>
                    <span className="di-source-legend-count">
                      {formatNumber(categoryChartData.items[1]?.count)} ({categoryChartData.items[1]?.percentage !== undefined ? `${categoryChartData.items[1].percentage}%` : formatChartPercentage(categoryChartData.items[1]?.count, categoryChartData.total)})
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
                            formatter={(value: any, name: any) => {
                              const found = categoryChartData.items.find((i) => i.name === String(name));
                              const pctStr =
                                found?.percentage !== undefined
                                  ? `${found.percentage}%`
                                  : formatChartPercentage(Number(value), categoryChartData.total);
                              return [`${formatNumber(value)} assets (${pctStr})`, String(name)];
                            }}
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
                        fill={getDepartmentColor(dept.department)}
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
                          fill={getHardwareModelColor(item.originalModel || item.model || item.shortModel)}
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