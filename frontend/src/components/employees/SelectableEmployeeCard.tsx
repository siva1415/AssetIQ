import React from 'react';
import { Mail, Building } from 'lucide-react';

export interface SelectableEmployeeCardProps {
  fullName: string;
  userId: string;
  jobTitle?: string | null;
  workEmail?: string | null;
  department?: string | null;
  isSelected: boolean;
  onSelect: () => void;
  selectionType?: 'radio' | 'checkbox';
  name?: string;
}

export const getInitials = (name: string): string => {
  if (!name || name === '—') return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const SelectableEmployeeCard: React.FC<SelectableEmployeeCardProps> = ({
  fullName,
  userId,
  jobTitle,
  workEmail,
  department,
  isSelected,
  onSelect,
  selectionType = 'radio',
  name = 'selectableEmployee',
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all cursor-pointer gap-2.5 sm:gap-4 ${
        isSelected
          ? 'bg-blue-50/75 border-blue-400 ring-1 ring-blue-500/20 shadow-xs'
          : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Selection indicator, Avatar, Name & ID */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <input
          type={selectionType}
          name={name}
          checked={isSelected}
          onChange={onSelect}
          onClick={e => e.stopPropagation()}
          className={`${
            selectionType === 'radio' ? 'rounded-full' : 'rounded'
          } border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer shrink-0`}
          aria-label={`Select ${fullName || userId}`}
        />

        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          {getInitials(fullName || userId)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-xs">
              {fullName || '—'}
            </span>
            <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 shrink-0 font-medium">
              {userId}
            </span>
          </div>
          {jobTitle && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {jobTitle}
            </p>
          )}
        </div>
      </div>

      {/* Email & Department */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-2.5 sm:gap-4 pl-11 sm:pl-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline-block" />
          <span
            className="font-mono text-[11px] truncate max-w-[160px] sm:max-w-[200px]"
            title={workEmail || ''}
          >
            {workEmail || '—'}
          </span>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 rounded-md border border-slate-200 whitespace-nowrap shrink-0"
          >
            <Building className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="whitespace-nowrap">{department || '—'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
