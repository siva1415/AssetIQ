import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { DashboardRedesignOverview } from '../types';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import { HardDrive, CheckCircle2, AlertTriangle, Package, Users, RefreshCw } from 'lucide-react';
import './DashboardPage.css';

const SOURCE_COLORS: Record<string, string> = { BIGFIX: '#2563eb', JAMF: '#0d9488' };
const EOL_COLORS: Record<string, string> = { ACTIVE: '#16a34a', 'EOL SOON': '#d97706', EXPIRED: '#dc2626', UNKNOWN: '#94a3b8' };
const STATUS_COLORS: Record<string, string> = { ACTIVE: '#16a34a', REVIEW: '#d97706', 'IN STOCK': '#94a3b8', RETIRED: '#64748b' };
const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value || 0);
const labelForSource = (source: string) => source === 'BIGFIX' ? 'BigFix' : source === 'JAMF' ? 'Jamf Pro' : source;

const KpiTile: React.FC<{ label: string; value: number; subtitle: string; tone: string; icon: React.ReactNode }> = ({ label, value, subtitle, tone, icon }) => (
  <div className={`di-kpi di-kpi-${tone}`}>
    <div className="di-kpi-top"><span className="di-kpi-label">{label}</span><span className="di-kpi-icon">{icon}</span></div>
    <div className="di-kpi-value">{formatNumber(value)}</div>
    <div className="di-kpi-subtitle">{subtitle}</div>
  </div>
);

const ChartCard: React.FC<{ title: string; description: string; className?: string; children: React.ReactNode }> = ({ title, description, className = '', children }) => (
  <section className={`di-card ${className}`}>
    <h3>{title}</h3><p>{description}</p>{children}
  </section>
);

export const DashboardPage: React.FC = () => {
  const { dataRefreshKey } = useApp();
  const [data, setData] = useState<DashboardRedesignOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getDashboardRedesignOverview());
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard, dataRefreshKey]);

  const sourceData = useMemo(() => data?.assets_by_source.filter(item => item.count > 0) ?? [], [data]);
  const eolData = useMemo(() => data?.eol_distribution.filter(item => item.count > 0) ?? [], [data]);
  const departmentData = useMemo(() => data?.assets_by_department ?? [], [data]);
  const eolExposure = useMemo(() => data?.eol_exposure ?? [], [data]);

  if (loading && !data) return <div className="di-dashboard"><div className="di-message"><span className="di-spinner" />Loading dashboard metrics…</div></div>;
  if (error && !data) return <div className="di-dashboard"><div className="di-error"><strong>Dashboard could not be loaded</strong><p>{error}</p><button onClick={() => void loadDashboard()}><RefreshCw size={14} /> Retry</button></div></div>;
  if (!data) return null;

  const kpis = data.kpis;
  const summaryTotals = data.source_summary.reduce((totals, row) => ({
    total: totals.total + row.total, active: totals.active + row.active,
    review: totals.review + row.review, in_stock: totals.in_stock + row.in_stock,
    retired: totals.retired + row.retired, auto: totals.auto + row.auto,
    manual: totals.manual + row.manual, unassigned: totals.unassigned + row.unassigned,
    eol_active: totals.eol_active + row.eol_active, eol_soon: totals.eol_soon + row.eol_soon,
    eol_expired: totals.eol_expired + row.eol_expired, eol_unknown: totals.eol_unknown + row.eol_unknown,
  }), { total: 0, active: 0, review: 0, in_stock: 0, retired: 0, auto: 0, manual: 0, unassigned: 0, eol_active: 0, eol_soon: 0, eol_expired: 0, eol_unknown: 0 });
  return (
    <div className="di-dashboard">
      {error && <div className="di-inline-error">{error}<button onClick={() => void loadDashboard()}>Retry</button></div>}
      <div className="di-kpis">
        <KpiTile label="Total Assets" value={kpis.total_assets} subtitle="All discovered endpoints" tone="total" icon={<HardDrive />} />
        <KpiTile label="Active Assets" value={kpis.active_assets} subtitle="Assigned and in use" tone="active" icon={<CheckCircle2 />} />
        <KpiTile label="Review" value={kpis.review} subtitle="Needs validation or verification" tone="review" icon={<AlertTriangle />} />
        <KpiTile label="In Stock" value={kpis.in_stock} subtitle="Available, not assigned" tone="stock" icon={<Package />} />
        <KpiTile label="Employee Count" value={kpis.employee_count} subtitle="Employees in employee table" tone="employees" icon={<Users />} />
      </div>

      <div className="di-chart-row">
              <section className="di-eol-lifecycle" aria-labelledby="di-eol-lifecycle-title">
                <div className="di-eol-lifecycle-heading">
                  <div><h3 id="di-eol-lifecycle-title">EOL Status Lifecycle</h3><p>Lifecycle status is determined from the EOL Management reference date for each hardware model.</p></div>
                  <span className="di-lifecycle-tag">90-day threshold</span>
                </div>
                <div className="di-eol-rules">
                  <div className="di-eol-rule"><span className="di-eol-rule-dot di-rule-active"/><div><strong>ACTIVE</strong><p>More than 90 days remaining</p></div></div>
                  <div className="di-eol-rule"><span className="di-eol-rule-dot di-rule-soon"/><div><strong>EOL SOON</strong><p>EOL within 90 days</p></div></div>
                  <div className="di-eol-rule"><span className="di-eol-rule-dot di-rule-expired"/><div><strong>EXPIRED</strong><p>EOL date has passed</p></div></div>
                  <div className="di-eol-rule"><span className="di-eol-rule-dot di-rule-unknown"/><div><strong>UNKNOWN</strong><p>Model not found in EOL Management</p></div></div>
                </div>
              </section>
        <ChartCard title="EOL Exposure by Hardware Model" description="Models past or nearing end of life (bar = assets affected)">
          <div className="di-model-chart-scroll">
            {eolExposure.length ? <div className="di-model-chart" style={{ height: `${Math.max(250, eolExposure.length * 38)}px` }}><ResponsiveContainer width="100%" height="100%"><BarChart data={eolExposure} layout="vertical" margin={{ top: 8, right: 36, left: 8, bottom: 8 }} barCategoryGap="24%"><CartesianGrid stroke="#e8ecf2" strokeDasharray="4 4" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} /><YAxis type="category" dataKey="model" width={150} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} interval={0} /><Tooltip labelFormatter={(label: any) => `Model: ${label}`} formatter={(value: any, _name: any, item: any) => [`${value ?? 0} assets`, item?.payload?.eol_status || 'EOL status']} /><Bar dataKey="count" name="Affected assets" barSize={18} radius={[0, 5, 5, 0]}>{eolExposure.map(item => <Cell key={item.model} fill={EOL_COLORS[item.eol_status] || '#94a3b8'} />)}<LabelList dataKey="count" position="right" fill="#334155" fontSize={11} /></Bar></BarChart></ResponsiveContainer></div> : <div className="di-empty">No EOL exposure found</div>}
          </div>
          <div className="di-legend di-legend-wrap">{['EXPIRED', 'EOL SOON', 'UNKNOWN'].map(status => <span key={status}><i style={{ background: EOL_COLORS[status] }} />{status === 'EOL SOON' ? 'EOL soon' : status.charAt(0) + status.slice(1).toLowerCase()}</span>)}</div>
        </ChartCard>

        <ChartCard title="EOL Status Distribution" description="Hardware lifecycle support & expiration posture">
          <div className="di-chart-box">
            {eolData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={eolData} dataKey="count" nameKey="status" outerRadius="82%" paddingAngle={2} stroke="#fff" strokeWidth={2}>{eolData.map(item => <Cell key={item.status} fill={EOL_COLORS[item.status] || '#94a3b8'} />)}</Pie><Tooltip formatter={(value: any, name: any) => [`${value ?? 0} assets`, name || 'Status']} /></PieChart></ResponsiveContainer> : <div className="di-empty">No EOL status data available</div>}
          </div>
          <div className="di-eol-legend">{eolData.map(item => <div key={item.status}><span><i style={{ background: EOL_COLORS[item.status] || '#94a3b8' }} />{item.status === 'EOL SOON' ? 'EOL soon' : item.status.charAt(0) + item.status.slice(1).toLowerCase()}</span><b>{formatNumber(item.count)}</b></div>)}</div>
        </ChartCard>
      </div>

      <div className="di-lower-row">
        <ChartCard title="Assets by Source" description="Discovery platform telemetry (BigFix vs Jamf Pro)">
            <div className="di-chart-box">
              {sourceData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sourceData} dataKey="count" nameKey="source" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="#fff" strokeWidth={3}>{sourceData.map(item => <Cell key={item.source} fill={SOURCE_COLORS[item.source] || '#64748b'} />)}</Pie><Tooltip formatter={(value: any) => [`${value ?? 0} assets`, 'Assets']} /></PieChart></ResponsiveContainer> : <div className="di-empty">No source data available</div>}
            </div>
            <div className="di-legend">{sourceData.map(item => <span key={item.source}><i style={{ background: SOURCE_COLORS[item.source] || '#64748b' }} />{labelForSource(item.source)} ({formatNumber(item.count)})</span>)}</div>
          </ChartCard>

        <ChartCard title="Assets by Department" description="Organizational distribution across business units" className="di-department-card">
          <div className="di-department-chart">
            {departmentData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={departmentData} margin={{ top: 8, right: 14, left: 0, bottom: 32 }}><CartesianGrid stroke="#e8ecf2" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="department" interval={0} angle={-18} textAnchor="end" height={50} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: any) => [`${value ?? 0} assets`, 'Assets']} /><Bar dataKey="count" name="Assets" fill="#4f46e5" radius={[5, 5, 0, 0]} maxBarSize={58} /></BarChart></ResponsiveContainer> : <div className="di-empty">No department data available</div>}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Source Summary" description="BigFix vs Jamf Pro: inventory, assignment and end-of-life posture" className="di-source-table-card">
        <div className="di-table-scroll"><table className="di-source-table">
          <colgroup>
            <col className="di-col-source" /><col className="di-col-total" />
            {Array.from({ length: 4 }, (_, i) => <col key={`status-${i}`} className="di-col-metric" />)}
            {Array.from({ length: 3 }, (_, i) => <col key={`assignment-${i}`} className="di-col-metric" />)}
            {Array.from({ length: 4 }, (_, i) => <col key={`eol-${i}`} className="di-col-metric" />)}
          </colgroup>
          <thead>
            <tr className="di-group-head"><th rowSpan={2}>Source</th><th colSpan={5}>Asset status</th><th colSpan={3}>Assignment</th><th colSpan={4}>EOL status</th></tr>
            <tr><th>Total assets</th><th>Active</th><th>Review</th><th>In stock</th><th>Retired</th><th>Auto assigned</th><th>Manual</th><th>Unassigned</th><th>Active</th><th>EOL soon</th><th>Expired</th><th>Unknown</th></tr>
          </thead>
          <tbody>{data.source_summary.map(row => <tr key={row.source}>
            <td className="di-source-name"><i style={{ background: SOURCE_COLORS[row.source] || '#64748b' }} />{labelForSource(row.source)}</td>
            <td>{formatNumber(row.total)}</td><td><span className="di-value-pill di-green">{row.active || '–'}</span></td><td><span className="di-value-pill di-amber">{row.review || '–'}</span></td><td><span className="di-value-pill di-grey">{row.in_stock || '–'}</span></td><td>{row.retired || '–'}</td>
            <td className="di-separator">{row.auto || '–'}</td><td>{row.manual || '–'}</td><td>{row.unassigned || '–'}</td>
            <td className="di-separator"><span className="di-value-pill di-green">{row.eol_active || '–'}</span></td><td><span className="di-value-pill di-amber">{row.eol_soon || '–'}</span></td><td><span className="di-value-pill di-red">{row.eol_expired || '–'}</span></td><td><span className="di-value-pill di-grey">{row.eol_unknown || '–'}</span></td>
          </tr>)}</tbody>
          <tfoot><tr><td>Total</td><td>{formatNumber(summaryTotals.total)}</td><td>{formatNumber(summaryTotals.active)}</td><td>{formatNumber(summaryTotals.review)}</td><td>{formatNumber(summaryTotals.in_stock)}</td><td>{formatNumber(summaryTotals.retired)}</td><td>{formatNumber(summaryTotals.auto)}</td><td>{formatNumber(summaryTotals.manual)}</td><td>{formatNumber(summaryTotals.unassigned)}</td><td>{formatNumber(summaryTotals.eol_active)}</td><td>{formatNumber(summaryTotals.eol_soon)}</td><td>{formatNumber(summaryTotals.eol_expired)}</td><td>{formatNumber(summaryTotals.eol_unknown)}</td></tr></tfoot>
        </table></div>
      </ChartCard>


    </div>
  );
};
