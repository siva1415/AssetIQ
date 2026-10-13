import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Package,
  Monitor,
  Laptop,
  UserCheck,
  UserCog,
  PackageMinus,
  Users,
  Filter,
  Eye,
  X,
  Layers,
  ShieldCheck,
  Clock,
  Building2,
  ListFilter,
} from 'lucide-react';
import {
  DashboardSummary,
  AssetsBySourceItem,
  OwnershipSummaryItem,
  EOLSummaryItem,
  OperationalStatusItem,
  DepartmentDistributionItem,
  Asset,
} from '../types';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { KPICard } from '../components/dashboard/KPICard';
import {
  SourceChart,
  OwnershipChart,
  StatusChart,
  EOLChart,
  DepartmentChart,
} from '../components/charts/DashboardCharts';
import { StatusBadge } from '../components/common/StatusBadge';
import { SourceBadge } from '../components/common/SourceBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetDetailDrawer } from '../components/assets/AssetDetailDrawer';

export type DashboardSection = 'overview' | 'compliance' | 'lifecycle' | 'org' | 'explorer';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { dataRefreshKey } = useApp();

  // In-page Section Navigation (Menu displayed as a separate section on the same page)
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [isStackedView, setIsStackedView] = useState<boolean>(false);

  // Dashboard filter state
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('');

  // Data states
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sourceData, setSourceData] = useState<AssetsBySourceItem[]>([]);
  const [ownershipData, setOwnershipData] = useState<OwnershipSummaryItem[]>([]);
  const [eolData, setEolData] = useState<EOLSummaryItem[]>([]);
  const [statusData, setStatusData] = useState<OperationalStatusItem[]>([]);
  const [deptData, setDeptData] = useState<DepartmentDistributionItem[]>([]);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);

  // Page state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Asset detail modal
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallel fetch of all dashboard endpoints
      const [
        sumRes,
        srcRes,
        ownRes,
        eolRes,
        statRes,
        deptRes,
        recentRes,
      ] = await Promise.all([
        api.getDashboardSummary(),
        api.getAssetsBySource(),
        api.getOwnershipSummary(),
        api.getEOLSummary(),
        api.getOperationalStatusSummary(),
        api.getDepartmentDistribution(),
        api.getAssets({
          page: 1,
          page_size: 8,
          source: sourceFilter || undefined,
          device_type: deviceTypeFilter || undefined,
          asset_status: statusFilter || undefined,
          manufacturer: manufacturerFilter || undefined,
          sort_by: 'last_report_time',
          sort_order: 'desc',
        }),
      ]);

      setSummary(sumRes);
      setSourceData(srcRes);
      setOwnershipData(ownRes);
      setEolData(eolRes);
      setStatusData(statRes);
      setDeptData(deptRes);
      setRecentAssets(recentRes.items);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load dashboard metrics from backend API.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [sourceFilter, deviceTypeFilter, statusFilter, manufacturerFilter, dataRefreshKey]);

  const hasActiveFilters = Boolean(sourceFilter || deviceTypeFilter || statusFilter || manufacturerFilter);

  const clearFilters = () => {
    setSourceFilter('');
    setDeviceTypeFilter('');
    setStatusFilter('');
    setManufacturerFilter('');
  };

  const handleSectionSelect = (section: DashboardSection) => {
    setActiveSection(section);
    if (isStackedView) {
      const el = document.getElementById(`dash-section-${section}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const complianceFlagCount = (summary?.need_validation || 0) + (summary?.unassigned_assets || 0);

  return (
    <div className="space-y-5">
      {/* =========================================================================
          1. DEDICATED SECTIONS MENU (Separate Section on Same Page)
          ========================================================================= */}
      <section className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Section Tabs */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 pl-1.5 pr-2.5 border-r border-slate-200">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Sections</span>
            </div>

            <nav className="flex items-center gap-1.5 flex-wrap" aria-label="Dashboard Sections">
              <button
                type="button"
                onClick={() => handleSectionSelect('overview')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeSection === 'overview' && !isStackedView
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                onClick={() => handleSectionSelect('compliance')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeSection === 'compliance' && !isStackedView
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Compliance</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    activeSection === 'compliance' && !isStackedView
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {complianceFlagCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSectionSelect('lifecycle')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeSection === 'lifecycle' && !isStackedView
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Lifecycle (EOL)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSectionSelect('org')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeSection === 'org' && !isStackedView
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Org &amp; Ownership</span>
              </button>

              <button
                type="button"
                onClick={() => handleSectionSelect('explorer')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeSection === 'explorer' && !isStackedView
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Hardware Explorer</span>
              </button>
            </nav>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsStackedView(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                isStackedView
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Toggle between tabbed section view and stacked continuous single-page view"
            >
              <span>{isStackedView ? 'Tabbed View' : 'Show All Sections'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. DASHBOARD HEADER & MULTI-DIMENSIONAL FILTERS
          ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {isStackedView ? 'Continuous Telemetry Console' : activeSection.toUpperCase()}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isStackedView
              ? 'Executive Fleet Governance & Telemetry'
              : activeSection === 'overview'
              ? 'Executive Asset Telemetry'
              : activeSection === 'compliance'
              ? 'Compliance, Hygiene & Audit Exceptions'
              : activeSection === 'lifecycle'
              ? 'OEM Hardware Lifecycle & EOL Horizon'
              : activeSection === 'org'
              ? 'Department Distribution & Custodianship'
              : 'Discovered Endpoint Inventory'}
          </h2>
          <p className="text-xs text-slate-500">
            Real-time cross-platform hardware reconciliation across BigFix, Jamf Pro, and Workday HRIS
          </p>
        </div>

        {/* Global Dashboard Filters */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />

          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Sources</option>
            <option value="BIGFIX">BigFix</option>
            <option value="JAMF">Jamf Pro</option>
          </select>

          <select
            value={deviceTypeFilter}
            onChange={e => setDeviceTypeFilter(e.target.value)}
            className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Device Types</option>
            <option value="Laptop">Laptops</option>
            <option value="Desktop">Desktops</option>
            <option value="Server">Servers</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Operational Statuses</option>
            <option value="Active">Active</option>
            <option value="Need Validation">Need Validation</option>
            <option value="In Stock">In Stock</option>
          </select>

          <select
            value={manufacturerFilter}
            onChange={e => setManufacturerFilter(e.target.value)}
            className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Manufacturers</option>
            <option value="Apple Inc.">Apple Inc.</option>
            <option value="Dell Inc.">Dell Inc.</option>
            <option value="Lenovo">Lenovo</option>
            <option value="HP Inc.">HP Inc.</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="p-1 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50"
              title="Clear Filters"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error state if FastAPI fails */}
      {error && <ErrorState error={error} onRetry={fetchDashboardData} />}

      {/* Loading state */}
      {loading && !error && (
        <LoadingState message="Aggregating metrics across BigFix, Jamf, and Workday..." rows={6} />
      )}

      {/* =========================================================================
          3. MAIN CONTENT: KPIS, CHARTS & TABLES
          ========================================================================= */}
      {!loading && !error && summary && (
        <div className="space-y-6">
          {/* Section 1: Overview & 10 KPI Cards */}
          <div id="dash-section-overview" className="space-y-4">
            {isStackedView && (
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <HardDrive className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">1. Executive Overview</h3>
              </div>
            )}

            {/* 10 Compact KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <KPICard
                label="Total Assets"
                value={summary.total_assets}
                icon={HardDrive}
                subtitle="All discovered endpoints"
                colorTheme="default"
                onClick={() => navigate('/assets')}
              />
              <KPICard
                label="Active Assets"
                value={summary.active_assets}
                icon={CheckCircle2}
                subtitle="Healthy & in service"
                colorTheme="emerald"
                onClick={() => navigate('/assets')}
              />
              <KPICard
                label="Need Validation"
                value={summary.need_validation}
                icon={AlertTriangle}
                subtitle="Audit flags or orphaned"
                colorTheme="amber"
                onClick={() => navigate('/audit-reports')}
              />
              <KPICard
                label="In Stock"
                value={summary.in_stock}
                icon={Package}
                subtitle="Unassigned warehouse pool"
                colorTheme="default"
                onClick={() => navigate('/unassigned')}
              />
              <KPICard
                label="BigFix Assets"
                value={summary.bigfix_assets}
                icon={Monitor}
                subtitle="Windows / Linux endpoints"
                colorTheme="blue"
                onClick={() => navigate('/assets/windows')}
              />
              <KPICard
                label="Jamf Assets"
                value={summary.jamf_assets}
                icon={Laptop}
                subtitle="macOS & Apple fleet"
                colorTheme="blue"
                onClick={() => navigate('/assets/mac')}
              />
              <KPICard
                label="Automatically Assigned"
                value={summary.automatically_assigned}
                icon={UserCheck}
                subtitle="Verified Workday match"
                colorTheme="emerald"
                onClick={() => navigate('/ownership')}
              />
              <KPICard
                label="Manually Assigned"
                value={summary.manually_assigned}
                icon={UserCog}
                subtitle="Custom approval/override"
                colorTheme="amber"
                onClick={() => navigate('/ownership')}
              />
              <KPICard
                label="Unassigned Assets"
                value={summary.unassigned_assets}
                icon={PackageMinus}
                subtitle="No active custodian"
                colorTheme="rose"
                onClick={() => navigate('/unassigned')}
              />
              <KPICard
                label="Employee Count"
                value={summary.employee_count}
                icon={Users}
                subtitle="Authoritative directory"
                colorTheme="default"
                onClick={() => navigate('/users')}
              />
            </div>
          </div>

          {/* Section 2: Fleet Telemetry & EOL Lifecycle Charts */}
          {(isStackedView || activeSection === 'overview' || activeSection === 'compliance' || activeSection === 'lifecycle') && (
            <div id="dash-section-lifecycle" className="space-y-4">
              {isStackedView && (
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">2. Telemetry &amp; EOL Lifecycle</h3>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SourceChart data={sourceData} />
                <OwnershipChart data={ownershipData} />
                <StatusChart data={statusData} />
                <EOLChart data={eolData} />
              </div>
            </div>
          )}

          {/* Section 3: Department Distribution */}
          {(isStackedView || activeSection === 'overview' || activeSection === 'org') && (
            <div id="dash-section-org" className="space-y-4">
              {isStackedView && (
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">3. Organization Distribution</h3>
                </div>
              )}

              <DepartmentChart data={deptData} />
            </div>
          )}

          {/* Section 4: Recent Discovered Assets Table */}
          {(isStackedView || activeSection === 'overview' || activeSection === 'explorer') && (
            <div id="dash-section-explorer" className="p-5 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recent Discovered Assets</h3>
                  <p className="text-xs text-slate-500">
                    Latest reporting endpoints across discovery collectors (Click any row for details)
                  </p>
                </div>
                <button
                  onClick={() => navigate('/assets')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  View All Assets →
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold select-none">
                    <tr>
                      <th className="py-2.5 px-3">Asset Number</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Manufacturer</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3">Assigned Username</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Last Report Time</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentAssets.map(asset => (
                      <tr
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {asset.asset_number}
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <SourceBadge source={asset.source} />
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{asset.manufacturer}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 truncate max-w-[180px]">
                          {asset.model}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {asset.assigned_username || (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={asset.asset_status} />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">
                          {new Date(asset.last_report_time).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedAsset(asset);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Asset Detail Drawer */}
      <AssetDetailDrawer
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onNavigateToEmployee={user => navigate(`/users?search=${user}`)}
      />
    </div>
  );
};