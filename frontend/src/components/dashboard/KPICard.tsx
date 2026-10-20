import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  subtitle?: string;
  colorTheme?: 'default' | 'blue' | 'emerald' | 'amber' | 'orange' | 'rose';
  onClick?: () => void;
  compact?: boolean;
  loading?: boolean;
  error?: string | boolean | null;
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  icon: Icon,
  subtitle,
  colorTheme = 'default',
  onClick,
  compact = false,
  loading = false,
  error = null,
}) => {
  const themeStyles = {
    default: {
      iconBg: 'bg-slate-100 text-slate-700',
      border: 'border-slate-200',
      valColor: 'text-slate-900',
    },
    blue: {
      iconBg: 'bg-blue-50 text-blue-700',
      border: 'border-blue-200',
      valColor: 'text-blue-900',
    },
    emerald: {
      iconBg: 'bg-emerald-50 text-emerald-700',
      border: 'border-emerald-200',
      valColor: 'text-emerald-900',
    },
    amber: {
      iconBg: 'bg-amber-50 text-amber-700',
      border: 'border-amber-200',
      valColor: 'text-amber-900',
    },
    orange: {
      iconBg: 'bg-orange-50 text-orange-700',
      border: 'border-orange-200',
      valColor: 'text-orange-900',
    },
    rose: {
      iconBg: 'bg-rose-50 text-rose-700',
      border: 'border-rose-200',
      valColor: 'text-rose-900',
    },
  };

  const currentTheme = themeStyles[colorTheme] || themeStyles.default;

  const slug = label.toLowerCase().replace(/[\s_]+/g, '-');
  const isInstock = slug === 'instock' || slug === 'in-stock';
  const cardTestId = isInstock ? 'kpi-card-instock' : `kpi-card-${slug}`;
  const valueTestId = isInstock ? 'kpi-value-instock' : `kpi-value-${slug}`;

  const formatValue = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined) return '0';
    if (typeof val === 'number') {
      return isNaN(val) ? '0' : val.toLocaleString();
    }
    const parsed = Number(val);
    if (!isNaN(parsed) && String(val).trim() !== '') {
      return parsed.toLocaleString();
    }
    const str = String(val).trim();
    return str || '0';
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        data-testid={cardTestId}
        {...(isInstock ? { 'data-secondary-testid': 'kpi-card-in-stock' } : {})}
        data-kpi-label={label}
        data-kpi-value={formatValue(value)}
        className={`px-2.5 py-1.5 bg-white rounded-lg border ${currentTheme.border} shadow-2xs transition-all h-full flex flex-col justify-between ${
          onClick ? 'cursor-pointer hover:border-blue-400 hover:shadow-xs' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate" title={label}>
            {label}
          </span>
          <div className={`p-0.5 rounded ${currentTheme.iconBg} shrink-0`}>
            <Icon className="w-3 h-3" />
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-0.5">
          {loading ? (
            <div
              className="h-4 w-12 bg-slate-200 animate-pulse rounded my-0.5"
              role="status"
              aria-label={`Loading ${label}...`}
            />
          ) : error ? (
            <span
              className="text-[13px] font-mono text-rose-500 font-semibold cursor-help"
              title={typeof error === 'string' ? error : 'Error loading metric'}
            >
              —
            </span>
          ) : (
            <span
              data-testid={valueTestId}
              {...(isInstock ? { 'data-secondary-testid': 'kpi-value-in-stock' } : {})}
              className={`text-[15px] sm:text-base font-bold font-mono tracking-tight tabular-nums leading-tight ${currentTheme.valColor}`}
            >
              {formatValue(value)}
            </span>
          )}
        </div>

        {subtitle && (
          <div className="text-[9px] text-slate-400 mt-0.5 truncate leading-tight" title={subtitle}>
            {subtitle}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      data-testid={cardTestId}
      {...(isInstock ? { 'data-secondary-testid': 'kpi-card-in-stock' } : {})}
      data-kpi-label={label}
      data-kpi-value={formatValue(value)}
      className={`p-4 bg-white rounded-lg border ${currentTheme.border} shadow-2xs transition-all ${
        onClick ? 'cursor-pointer hover:border-blue-400 hover:shadow-xs' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-500 truncate" title={label}>
          {label}
        </span>
        <div className={`p-1.5 rounded ${currentTheme.iconBg} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        {loading ? (
          <div
            className="h-7 w-20 bg-slate-200 animate-pulse rounded my-1"
            role="status"
            aria-label={`Loading ${label}...`}
          />
        ) : error ? (
          <span
            className="text-xl font-bold font-mono text-rose-500 cursor-help"
            title={typeof error === 'string' ? error : 'Error loading metric'}
          >
            —
          </span>
        ) : (
          <span
            data-testid={valueTestId}
            {...(isInstock ? { 'data-secondary-testid': 'kpi-value-in-stock' } : {})}
            className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${currentTheme.valColor}`}
          >
            {formatValue(value)}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="text-[11px] text-slate-400 mt-1 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};
