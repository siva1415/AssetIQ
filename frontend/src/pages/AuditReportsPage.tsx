import React, { useState } from 'react';
import {
  FileCheck2,
  AlertTriangle,
  Download,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface AuditItem {
  id: string;
  rule_id: string;
  category: 'Identity Discrepancy' | 'Stale Telemetry' | 'Privileged Access' | 'Warranty Obsolescence';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  asset_tag: string;
  device_model: string;
  reported_user: string;
  audit_finding: string;
  remediation_action: string;
  detected_date: string;
}

const AUDIT_EXCEPTIONS: AuditItem[] = [
  {
    id: 'AUD-001',
    rule_id: 'SEC-HR-01',
    category: 'Identity Discrepancy',
    severity: 'Critical',
    asset_tag: 'AST-10499',
    device_model: 'Lenovo ThinkPad X1 Carbon Gen 8',
    reported_user: 'rrossi',
    audit_finding: 'Hardware assigned to employee Roberto Rossi marked Terminated in Workday. Device not checked in for 55+ days.',
    remediation_action: 'Initiate IT asset recovery and revoke directory credentials',
    detected_date: '2026-10-08',
  },
  {
    id: 'AUD-002',
    rule_id: 'SEC-ID-04',
    category: 'Identity Discrepancy',
    severity: 'High',
    asset_tag: 'AST-10502',
    device_model: 'HP EliteBook 840 G8',
    reported_user: 'ext_mkhan',
    audit_finding: 'Active login username ext_mkhan does not match any current employee or contractor record in Workday HCM.',
    remediation_action: 'Verify contractor vendor statement of work or reclaim device',
    detected_date: '2026-10-09',
  },
  {
    id: 'AUD-003',
    rule_id: 'SEC-PR-02',
    category: 'Privileged Access',
    severity: 'High',
    asset_tag: 'AST-10498',
    device_model: 'Dell PowerEdge R640',
    reported_user: 'root',
    audit_finding: 'Interactive root login without individual user attribution or multi-factor authentication enforcement.',
    remediation_action: 'Deploy sudo PAM with individual SSH keys and Duo MFA',
    detected_date: '2026-10-09',
  },
  {
    id: 'AUD-004',
    rule_id: 'SEC-EOL-01',
    category: 'Warranty Obsolescence',
    severity: 'Medium',
    asset_tag: 'AST-10505',
    device_model: 'Apple MacBook Air 13" M1',
    reported_user: 'temp_user_99',
    audit_finding: 'OEM End-of-Life expired 300+ days ago and generic username assigned.',
    remediation_action: 'Schedule hardware refresh and assign to designated user',
    detected_date: '2026-10-05',
  },
  {
    id: 'AUD-005',
    rule_id: 'SEC-HW-09',
    category: 'Stale Telemetry',
    severity: 'Medium',
    asset_tag: 'AST-10511',
    device_model: 'Custom Rack Unit',
    reported_user: 'Unassigned',
    audit_finding: 'Unidentified legacy lab host with unknown serial number and missing OEM catalog metadata.',
    remediation_action: 'Perform physical datacenter audit on rack 14-B',
    detected_date: '2026-10-01',
  },
];

export const AuditReportsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filteredItems = AUDIT_EXCEPTIONS.filter(item => {
    const matchesSearch =
      !search ||
      item.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
      item.reported_user.toLowerCase().includes(search.toLowerCase()) ||
      item.audit_finding.toLowerCase().includes(search.toLowerCase()) ||
      item.rule_id.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity = !severityFilter || item.severity === severityFilter;
    const matchesCategory = !categoryFilter || item.category === categoryFilter;

    return matchesSearch && matchesSeverity && matchesCategory;
  });

  const handleExportCSV = () => {
    const headers = [
      'Audit ID',
      'Rule ID',
      'Category',
      'Severity',
      'Asset Tag',
      'Device Model',
      'Reported User',
      'Audit Finding',
      'Remediation Action',
      'Detected Date',
    ];

    const rows = filteredItems.map(item => [
      item.id,
      item.rule_id,
      `"${item.category}"`,
      item.severity,
      item.asset_tag,
      `"${item.device_model}"`,
      `"${item.reported_user}"`,
      `"${item.audit_finding}"`,
      `"${item.remediation_action}"`,
      item.detected_date,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AssetIQ_SOC2_Compliance_Audit_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-lg border border-slate-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-rose-50 text-rose-700 rounded-lg shrink-0 mt-0.5">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Audit Reports &amp; Compliance Exception Register
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Consolidated governance findings required for internal risk attestations and external audits (SOC 2 Type II, ISO 27001 Annex A.8, Sarbanes-Oxley ITGC).
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-2xs shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Package (CSV)</span>
        </button>
      </div>

      {/* Severity Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-lg border border-rose-300 bg-rose-50/30">
          <span className="text-xs font-semibold text-rose-900 block mb-1">Critical Exceptions</span>
          <span className="text-2xl font-bold font-mono text-rose-900 tabular-nums">
            {AUDIT_EXCEPTIONS.filter(i => i.severity === 'Critical').length}
          </span>
          <span className="text-[11px] text-rose-700 block mt-1">Terminated custodian hardware</span>
        </div>

        <div className="p-4 bg-white rounded-lg border border-amber-300 bg-amber-50/30">
          <span className="text-xs font-semibold text-amber-900 block mb-1">High Severity</span>
          <span className="text-2xl font-bold font-mono text-amber-900 tabular-nums">
            {AUDIT_EXCEPTIONS.filter(i => i.severity === 'High').length}
          </span>
          <span className="text-[11px] text-amber-700 block mt-1">Unmapped user / root accounts</span>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-600 block mb-1">Medium Severity</span>
          <span className="text-2xl font-bold font-mono text-slate-800 tabular-nums">
            {AUDIT_EXCEPTIONS.filter(i => i.severity === 'Medium').length}
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">EOL expired &amp; stale lab units</span>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-600 block mb-1">Audit Coverage</span>
          <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">98.4%</span>
          <span className="text-[11px] text-slate-500 block mt-1">Active fleet endpoints covered</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="p-3 sm:p-4 bg-white rounded-lg border border-slate-200 space-y-3.5 shadow-2xs w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
            <div className="relative flex-1 sm:w-64 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search rule ID, asset tag, user, finding..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-700 focus:outline-none max-w-full"
            >
              <option value="">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-700 focus:outline-none max-w-full"
            >
              <option value="">All Categories</option>
              <option value="Identity Discrepancy">Identity Discrepancy</option>
              <option value="Privileged Access">Privileged Access</option>
              <option value="Warranty Obsolescence">Warranty Obsolescence</option>
              <option value="Stale Telemetry">Stale Telemetry</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold select-none text-[11px] sm:text-xs">
              <tr>
                <th className="py-2.5 px-2 sm:px-3">Severity &amp; Rule</th>
                <th className="py-2.5 px-3">Asset Tag</th>
                <th className="py-2.5 px-3">Reported User</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Audit Finding</th>
                <th className="py-2.5 px-3">Recommended Remediation</th>
                <th className="py-2.5 px-3">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          item.severity === 'Critical'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : item.severity === 'High'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {item.severity}
                      </span>
                      <span className="font-mono text-slate-500 text-[10px]">{item.rule_id}</span>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-slate-900 block">{item.asset_tag}</span>
                    <span className="text-[10px] text-slate-400 truncate block max-w-[140px]">{item.device_model}</span>
                  </td>

                  <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                    {item.reported_user}
                  </td>

                  <td className="py-3 px-3 text-slate-700">{item.category}</td>

                  <td className="py-3 px-3 text-slate-800 max-w-xs">{item.audit_finding}</td>

                  <td className="py-3 px-3 text-slate-600 max-w-xs font-medium text-blue-900 bg-blue-50/40 p-2 rounded">
                    {item.remediation_action}
                  </td>

                  <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                    {item.detected_date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
