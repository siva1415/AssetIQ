import React from 'react';

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, className = '' }) => {
  const normSource = (source || '').trim().toUpperCase();
  const isJamf = normSource === 'JAMF';
  const isBigFix = normSource === 'BIGFIX';

  // Enterprise solid color styling:
  // BIGFIX -> Rich enterprise blue
  // JAMF   -> Rich enterprise pink
  const colorClass = isJamf
    ? 'bg-pink-600 text-white'
    : isBigFix
    ? 'bg-blue-600 text-white'
    : 'bg-slate-700 text-white';

  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider whitespace-nowrap shrink-0 ${colorClass} shadow-2xs leading-tight select-none ${className}`}
      title={`Source: ${normSource}`}
    >
      {normSource || 'UNKNOWN'}
    </span>
  );
};
