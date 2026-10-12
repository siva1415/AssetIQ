import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  Eye,
  UserRoundPlus,
  UserRoundPen,
  Laptop,
  Monitor,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Package,
  Clock,
  Server as ServerIcon,
} from 'lucide-react';
import { Asset, Employee, AssetQueryParams, FilterOptions, FleetKpiMetrics } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import { SourceBadge } from '../common/SourceBadge';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { AssetDetailDrawer } from './AssetDetailDrawer';
import { AssignAssetModal } from './AssignAssetModal';
import { KPICard } from '../dashboard/KPICard';

interface AssetTableProps {
  initialSourceFilter?: 'BIGFIX' | 'JAMF';
  initialStatusFilter?: string;
  initialAssignmentFilter?: string;
  initialEolFilter?: string;
  hideSourceFilter?: boolean;
  title?: string;
  subtitle?: string;
  showKPICards?: boolean;
}

export const AssetTable: React.FC<AssetTableProps> = ({
  initialSourceFilter,
  initialStatusFilter,
  initialAssignmentFilter,
  initialEolFilter,
  hideSourceFilter = false,
  title,
  subtitle,
  showKPICards = true,
}) => {
  const { dataRefreshKey, triggerDataRefresh } = useApp();
  const navigate = useNavigate();

  // Query state
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<string>(initialSourceFilter || '');
  const [deviceType, setDeviceType] = useState<string>('');
  const [assetStatus, setAssetStatus] = useState<string>(initialStatusFilter || '');
  const [manufacturer, setManufacturer] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [assignmentType, setAssignmentType] = useState<string>(initialAssignmentFilter || '');
  const [eolStatus, setEolStatus] = useState<string>(initialEolFilter || '');
  const [sortBy, setSortBy] = useState<string>('last_report_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  // Data state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fleet Summary KPI state (aligned with backend contract fields)
  const [kpiMetrics, setKpiMetrics] = useState<FleetKpiMetrics | null>(null);
  const [kpiLoading, setKpiLoading] = useState<boolean>(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  // Workday employee directory cache for robust user matching
  const [employeeDirectory, setEmployeeDirectory] = useState<Map<string, Employee>>(new Map());

  // Detail drawer
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Assign user modal state
  const [assignAsset, setAssignAsset] = useState<Asset | null>(null);

  // Auto-dismiss notification after 6 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load Workday employee directory for identity matching
  useEffect(() => {
    let isMounted = true;
    api
      .getEmployees({ page: 1, page_size: 1000 })
      .then(res => {
        if (!isMounted) return;
        const map = new Map<string, Employee>();
        (res.items || []).forEach(emp => {
          if (emp.user_id) map.set(emp.user_id.toLowerCase().trim(), emp);
          if (emp.employee_id) map.set(emp.employee_id.toLowerCase().trim(), emp);
        });
        setEmployeeDirectory(map);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [dataRefreshKey]);

  // Load Fleet Summary KPI metrics for the current source context
  useEffect(() => {
    let isMounted = true;
    setKpiLoading(true);
    setKpiError(null);

    // Apply BIGFIX on Windows, JAMF on Mac, or unified fleet
    api
      .getFleetKpiSummary({ source: initialSourceFilter || undefined })
      .then(metrics => {
        if (!isMounted) return;
        setKpiMetrics(metrics);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setKpiError(err?.message || 'Failed to calculate Fleet Summary KPI metrics');
      })
      .finally(() => {
        if (isMounted) setKpiLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialSourceFilter, dataRefreshKey]);

  // Load filter dropdown options
  useEffect(() => {
    let isMounted = true;
    api
      .getFilters()
      .then(res => {
        if (!isMounted) return;
        setFilterOptions(res);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [dataRefreshKey]);

  // Load assets
  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: AssetQueryParams = {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        source: source || undefined,
        device_type: deviceType || undefined,
        asset_status: assetStatus || undefined,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        assignment_type: assignmentType || undefined,
        eol_status: eolStatus || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      const response = await api.getAssets(params);
      setAssets(response.items);
      setTotalCount(response.total);
      setTotalPages(response.total_pages);
      // Reuse backend-returned KPI summary on initial scope fetch if available
      if (response.summary && page === 1 && !hasActiveFilters) {
        setKpiMetrics(response.summary);
        setKpiLoading(false);
        setKpiError(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch asset inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [
    page,
    search,
    source,
    deviceType,
    assetStatus,
    manufacturer,
    model,
    assignmentType,
    eolStatus,
    sortBy,
    sortOrder,
    dataRefreshKey,
  ]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    if (!initialSourceFilter) setSource('');
    setDeviceType('');
    setAssetStatus(initialStatusFilter || '');
    setManufacturer('');
    setModel('');
    setAssignmentType(initialAssignmentFilter || '');
    setEolStatus(initialEolFilter || '');
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(!initialSourceFilter && source) ||
    Boolean(deviceType) ||
    Boolean(assetStatus !== (initialStatusFilter || '')) ||
    Boolean(manufacturer) ||
    Boolean(model) ||
    Boolean(assignmentType !== (initialAssignmentFilter || '')) ||
    Boolean(eolStatus !== (initialEolFilter || ''));

  // Format Managed By as GROUP or INDIVIDUAL
  const getManagedByDisplay = (asset: Asset): 'GROUP' | 'INDIVIDUAL' => {
    if (asset.managed_by) {
      const val = asset.managed_by.trim().toUpperCase();
      if (val === 'GROUP' || val === 'INDIVIDUAL') {
        return val;
      }
      if (
        val.includes('GROUP') ||
        val.includes('DATACENTER') ||
        val.includes('POOL') ||
        val.includes('SERVER') ||
        asset.device_type === 'Server' ||
        asset.assignment_type === 'Unassigned'
      ) {
        return 'GROUP';
      }
    }
    return asset.device_type === 'Server' ? 'GROUP' : 'INDIVIDUAL';
  };

  // CSV Export with exact matching headers
  const handleExportCSV = () => {
    if (assets.length === 0) return;

    const headers = [
      'Asset',
      'Source',
      'DeviceType',
      'Model',
      'OS/Host',
      'SerialNumber',
      'Assigned User',
      'Managed By',
      'Status',
      'EOL',
      'Days Remaining',
      'Manufacturer',
      'MAC Address',
      'Last Report Time',
    ];

    const rows = assets.map(a => [
      a.asset_number,
      a.source,
      a.device_type,
      `"${a.model}"`,
      `"${a.os_name}${a.hostname ? ' (' + a.hostname + ')' : ''}"`,
      a.serial_number,
      a.assigned_username || '',
      getManagedByDisplay(a),
      a.asset_status,
      a.calculated_eol_status,
      a.days_remaining !== null ? a.days_remaining : '',
      `"${a.manufacturer}"`,
      a.mac_address,
      a.last_report_time,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const fileLabel = initialSourceFilter ? `${initialSourceFilter}_Assets` : (title ? title.replace(/\s+/g, '_') : 'Assets');
    link.setAttribute('download', `AssetIQ_${fileLabel}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderDeviceIcon = (type: string) => {
    if (type === 'Server') return <ServerIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
    if (type === 'Desktop') return <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    return <Laptop className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  };

  // Top card labels and icons based on source
  const totalCardLabel = 'Total Assets';

  const TotalCardIcon =
    initialSourceFilter === 'BIGFIX'
      ? Monitor
      : initialSourceFilter === 'JAMF'
      ? Laptop
      : HardDrive;

  return (
    <div className="space-y-4">
      {/* Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs shadow-2xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Optional Heading (rendered ONLY if title prop is explicitly provided) */}
      {title && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
      )}

      {/* KPI Cards Strip */}
      {showKPICards && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard
            label="Total Assets"
            value={typeof kpiMetrics?.totalAssets === 'number' && !isNaN(kpiMetrics.totalAssets) ? kpiMetrics.totalAssets : 0}
            loading={kpiLoading}
            error={kpiError}
            icon={TotalCardIcon}
            subtitle={
              initialSourceFilter === 'BIGFIX'
                ? 'BigFix (Windows) fleet'
                : initialSourceFilter === 'JAMF'
                ? 'Jamf (Mac) fleet'
                : 'Unified inventory fleet'
            }
            colorTheme="default"
            compact={true}
            onClick={() => {
              setAssetStatus('');
              setEolStatus('');
              setPage(1);
            }}
          />
          <KPICard
            label="Active"
            value={typeof kpiMetrics?.active === 'number' && !isNaN(kpiMetrics.active) ? kpiMetrics.active : 0}
            loading={kpiLoading}
            error={kpiError}
            icon={CheckCircle2}
            subtitle="Operational & healthy"
            colorTheme="emerald"
            compact={true}
            onClick={() => {
              setAssetStatus('Active');
              setPage(1);
            }}
          />
          <KPICard
            label="Need Validation"
            value={typeof kpiMetrics?.needValidation === 'number' && !isNaN(kpiMetrics.needValidation) ? kpiMetrics.needValidation : 0}
            loading={kpiLoading}
            error={kpiError}
            icon={AlertTriangle}
            subtitle="Flagged or audit discrepancies"
            colorTheme="amber"
            compact={true}
            onClick={() => {
              setAssetStatus('Need Validation');
              setPage(1);
            }}
          />
          <KPICard
            label="InStock"
            value={typeof kpiMetrics?.inStock === 'number' && !isNaN(kpiMetrics.inStock) ? kpiMetrics.inStock : 0}
            loading={kpiLoading}
            error={kpiError}
            icon={Package}
            subtitle="Available pool / In Stock"
            colorTheme="blue"
            compact={true}
            onClick={() => {
              setAssetStatus('In Stock');
              setPage(1);
            }}
          />
          <KPICard
            label="Nearing EOL"
            value={typeof kpiMetrics?.nearingEol === 'number' && !isNaN(kpiMetrics.nearingEol) ? kpiMetrics.nearingEol : 0}
            loading={kpiLoading}
            error={kpiError}
            icon={Clock}
            subtitle="Lifecycle expiring ≤90d"
            colorTheme="orange"
            compact={true}
            onClick={() => {
              setEolStatus('Nearing EOL');
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Filter, Search, and Action Toolbar */}
      <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by asset #, serial, model, username, employee, OS..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Select Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Source dropdown (only if not restricted to BigFix/Jamf) */}
            {!hideSourceFilter && (
              <select
                value={source}
                onChange={e => {
                  setSource(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
              >
                <option value="">All Sources</option>
                <option value="BIGFIX">BigFix (Windows/Linux)</option>
                <option value="JAMF">Jamf (Apple/macOS)</option>
              </select>
            )}

            {/* Device Type */}
            <select
              value={deviceType}
              onChange={e => {
                setDeviceType(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="">All Device Types</option>
              <option value="Laptop">Laptops</option>
              <option value="Desktop">Desktops</option>
              <option value="Server">Servers</option>
            </select>

            {/* Status */}
            <select
              value={assetStatus}
              onChange={e => {
                setAssetStatus(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Need Validation">Need Validation</option>
              <option value="In Stock">In Stock</option>
              <option value="Retired">Retired</option>
            </select>

            {/* Assignment Type */}
            <select
              value={assignmentType}
              onChange={e => {
                setAssignmentType(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="">All Assignments</option>
              <option value="Automatic">Automatic Match</option>
              <option value="Manual">Manual Assignment</option>
              <option value="Unassigned">Unassigned</option>
            </select>

            {/* EOL Status */}
            <select
              value={eolStatus}
              onChange={e => {
                setEolStatus(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="">All EOL States</option>
              <option value="Active">Active (&gt;90d)</option>
              <option value="Nearing EOL">Nearing EOL (≤90d)</option>
              <option value="Expired">Expired</option>
              <option value="Unknown">Unknown</option>
            </select>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}

            {/* Export CSV action button in toolbar */}
            <button
              onClick={handleExportCSV}
              disabled={assets.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs shrink-0"
              title="Download filtered assets CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table or State */}
      {error ? (
        <ErrorState error={error} onRetry={fetchAssets} />
      ) : loading ? (
        <LoadingState message="Querying hardware assets from discovery telemetry..." rows={8} />
      ) : assets.length === 0 ? (
        <EmptyState
          title="No assets matching filter"
          description="Try broadening your search term or resetting the selected filters."
          actionLabel={hasActiveFilters ? 'Reset Filters' : undefined}
          onAction={handleClearFilters}
        />
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold select-none">
                <tr>
                  {/* 1. Asset */}
                  <th
                    onClick={() => handleSort('asset_number')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Asset</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 2. Source */}
                  <th
                    onClick={() => handleSort('source')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Source</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 3. DeviceType */}
                  <th
                    onClick={() => handleSort('device_type')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>DeviceType</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 4. Model */}
                  <th
                    onClick={() => handleSort('model')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Model</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 5. OS/Host */}
                  <th
                    onClick={() => handleSort('os_name')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>OS/Host</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 6. SerialNumber */}
                  <th
                    onClick={() => handleSort('serial_number')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>SerialNumber</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 7. Assigned User */}
                  <th
                    onClick={() => handleSort('assigned_username')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Assigned User</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 8. Managed By */}
                  <th
                    onClick={() => handleSort('managed_by')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Managed By</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 9. Status */}
                  <th
                    onClick={() => handleSort('asset_status')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* 10. EOL */}
                  <th
                    onClick={() => handleSort('days_remaining')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>EOL</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* Action */}
                  <th className="py-3 px-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {assets.map(asset => {
                  const managedByDisplay = getManagedByDisplay(asset);

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      {/* 1. Asset */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 block" title={asset.asset_number}>
                          {asset.asset_number}
                        </span>
                      </td>

                      {/* 2. Source */}
                      <td className="py-3 px-3 whitespace-nowrap align-middle">
                        <SourceBadge source={asset.source} />
                      </td>

                      {/* 3. DeviceType */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {(() => {
                          const dt = (asset.deviceType || asset.device_type || asset.devicetype || '').trim();
                          if (!dt) {
                            return <span className="text-slate-400 italic text-xs">—</span>;
                          }
                          return (
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              {renderDeviceIcon(dt)}
                              <span>{dt}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 4. Model */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 truncate max-w-[170px]" title={`${asset.manufacturer} ${asset.model}`}>
                          {asset.model}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[170px]" title={asset.manufacturer}>
                          {asset.manufacturer}
                        </div>
                      </td>

                      {/* 5. OS/Host */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 truncate max-w-[170px]" title={asset.os_name}>
                          {asset.os_name}
                        </div>
                        {(asset.hostname || asset.mac_address) && (
                          <div
                            className="font-mono text-[10px] text-slate-500 truncate max-w-[170px]"
                            title={asset.hostname ? `Host: ${asset.hostname} | MAC: ${asset.mac_address}` : `MAC: ${asset.mac_address}`}
                          >
                            {asset.hostname ? asset.hostname : asset.mac_address}
                          </div>
                        )}
                      </td>

                      {/* 6. SerialNumber */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono text-slate-700 font-semibold block truncate max-w-[130px]" title={asset.serial_number}>
                          {asset.serial_number}
                        </span>
                      </td>

                      {/* 7. Assigned User */}
                      <td className="py-3 px-3">
                        {(() => {
                          const username = (asset.assignedUsername || asset.assigned_username || '').trim();
                          if (!username) {
                            return <span className="text-slate-400 italic">Unassigned</span>;
                          }

                          // 1. Check directory match against workday employees
                          const matchedEmp = employeeDirectory.get(username.toLowerCase());

                          // 2. Check candidate full name on asset record
                          const candidateFullName = (
                            matchedEmp?.full_name ||
                            asset.verifiedEmployeeName ||
                            asset.verified_employee_name ||
                            asset.fullName ||
                            asset.full_name ||
                            asset.workdayEmployee?.full_name ||
                            asset.workday_employee?.full_name ||
                            asset.employee?.full_name ||
                            ''
                          ).trim();

                          // 3. Match determination
                          const isMatched = Boolean(
                            matchedEmp ||
                            (candidateFullName && candidateFullName.toLowerCase() !== username.toLowerCase()) ||
                            asset.workdayStatus === 'Matched' ||
                            asset.workday_status === 'Matched'
                          );

                          if (isMatched) {
                            const displayName = candidateFullName && candidateFullName.toLowerCase() !== username.toLowerCase()
                              ? candidateFullName
                              : (matchedEmp?.full_name || username);

                            return (
                              <div className="leading-tight">
                                <div
                                  className="font-bold text-slate-900 truncate max-w-[150px]"
                                  title={displayName}
                                >
                                  {displayName}
                                </div>
                                <div
                                  className="font-mono text-xs text-slate-500 truncate max-w-[150px] mt-0.5"
                                  title={username}
                                >
                                  {username}
                                </div>
                              </div>
                            );
                          }

                          // Unmatched in Workday
                          return (
                            <div>
                              <div
                                className="font-mono font-semibold text-slate-900 truncate max-w-[140px]"
                                title={username}
                              >
                                {username}
                              </div>
                              <div
                                className="text-[10px] text-rose-600 truncate max-w-[140px]"
                                title="Not found in Workday HCM directory"
                              >
                                ⚠ Not in Workday
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 8. Managed By */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide border ${
                            managedByDisplay === 'INDIVIDUAL'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                          title={`Management attribution: ${managedByDisplay}${asset.managed_by ? ` (via ${asset.managed_by})` : ''}`}
                        >
                          {managedByDisplay}
                        </span>
                      </td>

                      {/* 9. Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={asset.assetStatus || asset.asset_status} variant="solid" type="asset_status" />
                      </td>

                      {/* 10. EOL */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col items-start">
                          <StatusBadge status={asset.eolStatus || asset.calculated_eol_status || 'Unknown'} variant="solid" type="eol_status" />
                          {asset.days_remaining !== null && asset.days_remaining !== undefined && (
                            <span className="text-[10px] font-mono text-slate-500 mt-0.5 tabular-nums">
                              {asset.days_remaining > 0 ? `${asset.days_remaining}d left` : 'Expired'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedAsset(asset);
                            }}
                            className="w-7 h-7 inline-flex items-center justify-center text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 transition-colors"
                            title="View Asset Details"
                            aria-label="View Asset Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setAssignAsset(asset);
                            }}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-xs hover:shadow hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                            title="Assign / Reassign User"
                            aria-label="Assign / Reassign User"
                          >
                            <UserRoundPlus className="w-4 h-4 stroke-[2.25]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
            {(() => {
              const safeTotal = typeof totalCount === 'number' && !isNaN(totalCount) ? Math.max(0, totalCount) : 0;
              const safeStart = safeTotal === 0 ? 0 : (page - 1) * pageSize + 1;
              const safeEnd = safeTotal === 0 ? 0 : Math.min(page * pageSize, safeTotal);
              return (
                <div className="text-slate-500">
                  Showing <span className="font-semibold text-slate-800 tabular-nums">{safeStart}</span> to{' '}
                  <span className="font-semibold text-slate-800 tabular-nums">{safeEnd}</span> of{' '}
                  <span className="font-semibold text-slate-800 font-mono tabular-nums">{safeTotal}</span> assets
                </div>
              );
            })()}

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="p-1.5 border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-slate-600 font-medium">
                Page <span className="font-mono tabular-nums">{page}</span> of{' '}
                <span className="font-mono tabular-nums">{Math.max(1, totalPages || 1)}</span>
              </span>

              <button
                disabled={page >= (totalPages || 1) || (Number(totalCount) || 0) === 0}
                onClick={() => setPage(p => Math.min(p + 1, Math.max(1, totalPages || 1)))}
                className="p-1.5 border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Detail Drawer */}
      <AssetDetailDrawer
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onNavigateToEmployee={user => navigate(`/users?search=${user}`)}
      />

      {/* Assign Asset User Modal */}
      {assignAsset && (
        <AssignAssetModal
          asset={assignAsset}
          onClose={() => setAssignAsset(null)}
          onSuccess={msg => {
            setAssignAsset(null);
            triggerDataRefresh();
            setNotification({ type: 'success', message: msg });
          }}
        />
      )}
    </div>
  );
};
