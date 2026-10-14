import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  PackageMinus,
  Clock,
  Building2,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  AssetsBySourceItem,
  OwnershipSummaryItem,
  OperationalStatusItem,
  EOLSummaryItem,
  DepartmentDistributionItem,
  Asset,
  ASSET_STATUSES,
  toStandardAssetStatus,
  ASSET_STATUS_LABELS,
} from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

export const ReportsPage: React.FC = () => {
  const { dataRefreshKey } = useApp();
  const [selectedReport, setSelectedReport] = useState<string>('source');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Loaded report data
  const [sourceData, setSourceData] = useState<AssetsBySourceItem[]>([]);
  const [ownershipData, setOwnershipData] = useState<OwnershipSummaryItem[]>([]);
  const [statusData, setStatusData] = useState<OperationalStatusItem[]>([]);
  const [eolData, setEolData] = useState<EOLSummaryItem[]>([]);
  const [deptData, setDeptData] = useState<DepartmentDistributionItem[]>([]);
  const [fullAssets, setFullAssets] = useState<Asset[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getAssetsBySource(),
      api.getOwnershipSummary(),
      api.getOperationalStatusSummary(),
      api.getEOLSummary(),
      api.getDepartmentDistribution(),
      api.getAssets({ page: 1, page_size: 500 }),
    ])
      .then(([src, own, stat, eol, dept, assetsResp]) => {
        if (!isMounted) return;
        setSourceData(src);
        setOwnershipData(own);
        setStatusData(stat);
        setEolData(eol);
        setDeptData(dept);
        setFullAssets(assetsResp.items);
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err?.response?.data?.detail || err?.message || 'Failed to aggregate compliance report data.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dataRefreshKey]);

  // Export current report CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `AssetIQ_Report_${selectedReport}.csv`;

    if (selectedReport === 'source') {
      headers = ['Discovery Source', 'Endpoint Count', 'Fleet Percentage (%)'];
      rows = sourceData.map(i => [`"${i.source}"`, i.count, `${i.percentage}%`]);
    } else if (selectedReport === 'status') {
      headers = ['Operational Status', 'Endpoint Count', 'Fleet Percentage (%)'];
      rows = statusData.map(i => [`"${i.status}"`, i.count, `${i.percentage}%`]);
    } else if (selectedReport === 'ownership') {
      headers = ['Ownership Classification', 'Endpoint Count', 'Fleet Percentage (%)'];
      rows = ownershipData.map(i => [`"${i.assignment_type}"`, i.count, `${i.percentage}%`]);
    } else if (selectedReport === 'unassigned') {
      const unassignedAssets = fullAssets.filter(a => a.assignment_type === 'Unassigned');
      headers = ['Asset ID', 'Asset Number', 'Serial', 'Source', 'Model', 'Status', 'Last Seen'];
      rows = unassignedAssets.map(a => [
        a.id,
        a.asset_number,
        a.serial_number,
        a.source,
        `"${a.model}"`,
        a.asset_status,
        a.last_report_time,
      ]);
    } else if (selectedReport === 'validation') {
      const needValidation = fullAssets.filter(
        a => toStandardAssetStatus(a.asset_status) === ASSET_STATUSES.REVIEW
      );
      headers = ['Asset ID', 'Asset Number', 'Assigned User', 'Workday Status', 'Model', 'Audit Note'];
      rows = needValidation.map(a => [
        a.id,
        a.asset_number,
        a.assigned_username || 'None',
        a.workday_status || 'Unknown',
        `"${a.model}"`,
        `"${a.notes || ''}"`,
      ]);
    } else if (selectedReport === 'eol') {
      headers = ['EOL Classification Window', 'Device Count', 'Fleet Percentage (%)'];
      rows = eolData.map(i => [`"${i.eol_status}"`, i.count, `${i.percentage}%`]);
    } else if (selectedReport === 'department') {
      headers = ['Department / Cost Center', 'Device Count', 'Fleet Percentage (%)'];
      rows = deptData.map(i => [`"${i.department}"`, i.count, `${i.percentage}%`]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportOptions = [
    { id: 'source', label: 'Inventory by Source', icon: Layers, desc: 'BigFix vs Jamf Pro discovery telemetry' },
    { id: 'status', label: 'Operational Status', icon: CheckCircle2, desc: 'Active, In Stock, Review distribution' },
    { id: 'ownership', label: 'Ownership Overview', icon: HardDrive, desc: 'Automatic vs Manual vs Unassigned breakdown' },
    { id: 'unassigned', label: 'Unassigned Assets Audit', icon: PackageMinus, desc: 'Detailed register of shelf stock & spares' },
    { id: 'validation', label: 'Validation Exceptions', icon: AlertTriangle, desc: 'Terminated users and orphan endpoints' },
    { id: 'eol', label: 'Hardware EOL Lifecycle', icon: Clock, desc: 'Obsolescence thresholds and upcoming expiration' },
    { id: 'department', label: 'Assets by Department', icon: Building2, desc: 'Cross-organizational business unit allocation' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-lg border border-slate-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0 mt-0.5">
            <FileBarChart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Enterprise Governance &amp; Audit Reports
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Export authoritative asset governance records for IT compliance, external auditors, and finance FP&amp;A.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={loading || Boolean(error)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export Current Report (CSV)</span>
        </button>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {reportOptions.map(opt => {
          const Icon = opt.icon;
          const isActive = selectedReport === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelectedReport(opt.id)}
              className={`p-3 text-left rounded-lg border transition-all ${
                isActive
                  ? 'bg-blue-50/60 border-blue-600 ring-1 ring-blue-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                <span className={`text-xs font-bold ${isActive ? 'text-blue-900' : 'text-slate-900'}`}>
                  {opt.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Main Report View Container */}
      {error ? (
        <ErrorState error={error} />
      ) : loading ? (
        <LoadingState message="Generating consolidated governance report..." rows={6} />
      ) : (
        <div className="p-3 sm:p-5 bg-white rounded-lg border border-slate-200 space-y-4 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {reportOptions.find(o => o.id === selectedReport)?.label}
              </h3>
              <p className="text-xs text-slate-500">
                {reportOptions.find(o => o.id === selectedReport)?.desc}
              </p>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Generated: {new Date().toLocaleDateString()}
            </span>
          </div>

          {/* Render table based on selected report */}
          <div className="overflow-x-auto w-full">
            {selectedReport === 'source' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Discovery Platform</th>
                    <th className="py-2.5 px-3">Endpoints Managed</th>
                    <th className="py-2.5 px-3">Fleet Proportion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sourceData.map(item => (
                    <tr key={item.source} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.source}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 tabular-nums">{item.count}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full" style={{ width: `${item.percentage}%` }} />
                          </div>
                          <span className="font-mono text-slate-600">{item.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'status' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Operational Readiness</th>
                    <th className="py-2.5 px-3">Device Count</th>
                    <th className="py-2.5 px-3">Proportion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statusData.map(item => (
                    <tr key={item.status} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.status}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 tabular-nums">{item.count}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-600 h-full" style={{ width: `${item.percentage}%` }} />
                          </div>
                          <span className="font-mono text-slate-600">{item.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'ownership' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Attribution Mode</th>
                    <th className="py-2.5 px-3">Asset Count</th>
                    <th className="py-2.5 px-3">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ownershipData.map(item => (
                    <tr key={item.assignment_type} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.assignment_type}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 tabular-nums">{item.count}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full" style={{ width: `${item.percentage}%` }} />
                          </div>
                          <span className="font-mono text-slate-600">{item.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'unassigned' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Asset #</th>
                    <th className="py-2.5 px-3">Serial</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fullAssets.filter(a => a.assignment_type === 'Unassigned').map(asset => (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{asset.asset_number}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{asset.serial_number}</td>
                      <td className="py-3 px-3">{asset.source}</td>
                      <td className="py-3 px-3 font-medium text-slate-800">{asset.model}</td>
                      <td className="py-3 px-3">
                        {ASSET_STATUS_LABELS[toStandardAssetStatus(asset.asset_status)] || asset.asset_status}
                      </td>
                      <td className="py-3 px-3 text-slate-500 truncate max-w-xs">{asset.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'validation' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Asset #</th>
                    <th className="py-2.5 px-3">Reported Username</th>
                    <th className="py-2.5 px-3">Workday Match</th>
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">Audit Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fullAssets
                    .filter(a => toStandardAssetStatus(a.asset_status) === ASSET_STATUSES.REVIEW)
                    .map(asset => (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{asset.asset_number}</td>
                      <td className="py-3 px-3 font-mono text-slate-800">{asset.assigned_username || 'None'}</td>
                      <td className="py-3 px-3 text-rose-700 font-medium">{asset.workday_status}</td>
                      <td className="py-3 px-3 text-slate-800">{asset.model}</td>
                      <td className="py-3 px-3 text-slate-600">{asset.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'eol' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Lifecycle Phase</th>
                    <th className="py-2.5 px-3">Device Count</th>
                    <th className="py-2.5 px-3">Fleet Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eolData.map(item => (
                    <tr key={item.eol_status} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.eol_status}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 tabular-nums">{item.count}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-600 h-full" style={{ width: `${item.percentage}%` }} />
                          </div>
                          <span className="font-mono text-slate-600">{item.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'department' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Department / Cost Center</th>
                    <th className="py-2.5 px-3">Assigned Assets</th>
                    <th className="py-2.5 px-3">Percentage of Total Fleet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptData.map(item => (
                    <tr key={item.department} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.department}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 tabular-nums">{item.count}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full" style={{ width: `${item.percentage}%` }} />
                          </div>
                          <span className="font-mono text-slate-600">{item.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
