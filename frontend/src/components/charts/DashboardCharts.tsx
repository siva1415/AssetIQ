import React from 'react';
import { Building2, AlertCircle, RefreshCw, Activity, HardDrive } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  AssetsBySourceItem,
  OwnershipSummaryItem,
  EOLSummaryItem,
  OperationalStatusItem,
  DepartmentDistributionItem,
} from '../../types';

// Custom enterprise palette
const SOURCE_COLORS = ['#2563EB', '#0D9488']; // BigFix: Royal Blue, Jamf: Teal
const OWNERSHIP_COLORS = ['#16A34A', '#2563EB', '#64748B']; // Auto: Emerald, Manual: Blue, Unassigned: Slate
const EOL_COLORS = ['#16A34A', '#D97706', '#DC2626', '#94A3B8']; // Active, Nearing, Expired, Unknown

interface SourceChartProps {
  data?: AssetsBySourceItem[] | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const SourceChart: React.FC<SourceChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  // Extract and sanitize array data defensively
  let chartData: AssetsBySourceItem[] = [];
  if (Array.isArray(data)) {
    chartData = data;
  } else if (data && typeof data === 'object') {
    const raw = data as any;
    if (Array.isArray(raw.data)) chartData = raw.data;
    else if (Array.isArray(raw.sources)) chartData = raw.sources;
    else if (Array.isArray(raw.source_summary)) chartData = raw.source_summary;
    else if (Array.isArray(raw.assets_by_source)) chartData = raw.assets_by_source;
    else if (Array.isArray(raw.items)) chartData = raw.items;
    else if (Array.isArray(raw.results)) chartData = raw.results;
  }

  const validData = chartData.filter(
    item => item && typeof item === 'object' && typeof (item.source ?? (item as any).name) === 'string'
  );

  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Assets by Source</h3>
      <p className="text-xs text-slate-500 mb-4">Discovery platform telemetry (BigFix vs Jamf Pro)</p>

      {loading ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs font-medium text-slate-600">Loading assets by source...</span>
        </div>
      ) : error ? (
        <div className="h-56 w-full flex flex-col items-center justify-center p-4 text-center">
          <div className="p-2 rounded-full bg-rose-50 text-rose-600 mb-2">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-rose-950 mb-1">Failed to load source summary</p>
          <p className="text-[11px] text-slate-500 max-w-xs mb-3 truncate" title={error}>
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      ) : validData.length === 0 ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <HardDrive className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-700 mb-0.5">No Source Data</p>
          <p className="text-[11px] text-slate-400">No discovery telemetry records available.</p>
        </div>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={validData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="source"
                >
                  {validData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} devices`, name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px', borderRadius: '6px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs mt-2">
            {validData.map((item, idx) => (
              <div key={item.source || idx} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length] }}
                />
                <span className="text-slate-600 font-medium truncate">
                  {String(item.source || 'Unknown').split(' ')[0]}
                </span>
                <span className="font-mono text-slate-900 font-semibold">({item.count ?? 0})</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface OwnershipChartProps {
  data: OwnershipSummaryItem[];
}

export const OwnershipChart: React.FC<OwnershipChartProps> = ({ data }) => {
  const validData = Array.isArray(data)
    ? data.filter(item => item && typeof item === 'object')
    : [];

  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Ownership Summary</h3>
      <p className="text-xs text-slate-500 mb-4">Attribution mode and governance classification</p>
      {validData.length === 0 ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-700 mb-0.5">No Ownership Data</p>
          <p className="text-[11px] text-slate-400">No ownership attribution records available.</p>
        </div>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={validData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="assignment_type"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  interval={0}
                  tickFormatter={(v) => String(v || '').replace(' Assigned', '')}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px', borderRadius: '6px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {validData.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={OWNERSHIP_COLORS[index % OWNERSHIP_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around text-xs text-slate-500 mt-2">
            {validData.map((item, idx) => (
              <div key={item.assignment_type || idx} className="text-center">
                <span className="block font-mono text-slate-900 font-semibold">{item.count ?? 0}</span>
                <span className="text-[11px] text-slate-500 truncate">{String(item.assignment_type || '').replace(' Assigned', '')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10B981',
  REVIEW: '#F59E0B',
  'IN STOCK': '#3B82F6',
  RETIRED: '#64748B',
};

interface StatusChartProps {
  data: OperationalStatusItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const StatusChart: React.FC<StatusChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Assets by Operational Status</h3>
      <p className="text-xs text-slate-500 mb-4">Current fleet operational readiness & flags</p>

      {loading ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs font-medium text-slate-600">Loading operational status...</span>
        </div>
      ) : error ? (
        <div className="h-56 w-full flex flex-col items-center justify-center p-4 text-center">
          <div className="p-2 rounded-full bg-rose-50 text-rose-600 mb-2">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-rose-950 mb-1">Failed to load operational status</p>
          <p className="text-[11px] text-slate-500 max-w-xs mb-3 truncate" title={error}>
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-700 mb-0.5">No Status Data</p>
          <p className="text-[11px] text-slate-400">No operational status records available.</p>
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 11, fill: '#334155' }} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px', borderRadius: '6px' }}
                formatter={(value: any) => [`${value} assets`, 'Count']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((item, index) => {
                  const s = String(item.status || '').toUpperCase();
                  const fill = STATUS_COLORS[s] || '#3B82F6';
                  return <Cell key={`cell-status-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

interface EOLChartProps {
  data: EOLSummaryItem[];
}

export const EOLChart: React.FC<EOLChartProps> = ({ data }) => {
  const validData = Array.isArray(data)
    ? data.filter(item => item && typeof item === 'object')
    : [];

  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">EOL Status Distribution</h3>
      <p className="text-xs text-slate-500 mb-4">Hardware lifecycle support & expiration posture</p>
      {validData.length === 0 ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-700 mb-0.5">No EOL Data</p>
          <p className="text-[11px] text-slate-400">No hardware lifecycle records available.</p>
        </div>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={validData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="count"
                  nameKey="eol_status"
                >
                  {validData.map((_, index) => (
                    <Cell key={`cell-eol-${index}`} fill={EOL_COLORS[index % EOL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px', borderRadius: '6px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            {validData.map((item, idx) => (
              <div key={item.eol_status || idx} className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: EOL_COLORS[idx % EOL_COLORS.length] }}
                />
                <span className="text-slate-600 truncate">{String(item.eol_status || 'Unknown').split(' ')[0]}</span>
                <span className="font-mono text-slate-900 font-bold ml-auto tabular-nums">{item.count ?? 0}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface DepartmentChartProps {
  data: DepartmentDistributionItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const DepartmentChart: React.FC<DepartmentChartProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
}) => {
  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Assets by Department</h3>
      <p className="text-xs text-slate-500 mb-4">Organizational distribution across business units</p>

      {loading ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-slate-500">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs font-medium text-slate-600">Loading department summary...</span>
        </div>
      ) : error ? (
        <div className="h-56 w-full flex flex-col items-center justify-center p-4 text-center">
          <div className="p-2 rounded-full bg-rose-50 text-rose-600 mb-2">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-rose-950 mb-1">Failed to load department summary</p>
          <p className="text-[11px] text-slate-500 max-w-xs mb-3 truncate" title={error}>
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Building2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-700 mb-0.5">No Department Data</p>
          <p className="text-[11px] text-slate-400">No assets have been associated with departments yet.</p>
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 10, fill: '#64748B' }}
                angle={-25}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px', borderRadius: '6px' }}
              />
              <Bar dataKey="count" name="Asset Count" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
