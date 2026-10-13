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
 * - Display values in UPPERCASE
 * - Fallback to "—" when null, empty, or unavailable (no inference)
 * - Consistent badge style matching Status badge (font weight, padding, border radius, alignment)
 */
export const ManagedByBadge: React.FC<ManagedByBadgeProps> = ({
  managedBy,
  className = '',
  fallback = '—',
}) => {
  const raw = (managedBy || '').toString().trim().toUpperCase();

  if (raw === 'GROUP') {
    return (
      <span
        className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-2xs leading-tight select-none whitespace-nowrap bg-emerald-100 text-emerald-800 border border-emerald-200/80 ${className}`}
        title="Managed By: GROUP"
      >
        GROUP
      </span>
    );
  }

  if (raw === 'INDIVIDUAL') {
    return (
      <span
        className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-2xs leading-tight select-none whitespace-nowrap bg-blue-100 text-blue-800 border border-blue-200/80 ${className}`}
        title="Managed By: INDIVIDUAL"
      >
        INDIVIDUAL
      </span>
    );
  }

  return <span className="text-slate-400 font-medium">{fallback}</span>;
};
