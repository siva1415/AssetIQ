import React from 'react';
import {
  AssetStatus,
  AssignmentType,
  EOLStatus,
  EmployeeStatus,
  WorkdayMatchStatus,
  toStandardAssetStatus,
  toStandardEOLStatus,
  ASSET_STATUS_LABELS,
  ASSET_STATUSES,
} from '../../types';

interface StatusBadgeProps {
  status: AssetStatus | AssignmentType | EOLStatus | EmployeeStatus | WorkdayMatchStatus | string;
  type?: 'asset_status' | 'eol_status' | 'assignment' | 'workday' | 'employee';
  variant?: 'solid' | 'subtle';
  uppercase?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type,
  variant,
  uppercase = false,
  className = '',
}) => {
  const rawStatus = (status || '').toString().trim();
  const s = rawStatus.toLowerCase().replace(/[\s_]+/g, '');

  // Format display text in uppercase for operational asset status, EOL status, assignment, or explicit uppercase prop
  let displayStatus = rawStatus || 'Unknown';
  if (type === 'eol_status') {
    displayStatus = toStandardEOLStatus(rawStatus);
  } else if (type === 'asset_status' || (!type && (s === 'active' || s === 'review' || s === 'needvalidation' || s === 'instock' || s === 'retired'))) {
    if (!rawStatus) {
      displayStatus = 'UNKNOWN';
    } else {
      const upper = rawStatus.toUpperCase().replace(/_/g, ' ');
      if (upper === 'ACTIVE') {
        displayStatus = 'ACTIVE';
      } else if (upper === 'REVIEW' || upper === 'NEED VALIDATION' || upper === 'NEEDVALIDATION') {
        displayStatus = 'REVIEW';
      } else if (upper === 'IN STOCK' || upper === 'INSTOCK') {
        displayStatus = 'IN STOCK';
      } else if (upper === 'RETIRED') {
        displayStatus = 'RETIRED';
      } else {
        displayStatus = toStandardAssetStatus(rawStatus);
      }
    }
  } else if (type === 'assignment') {
    const norm = rawStatus.toUpperCase().trim();
    if (norm === 'AUTOMATIC' || norm === 'AUTO' || norm.startsWith('AUTO')) {
      displayStatus = 'AUTO';
    } else if (norm === 'MANUAL' || norm.startsWith('MANUAL')) {
      displayStatus = 'MANUAL';
    } else if (norm === 'UNASSIGNED') {
      displayStatus = 'UNASSIGNED';
    } else {
      displayStatus = norm || 'UNASSIGNED';
    }
  } else if (type === 'employee' || uppercase) {
    displayStatus = (rawStatus || 'Unknown').toUpperCase();
  }

  // Solid full colored badge variant matching Asset Status / EOL badge visual style:
  // - Padding, height, border radius, font-bold, shadow-2xs, select-none
  // - Active -> Green background with white text (bg-emerald-600 text-white)
  // - Assignment MANUAL -> Orange badge (bg-orange-500 text-white)
  // - Assignment AUTO / AUTOMATIC -> Light green badge (bg-green-500 text-white)
  // - Review / EOL Soon -> Amber/orange background with dark, readable text
  // - InStock / In Stock -> Light blue background with readable blue text (bg-sky-100 text-sky-800 border border-sky-300)
  // - Retired -> Light gray background with readable dark gray text (bg-slate-100 text-slate-700 border border-slate-300)
  // - Expired -> Rose/crimson background with white text
  // - Inactive / Unknown or other statuses -> Neutral gray background with white text
  const isSolidBadge =
    variant === 'solid' ||
    (variant !== 'subtle' && (
      type === 'asset_status' ||
      type === 'eol_status' ||
      type === 'assignment' ||
      (!type && (s === 'active' || s === 'review' || s === 'needvalidation' || s === 'instock' || s === 'retired')) ||
      (type === 'employee' && (s === 'active' || s === 'notinworkday' || s === 'notfoundinworkday'))
    ));

  if (isSolidBadge) {
    let solidColorClass = 'bg-slate-500 text-white';

    if (type === 'eol_status') {
      // Standard EOL Status Palette:
      // ACTIVE: Green (keep existing active styling: bg-emerald-600 text-white)
      // EOL SOON: Amber (amber background with readable dark text: bg-amber-400 text-amber-950)
      // EXPIRED: Red (red background with white text: bg-rose-600 text-white)
      // UNKNOWN: Gray (neutral gray background with white text: bg-slate-500 text-white)
      if (displayStatus === 'ACTIVE') {
        solidColorClass = 'bg-emerald-600 text-white';
      } else if (displayStatus === 'EOL SOON') {
        solidColorClass = 'bg-amber-400 text-amber-950';
      } else if (displayStatus === 'EXPIRED') {
        solidColorClass = 'bg-rose-600 text-white';
      } else {
        solidColorClass = 'bg-slate-500 text-white';
      }
    } else if (type === 'assignment') {
      if (displayStatus === 'MANUAL') {
        solidColorClass = 'bg-orange-500 text-white';
      } else if (displayStatus === 'AUTO') {
        solidColorClass = 'bg-green-500 text-white';
      } else {
        solidColorClass = 'bg-slate-500 text-white';
      }
    } else if (type === 'asset_status' || s === 'active' || s === 'review' || s === 'needvalidation' || s === 'instock' || s === 'retired') {
      // Asset Status palette:
      // ACTIVE: Green (keep existing green styling unchanged: bg-emerald-600 text-white)
      // REVIEW: Amber (amber background with readable amber/dark text: bg-amber-400 text-amber-950)
      // IN STOCK: Light Blue (light blue background with readable blue text: bg-sky-100 text-sky-800 border border-sky-300)
      // RETIRED: Gray (light gray background with readable dark gray text: bg-slate-100 text-slate-700 border border-slate-300)
      if (s === 'active') {
        solidColorClass = 'bg-emerald-600 text-white';
      } else if (s === 'review' || s === 'needvalidation') {
        solidColorClass = 'bg-amber-400 text-amber-950';
      } else if (s === 'instock' || s === 'stock') {
        solidColorClass = 'bg-sky-100 text-sky-800 border border-sky-300';
      } else if (s === 'retired') {
        solidColorClass = 'bg-slate-100 text-slate-700 border border-slate-300';
      } else if (s === 'inactive' || s === 'unknown' || !rawStatus) {
        solidColorClass = 'bg-slate-500 text-white';
      } else {
        solidColorClass = 'bg-slate-500 text-white';
      }
    } else if (s === 'review' || s === 'needvalidation' || s === 'nearingeol' || s === 'eolsoon') {
      solidColorClass = 'bg-amber-400 text-amber-950';
    } else if (s === 'instock' || s === 'stock') {
      solidColorClass = 'bg-sky-100 text-sky-800 border border-sky-300';
    } else if (s === 'retired') {
      solidColorClass = 'bg-slate-100 text-slate-700 border border-slate-300';
    } else if (s === 'expired' || s === 'notinworkday' || s === 'notfoundinworkday') {
      solidColorClass = 'bg-rose-600 text-white';
    } else if (s === 'inactive' || s === 'unknown' || !rawStatus) {
      solidColorClass = 'bg-slate-500 text-white';
    } else {
      solidColorClass = 'bg-slate-500 text-white';
    }

    return (
      <span
        className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${solidColorClass} shadow-2xs leading-tight select-none whitespace-nowrap ${className}`}
        title={`Status: ${displayStatus}`}
      >
        {displayStatus}
      </span>
    );
  }

  // Color mapping based on semantic enterprise status guidelines:
  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let indicatorColor = 'bg-slate-400';

  if (type === 'eol_status') {
    if (displayStatus === 'ACTIVE') {
      bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      indicatorColor = 'bg-emerald-600';
    } else if (displayStatus === 'EOL SOON') {
      bgClass = 'bg-amber-50 text-amber-800 border-amber-200';
      indicatorColor = 'bg-amber-600';
    } else if (displayStatus === 'EXPIRED') {
      bgClass = 'bg-rose-50 text-rose-800 border-rose-200';
      indicatorColor = 'bg-rose-600';
    } else {
      bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
      indicatorColor = 'bg-slate-400';
    }
  } else {
    const origLower = rawStatus.toLowerCase().replace(/_/g, ' ');
    if (origLower === 'active' || origLower === 'matched' || origLower === 'automatic') {
      bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      indicatorColor = 'bg-emerald-600';
    } else if (
      origLower === 'review' ||
      origLower === 'need validation' ||
      origLower === 'eol soon' ||
      origLower === 'nearing eol' ||
      origLower === 'on leave' ||
      origLower === 'manual'
    ) {
      bgClass = 'bg-amber-50 text-amber-800 border-amber-200';
      indicatorColor = 'bg-amber-600';
    } else if (origLower === 'in stock') {
      bgClass = 'bg-sky-50 text-sky-800 border-sky-200';
      indicatorColor = 'bg-sky-600';
    } else if (origLower === 'retired') {
      bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
      indicatorColor = 'bg-slate-500';
    } else if (
      origLower === 'expired' ||
      origLower === 'terminated' ||
      origLower === 'inactive' ||
      origLower === 'not found in workday' ||
      origLower === 'not in workday' ||
      origLower === 'admin account'
    ) {
      bgClass = 'bg-rose-50 text-rose-800 border-rose-200';
      indicatorColor = 'bg-rose-600';
    } else if (origLower === 'unassigned' || origLower === 'unknown' || !rawStatus) {
      bgClass = 'bg-slate-100 text-slate-600 border-slate-200';
      indicatorColor = 'bg-slate-500';
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${bgClass} whitespace-nowrap ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor} shrink-0`} aria-hidden="true" />
      <span>{displayStatus || '—'}</span>
    </span>
  );
};
