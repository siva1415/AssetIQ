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
  // JAMF   -> Rich enterprise purple
  const colorClass = isJamf
    ? 'bg-purple-600 text-white'
    : isBigFix
    ? 'bg-blue-600 text-white'
    : 'bg-slate-700 text-white';

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${colorClass} shadow-2xs leading-tight select-none ${className}`}
      title={`Source: ${normSource}`}
    >
      {normSource || 'UNKNOWN'}
    </span>
  );
};
