import React from 'react';
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
  data: AssetsBySourceItem[];
}

export const SourceChart: React.FC<SourceChartProps> = ({ data }) => {
  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Assets by Source</h3>
      <p className="text-xs text-slate-500 mb-4">Discovery platform telemetry (BigFix vs Jamf Pro)</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={4}
              dataKey="count"
              nameKey="source"
            >
              {data.map((_, index) => (
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
        {data.map((item, idx) => (
          <div key={item.source} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length] }}
            />
            <span className="text-slate-600 font-medium truncate">{item.source.split(' ')[0]}</span>
            <span className="font-mono text-slate-900 font-semibold">({item.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface OwnershipChartProps {
  data: OwnershipSummaryItem[];
}

export const OwnershipChart: React.FC<OwnershipChartProps> = ({ data }) => {
  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Ownership Summary</h3>
      <p className="text-xs text-slate-500 mb-4">Attribution mode and governance classification</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="assignment_type"
              tick={{ fontSize: 11, fill: '#64748B' }}
              interval={0}
              tickFormatter={(v) => v.replace(' Assigned', '')}
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px', borderRadius: '6px' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={`bar-${index}`} fill={OWNERSHIP_COLORS[index % OWNERSHIP_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-around text-xs text-slate-500 mt-2">
        {data.map(item => (
          <div key={item.assignment_type} className="text-center">
            <span className="block font-mono text-slate-900 font-semibold">{item.count}</span>
            <span className="text-[11px] text-slate-500 truncate">{item.assignment_type.replace(' Assigned', '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface StatusChartProps {
  data: OperationalStatusItem[];
}

export const StatusChart: React.FC<StatusChartProps> = ({ data }) => {
  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Assets by Operational Status</h3>
      <p className="text-xs text-slate-500 mb-4">Current fleet operational readiness & flags</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis dataKey="status" type="category" tick={{ fontSize: 11, fill: '#334155' }} width={90} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px', borderRadius: '6px' }}
            />
            <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface EOLChartProps {
  data: EOLSummaryItem[];
}

export const EOLChart: React.FC<EOLChartProps> = ({ data }) => {
  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">EOL Status Distribution</h3>
      <p className="text-xs text-slate-500 mb-4">Hardware lifecycle support & expiration posture</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={75}
              dataKey="count"
              nameKey="eol_status"
            >
              {data.map((_, index) => (
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
        {data.map((item, idx) => (
          <div key={item.eol_status} className="flex items-center gap-1.5 truncate">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: EOL_COLORS[idx % EOL_COLORS.length] }}
            />
            <span className="text-slate-600 truncate">{item.eol_status.split(' ')[0]}</span>
            <span className="font-mono text-slate-900 font-bold ml-auto tabular-nums">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface DepartmentChartProps {
  data: DepartmentDistributionItem[];
}

export const DepartmentChart: React.FC<DepartmentChartProps> = ({ data }) => {
  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Assets by Department</h3>
      <p className="text-xs text-slate-500 mb-4">Organizational distribution across business units</p>
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
            <Bar dataKey="count" fill="#4F46E5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
