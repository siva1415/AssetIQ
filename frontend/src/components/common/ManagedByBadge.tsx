import React from 'react';

interface ManagedByBadgeProps {
  managedBy?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Consistent Managed By badge:
 * - GROUP: light green background with readable dark green text
 * - INDIVIDUAL: blue background with readable blue-toned text
 * - Present values: displays actual value
 * - Fallback to "-" when null, empty, or whitespace (no inference)
 * - Consistent badge style matching Status badge (font weight, padding, border radius, alignment)
 */
export const ManagedByBadge: React.FC<ManagedByBadgeProps> = ({
  managedBy,
  className = '',
  fallback = '-',
}) => {
  if (managedBy === null || managedBy === undefined) {
    return <span className="text-slate-400 font-medium">{fallback}</span>;
  }

  const raw = String(managedBy).trim();
  if (
    raw.length === 0 ||
    raw.toLowerCase() === 'null' ||
    raw.toLowerCase() === 'none' ||
    raw.toLowerCase() === 'undefined'
  ) {
    return <span className="text-slate-400 font-medium">{fallback}</span>;
  }

  const upper = raw.toUpperCase();

  if (upper === 'GROUP') {
    return (
      <span
        className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-2xs leading-tight select-none whitespace-nowrap bg-emerald-100 text-emerald-800 border border-emerald-200/80 ${className}`}
        title="Managed By: GROUP"
      >
        GROUP
      </span>
    );
  }

  if (upper === 'INDIVIDUAL') {
    return (
      <span
        className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-2xs leading-tight select-none whitespace-nowrap bg-blue-100 text-blue-800 border border-blue-200/80 ${className}`}
        title="Managed By: INDIVIDUAL"
      >
        INDIVIDUAL
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-2xs leading-tight select-none whitespace-nowrap bg-slate-100 text-slate-800 border border-slate-200/80 ${className}`}
      title={`Managed By: ${raw}`}
    >
      {raw}
    </span>
  );
};
