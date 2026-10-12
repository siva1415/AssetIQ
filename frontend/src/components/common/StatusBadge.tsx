import React from 'react';
import { AssetStatus, AssignmentType, EOLStatus, EmployeeStatus, WorkdayMatchStatus } from '../../types';

interface StatusBadgeProps {
  status: AssetStatus | AssignmentType | EOLStatus | EmployeeStatus | WorkdayMatchStatus | string;
  type?: 'asset_status' | 'eol_status' | 'assignment' | 'workday' | 'employee';
  variant?: 'solid' | 'subtle';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type,
  variant = 'subtle',
  className = '',
}) => {
  const rawStatus = (status || '').toString().trim();
  const s = rawStatus.toLowerCase().replace(/\s+/g, '');

  // Solid full colored badge variant matching SourceBadge visual style:
  // - Padding, height, border radius, font-bold, shadow-2xs, select-none
  // - Active -> Green background with white text
  // - Need Validation / Nearing EOL -> Amber/orange background with dark, readable text
  // - InStock / In Stock -> Blue-gray background with white text
  // - Expired -> Red background with white text
  // - Inactive / Unknown or other statuses -> Neutral gray background with white text
  if (variant === 'solid' || type === 'asset_status' || type === 'eol_status' || type === 'employee') {
    let solidColorClass = 'bg-slate-500 text-white';

    if (s === 'active') {
      solidColorClass = 'bg-emerald-600 text-white';
    } else if (s === 'needvalidation' || s === 'nearingeol') {
      solidColorClass = 'bg-amber-400 text-amber-950';
    } else if (s === 'instock' || s === 'stock') {
      solidColorClass = 'bg-slate-600 text-white';
    } else if (s === 'expired') {
      solidColorClass = 'bg-rose-600 text-white';
    } else if (s === 'inactive' || s === 'unknown' || !rawStatus) {
      solidColorClass = 'bg-slate-500 text-white';
    } else {
      solidColorClass = 'bg-slate-500 text-white';
    }

    const displayStatus = rawStatus || 'Unknown';

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
  // Green (#16A34A / emerald), Amber (#D97706 / amber), Crimson (#DC2626 / red), Slate for neutral
  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let indicatorColor = 'bg-slate-400';

  const origLower = rawStatus.toLowerCase();
  if (origLower === 'active' || origLower === 'matched' || origLower === 'automatic') {
    bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    indicatorColor = 'bg-emerald-600';
  } else if (
    origLower === 'need validation' ||
    origLower === 'nearing eol' ||
    origLower === 'in stock' ||
    origLower === 'on leave' ||
    origLower === 'manual'
  ) {
    bgClass = 'bg-amber-50 text-amber-800 border-amber-200';
    indicatorColor = 'bg-amber-600';
  } else if (
    origLower === 'expired' ||
    origLower === 'terminated' ||
    origLower === 'inactive' ||
    origLower === 'retired' ||
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

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${bgClass} whitespace-nowrap ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor} shrink-0`} aria-hidden="true" />
      <span>{rawStatus || '—'}</span>
    </span>
  );
};
