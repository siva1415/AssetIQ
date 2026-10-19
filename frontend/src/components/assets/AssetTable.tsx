import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  UserRoundPlus,
  UserRoundPen,
  Laptop,
  Monitor,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Info,
  Package,
  Clock,
  Server as ServerIcon,
  CalendarPlus,
  Download,
  Loader2,
} from 'lucide-react';
import {
  Asset,
  Employee,
  AssetQueryParams,
  AssetExportParams,
  FilterOptions,
  FleetKpiMetrics,
  ASSET_STATUSES,
  EOL_STATUSES,
  StandardEOLStatus,
  toStandardAssetStatus,
  formatEolDate,
  formatEolDaysLeft,
} from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import { SourceBadge } from '../common/SourceBadge';
import { ManagedByBadge } from '../common/ManagedByBadge';
import { DeviceTypeIcon } from '../common/DeviceTypeIcon';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { AssetDetailDrawer } from './AssetDetailDrawer';
import { AssignAssetModal } from './AssignAssetModal';
import { BulkAssignAssetModal } from './BulkAssignAssetModal';
import { EditEolModal } from './EditEolModal';
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
  allowAssignment?: boolean;
  allowBulkAssignment?: boolean;
  exportFilenamePrefix?: string;
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
  allowAssignment = false,
  allowBulkAssignment,
  exportFilenamePrefix,
}) => {
  const enableBulkAssignment = allowBulkAssignment !== undefined ? allowBulkAssignment : allowAssignment;
  const { dataRefreshKey, triggerDataRefresh } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Query state
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<string>(initialSourceFilter || '');
  const [deviceType, setDeviceType] = useState<string>('');
  const [assetStatus, setAssetStatus] = useState<string>(
    initialStatusFilter ? toStandardAssetStatus(initialStatusFilter) : ''
  );
  const [manufacturer, setManufacturer] = useState<string>('');
  const [model, setModel] = useState<string>('');
  // Clean assignment filter: only allow 'Auto' or 'Manual', discard 'Unassigned' or legacy values
  const getCleanAssignmentFilter = (filter?: string): string => {
    if (!filter) return '';
    const trimmed = filter.trim();
    if (trimmed.toLowerCase() === 'unassigned') return '';
    if (trimmed.toLowerCase() === 'auto' || trimmed.toLowerCase() === 'automatic') return 'Auto';
    if (trimmed.toLowerCase() === 'manual') return 'Manual';
    return '';
  };

  const [assignmentType, setAssignmentType] = useState<string>(() =>
    getCleanAssignmentFilter(initialAssignmentFilter)
  );

  // Guard against any stale 'Unassigned' or unsupported selection
  useEffect(() => {
    if (assignmentType && assignmentType !== 'Auto' && assignmentType !== 'Manual') {
      setAssignmentType('');
    }
  }, [assignmentType]);
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
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

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

  // EOL inline edit modal state
  const [eolModalAsset, setEolModalAsset] = useState<Asset | null>(null);

  // Bulk asset selection state
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string | number>>(new Set());
  const [selectedAssetsMap, setSelectedAssetsMap] = useState<Map<string | number, Asset>>(new Map());
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState<boolean>(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Current page asset IDs for selection
  const currentPageAssetIds = useMemo(() => {
    return assets.map(a => a.id).filter(id => id !== undefined && id !== null && id !== '');
  }, [assets]);

  // Is all on current page selected
  const isAllCurrentPageSelected = useMemo(() => {
    if (currentPageAssetIds.length === 0) return false;
    return currentPageAssetIds.every(id => selectedAssetIds.has(id));
  }, [currentPageAssetIds, selectedAssetIds]);

  // Is some (but not all) on current page selected (for indeterminate checkbox state)
  const isSomeCurrentPageSelected = useMemo(() => {
    if (currentPageAssetIds.length === 0) return false;
    return currentPageAssetIds.some(id => selectedAssetIds.has(id)) && !isAllCurrentPageSelected;
  }, [currentPageAssetIds, selectedAssetIds, isAllCurrentPageSelected]);

  // Set indeterminate state on header checkbox input DOM element
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeCurrentPageSelected;
    }
  }, [isSomeCurrentPageSelected]);

  // Toggle select all on current page
  const handleToggleSelectAllCurrentPage = () => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        // Unchecking clears current page only
        currentPageAssetIds.forEach(id => next.delete(id));
      } else {
        // Select all on current page
        currentPageAssetIds.forEach(id => next.add(id));
      }
      return next;
    });

    setSelectedAssetsMap(prev => {
      const next = new Map(prev);
      if (isAllCurrentPageSelected) {
        currentPageAssetIds.forEach(id => next.delete(id));
      } else {
        assets.forEach(a => {
          if (a.id) next.set(a.id, a);
        });
      }
      return next;
    });
  };

  // Toggle single asset selection
  const handleToggleSelectAsset = (asset: Asset) => {
    const id = asset.id;
    if (id === undefined || id === null || id === '') return;

    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    setSelectedAssetsMap(prev => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, asset);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedAssetIds(new Set());
    setSelectedAssetsMap(new Map());
  };

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
  const loadKpiMetrics = useCallback(() => {
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
  }, [initialSourceFilter]);

  useEffect(() => {
    return loadKpiMetrics();
  }, [loadKpiMetrics, dataRefreshKey]);

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

  // Supported standard device types
  const SUPPORTED_DEVICE_TYPES = ['Laptop', 'Desktop', 'Server'];

  // Populate dropdown options from real asset data and supported option list
  const deviceTypeOptions = useMemo(() => {
    const map = new Map<string, string>();
    SUPPORTED_DEVICE_TYPES.forEach(dt => map.set(dt.toLowerCase(), dt));

    if (filterOptions?.device_types) {
      filterOptions.device_types.forEach(dt => {
        if (typeof dt === 'string' && dt.trim()) {
          const trimmed = dt.trim();
          if (!map.has(trimmed.toLowerCase())) {
            map.set(trimmed.toLowerCase(), trimmed);
          }
        }
      });
    }

    assets.forEach(a => {
      const dt = (a.devicetype || '').trim();
      if (dt && !map.has(dt.toLowerCase())) {
        map.set(dt.toLowerCase(), dt);
      }
    });

    return Array.from(map.values());
  }, [filterOptions, assets]);

  // EOL options corresponding to canonical backend status values
  const eolStatusOptions = useMemo(() => {
    return [
      { value: 'ACTIVE', label: 'ACTIVE(≥90d)' },
      { value: 'EOL SOON', label: 'EOL SOON(≤90d)' },
      { value: 'EXPIRED', label: 'EXPIRED' },
      { value: 'UNKNOWN', label: 'UNKNOWN' },
    ];
  }, []);

  // Track request IDs to drop stale responses and prevent race conditions
  const latestRequestIdRef = useRef<number>(0);

  // Load assets
  const fetchAssets = async () => {
    const currentRequestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const trimmedDeviceType = deviceType.trim();
      const rawEol = eolStatus.trim();
      let trimmedEolStatus: string | undefined = undefined;
      if (rawEol) {
        const normEol = rawEol.toUpperCase().replace(/_/g, ' ');
        if (normEol === 'EOL SOON' || normEol === 'NEARING EOL') {
          trimmedEolStatus = 'EOL SOON';
        } else if (normEol === 'ACTIVE') {
          trimmedEolStatus = 'ACTIVE';
        } else if (normEol === 'EXPIRED') {
          trimmedEolStatus = 'EXPIRED';
        } else if (normEol === 'UNKNOWN') {
          trimmedEolStatus = 'UNKNOWN';
        } else {
          trimmedEolStatus = rawEol;
        }
      }

      const cleanAssignmentType =
        assignmentType === 'Auto' || assignmentType === 'Manual'
          ? assignmentType
          : undefined;

      const params: AssetQueryParams = {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        source: source || undefined,
        devicetype: trimmedDeviceType || undefined,
        device_type: trimmedDeviceType || undefined,
        asset_status: assetStatus ? toStandardAssetStatus(assetStatus) : undefined,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        assignment_type: cleanAssignmentType,
        eol_status: trimmedEolStatus || undefined,
        sort_by: sortBy === 'device_type' ? 'devicetype' : sortBy,
        sort_order: sortOrder,
      };

      const response = await api.getAssets(params);
      // Prevent stale API responses from overwriting results
      if (currentRequestId !== latestRequestIdRef.current) {
        return;
      }
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
      if (currentRequestId !== latestRequestIdRef.current) {
        return;
      }
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch asset inventory');
    } finally {
      if (currentRequestId === latestRequestIdRef.current) {
        setLoading(false);
      }
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

  const initialStandardStatus = initialStatusFilter ? toStandardAssetStatus(initialStatusFilter) : '';

  const handleClearFilters = () => {
    setSearch('');
    if (!initialSourceFilter) setSource('');
    setDeviceType('');
    setAssetStatus(initialStandardStatus);
    setManufacturer('');
    setModel('');
    setAssignmentType(getCleanAssignmentFilter(initialAssignmentFilter));
    setEolStatus(initialEolFilter || '');
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(!initialSourceFilter && source) ||
    Boolean(deviceType.trim()) ||
    Boolean(assetStatus !== initialStandardStatus) ||
    Boolean(manufacturer) ||
    Boolean(model) ||
    Boolean(assignmentType !== getCleanAssignmentFilter(initialAssignmentFilter)) ||
    Boolean(eolStatus.trim() !== (initialEolFilter || '').trim());

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
        asset.devicetype === 'Server' ||
        asset.assignment_type === 'Unassigned'
      ) {
        return 'GROUP';
      }
    }
    return asset.devicetype === 'Server' ? 'GROUP' : 'INDIVIDUAL';
  };

  // Export standardized CSV report from backend export endpoint
  const handleExportCsv = async () => {
    if (isExporting) return;

    if (totalCount === 0 && !loading) {
      setNotification({
        type: 'info',
        message: 'No records available to export',
      });
      return;
    }

    setIsExporting(true);
    try {
      const trimmedDeviceType = deviceType.trim();
      const rawEol = eolStatus.trim();
      let trimmedEolStatus: string | undefined = undefined;
      if (rawEol) {
        const normEol = rawEol.toUpperCase().replace(/_/g, ' ');
        if (normEol === 'EOL SOON' || normEol === 'NEARING EOL') {
          trimmedEolStatus = 'EOL SOON';
        } else if (normEol === 'ACTIVE') {
          trimmedEolStatus = 'ACTIVE';
        } else if (normEol === 'EXPIRED') {
          trimmedEolStatus = 'EXPIRED';
        } else if (normEol === 'UNKNOWN') {
          trimmedEolStatus = 'UNKNOWN';
        } else {
          trimmedEolStatus = rawEol;
        }
      }

      const cleanAssignmentType =
        assignmentType === 'Auto' || assignmentType === 'Manual'
          ? assignmentType
          : undefined;

      const exportParams: AssetExportParams = {
        search: search.trim() || undefined,
        source: source || undefined,
        devicetype: trimmedDeviceType || undefined,
        device_type: trimmedDeviceType || undefined,
        asset_status: assetStatus ? toStandardAssetStatus(assetStatus) : undefined,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        assignment_type: cleanAssignmentType,
        eol_status: trimmedEolStatus || undefined,
        sort_by: sortBy === 'device_type' ? 'devicetype' : sortBy,
        sort_order: sortOrder,
      };

      const result = await api.exportAssetsCsv(exportParams);

      if (!result.blob || result.blob.size === 0 || result.count === 0) {
        setNotification({
          type: 'info',
          message: 'No records available to export',
        });
        return;
      }

      // Check if text is only headers (empty dataset)
      if (result.blob.size < 600) {
        const textSample = await result.blob.slice(0, 1024).text();
        const lines = textSample.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          setNotification({
            type: 'info',
            message: 'No records available to export',
          });
          return;
        }
      }

      // Determine export filename (use backend supplied filename if available, else date-stamped name)
      let targetFilename = result.filename;
      if (!targetFilename) {
        let filePrefix = exportFilenamePrefix;
        if (!filePrefix) {
          if (initialSourceFilter === 'BIGFIX' || (hideSourceFilter && source === 'BIGFIX')) {
            filePrefix = 'AssetIQ_Windows_Assets';
          } else if (initialSourceFilter === 'JAMF' || (hideSourceFilter && source === 'JAMF')) {
            filePrefix = 'AssetIQ_Mac_Assets';
          } else if (allowAssignment || location.pathname.includes('/ownership')) {
            filePrefix = 'AssetIQ_Asset_Ownership';
          } else {
            filePrefix = 'AssetIQ_All_Assets';
          }
        }
        const todayStr = new Date().toISOString().split('T')[0];
        targetFilename = `${filePrefix}_${todayStr}.csv`;
      }

      // Trigger browser download using the blob returned by backend export endpoint
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', targetFilename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotification({
        type: 'success',
        message: `Successfully downloaded ${targetFilename}.`,
      });
    } catch (err: any) {
      console.error('[AssetTable] CSV export failed:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.detail ||
        err?.message ||
        'Failed to export standardized CSV report. Please try again.';
      setNotification({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const renderDeviceIcon = (type?: string | null) => {
    return <DeviceTypeIcon type={type} />;
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
              : notification.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'info' ? (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
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
            label="Review"
            value={
              typeof kpiMetrics?.review === 'number' && !isNaN(kpiMetrics.review)
                ? kpiMetrics.review
                : typeof kpiMetrics?.needValidation === 'number' && !isNaN(kpiMetrics.needValidation)
                ? kpiMetrics.needValidation
                : 0
            }
            loading={kpiLoading}
            error={kpiError}
            icon={AlertTriangle}
            subtitle="Flagged or audit discrepancies"
            colorTheme="amber"
            compact={true}
            onClick={() => {
              setAssetStatus(ASSET_STATUSES.REVIEW);
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
            label="EOL Soon"
            value={
              typeof kpiMetrics?.eolSoon === 'number' && !isNaN(kpiMetrics.eolSoon)
                ? kpiMetrics.eolSoon
                : typeof kpiMetrics?.nearingEol === 'number' && !isNaN(kpiMetrics.nearingEol)
                ? kpiMetrics.nearingEol
                : 0
            }
            loading={kpiLoading}
            error={kpiError}
            icon={Clock}
            subtitle="Lifecycle expiring ≤90d"
            colorTheme="orange"
            compact={true}
            onClick={() => {
              setEolStatus('EOL SOON');
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          {/* 1. Search Box */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by asset #, serial, model, username, employee, OS..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 pl-9 pr-8 text-xs bg-white text-slate-900 font-medium placeholder:text-slate-500 border border-slate-300 hover:border-slate-400 rounded-md shadow-2xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. All Sources */}
          {!hideSourceFilter && (
            <select
              value={source}
              onChange={e => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="h-9 px-2.5 text-xs bg-white border border-slate-300 hover:border-slate-400 rounded-md focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium shrink-0 cursor-pointer shadow-2xs transition-all"
            >
              <option value="">All Sources</option>
              <option value="BIGFIX">BigFix</option>
              <option value="JAMF">Jamf</option>
            </select>
          )}

          {/* 3. All Device Types */}
          <select
            value={deviceType}
            onChange={e => {
              setDeviceType(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2.5 text-xs bg-white border border-slate-300 hover:border-slate-400 rounded-md focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium shrink-0 cursor-pointer shadow-2xs transition-all"
          >
            <option value="">All Device Types</option>
            {deviceTypeOptions.map(dt => {
              let label = dt;
              const lower = dt.toLowerCase();
              if (lower === 'laptop') label = 'Laptops';
              else if (lower === 'desktop') label = 'Desktops';
              else if (lower === 'server') label = 'Servers';
              return (
                <option key={dt} value={dt}>
                  {label}
                </option>
              );
            })}
          </select>

          {/* 4. All Status */}
          <select
            value={assetStatus}
            onChange={e => {
              setAssetStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2.5 text-xs bg-white border border-slate-300 hover:border-slate-400 rounded-md focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium shrink-0 cursor-pointer shadow-2xs transition-all"
          >
            <option value="">All Status</option>
            <option value={ASSET_STATUSES.ACTIVE}>Active</option>
            <option value={ASSET_STATUSES.REVIEW}>Review</option>
            <option value={ASSET_STATUSES.IN_STOCK}>In Stock</option>
            <option value={ASSET_STATUSES.RETIRED}>Retired</option>
          </select>

          {/* 5. All Assignments */}
          <select
            value={assignmentType}
            onChange={e => {
              setAssignmentType(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2.5 text-xs bg-white border border-slate-300 hover:border-slate-400 rounded-md focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium shrink-0 cursor-pointer shadow-2xs transition-all"
          >
            <option value="">All Assignments</option>
            <option value="Auto">Auto</option>
            <option value="Manual">Manual</option>
          </select>

          {/* 6. All EOL States */}
          <select
            value={eolStatus}
            onChange={e => {
              setEolStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2.5 text-xs bg-white border border-slate-300 hover:border-slate-400 rounded-md focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium shrink-0 cursor-pointer shadow-2xs transition-all"
          >
            <option value="">All EOL States</option>
            {eolStatusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="h-9 w-9 inline-flex items-center justify-center bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-md shadow-2xs transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
            title={isExporting ? 'Exporting CSV...' : 'Export CSV'}
            aria-label="Export CSV"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="h-9 inline-flex items-center gap-1 px-2.5 text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors shrink-0 font-medium cursor-pointer"
              title="Clear all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {enableBulkAssignment && selectedAssetIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full font-bold bg-blue-600 text-white text-[11px] tabular-nums">
              {selectedAssetIds.size}
            </span>
            <span className="font-semibold text-slate-900">
              {selectedAssetIds.size === 1 ? '1 asset selected' : `${selectedAssetIds.size} assets selected`}
            </span>
            <span className="text-slate-400">·</span>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-blue-700 hover:text-blue-900 font-medium hover:underline cursor-pointer"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkAssignModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <UserRoundPlus className="w-4 h-4 stroke-[2.25]" />
              <span>Bulk Assign Selected ({selectedAssetIds.size})</span>
            </button>
          </div>
        </div>
      )}

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
            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[700px]">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  {/* Selection Checkbox Header */}
                  {enableBulkAssignment && (
                    <th className="w-[38px] py-2.5 px-2 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        ref={headerCheckboxRef}
                        checked={isAllCurrentPageSelected}
                        onChange={handleToggleSelectAllCurrentPage}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label="Select all assets on current page"
                      />
                    </th>
                  )}

                  {/* 1. Asset */}
                  <th
                    onClick={() => handleSort('asset_number')}
                    className="w-[9.5%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">Asset</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* 2. Source */}
                  <th
                    onClick={() => handleSort('source')}
                    className="w-[7.5%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">Source</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* 3. DeviceType */}
                  <th
                    onClick={() => handleSort('devicetype')}
                    className="w-[9.5%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">DeviceType</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* 4. Model */}
                  <th
                    onClick={() => handleSort('model')}
                    className="w-[13%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">Model</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* 5. SerialNumber */}
                  <th
                    onClick={() => handleSort('serial_number')}
                    className="w-[11%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">SerialNumber</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* 7. Assigned User */}
                  <th
                    onClick={() => handleSort('assigned_username')}
                    className="w-[14.5%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">Assigned User</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* 8. Managed By */}
                  <th
                    onClick={() => handleSort('managed_by')}
                    className="w-[9.5%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">Managed By</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* 9. Status */}
                  <th
                    onClick={() => handleSort('asset_status')}
                    className="w-[8%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* 10. EOL */}
                  <th
                    onClick={() => handleSort('days_remaining')}
                    className="w-[8.5%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[11px] font-semibold text-slate-700">EOL</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>

                  {/* Action */}
                  <th className="w-[9%] py-2.5 px-2 text-right whitespace-nowrap">
                    <span className="text-[11px] font-semibold text-slate-700">Action</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {assets.map(asset => {
                  const managedByDisplay = getManagedByDisplay(asset);
                  const isRowSelected = selectedAssetIds.has(asset.id);

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`cursor-pointer transition-colors ${
                        isRowSelected
                          ? 'bg-blue-50/70 hover:bg-blue-50'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      {/* Selection Checkbox Cell */}
                      {enableBulkAssignment && (
                        <td
                          className="py-2.5 px-2 text-center whitespace-nowrap align-middle"
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={() => handleToggleSelectAsset(asset)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            aria-label={`Select asset ${asset.asset_number}`}
                          />
                        </td>
                      )}

                      {/* 1. Asset */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                        <span
                          className="font-mono font-bold text-slate-900 text-xs block whitespace-nowrap uppercase"
                          style={{
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                          }}
                          title={asset.asset_number || asset.assetNumber}
                        >
                          {asset.asset_number || asset.assetNumber}
                        </span>
                      </td>

                      {/* 2. Source */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                        <SourceBadge source={asset.source} />
                      </td>

                      {/* 3. DeviceType */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                        {(() => {
                          const dt = (asset.devicetype || asset.device_type || '').toString().trim();
                          if (!dt) {
                            return <span className="text-slate-400 italic text-xs">—</span>;
                          }
                          return (
                            <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs truncate">
                              <DeviceTypeIcon type={dt} />
                              <span className="truncate">{dt}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 4. Model */}
                      <td className="py-2.5 px-2 align-middle overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-slate-900 truncate text-xs" title={`${asset.manufacturer} ${asset.model}`}>
                            {asset.model}
                          </span>
                          {(() => {
                            const rawEolStatus = asset.eol_status ?? asset.eolStatus;
                            const isEolUnknown =
                              typeof rawEolStatus === 'string' &&
                              rawEolStatus.trim().toUpperCase() === 'UNKNOWN';
                            if (!isEolUnknown) return null;
                            return (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setEolModalAsset(asset);
                                }}
                                className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer shrink-0"
                                title="Add EOL Date"
                                aria-label="Add EOL Date"
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                              </button>
                            );
                          })()}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5" title={asset.manufacturer}>
                          {asset.manufacturer}
                        </div>
                      </td>

                      {/* 5. SerialNumber */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle overflow-hidden">
                        <span className="font-mono text-slate-700 font-semibold block truncate text-xs" title={asset.serial_number}>
                          {asset.serial_number}
                        </span>
                      </td>

                      {/* 7. Assigned User */}
                      <td className="py-2.5 px-2 align-middle overflow-hidden">
                        {(() => {
                          const username = (asset.assignedUsername || asset.assigned_username || '').trim();
                          if (!username) {
                            return <span className="text-slate-400 italic text-xs">Unassigned</span>;
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
                              <div className="leading-tight overflow-hidden">
                                <div
                                  className="font-bold text-slate-900 truncate text-xs"
                                  title={displayName}
                                >
                                  {displayName}
                                </div>
                                <div
                                  className="font-mono text-[11px] text-slate-500 truncate mt-0.5"
                                  title={username}
                                >
                                  {username}
                                </div>
                              </div>
                            );
                          }

                          // Unmatched in Workday
                          return (
                            <div className="leading-tight overflow-hidden">
                              <div
                                className="font-mono font-semibold text-slate-900 truncate text-xs"
                                title={username}
                              >
                                {username}
                              </div>
                              <div
                                className="text-[10px] text-rose-600 truncate mt-0.5 font-medium"
                                title="Not found in Workday HCM directory"
                              >
                                ⚠ Not in Workday
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 8. Managed By */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                        <ManagedByBadge managedBy={managedByDisplay} />
                      </td>

                      {/* 9. Status */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                        <StatusBadge status={asset.asset_status} variant="solid" type="asset_status" />
                      </td>

                      {/* 10. EOL */}
                      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                        <div className="flex flex-col items-start">
                          <StatusBadge status={asset.eol_status || 'UNKNOWN'} variant="solid" type="eol_status" />
                          <span
                            className="text-[9px] font-mono text-slate-500 mt-0.5 tabular-nums leading-tight"
                            title={
                              asset.eol_date
                                ? `EOL Date: ${formatEolDate(asset.eol_date)}${
                                    asset.days_remaining !== null && asset.days_remaining !== undefined
                                      ? ` (${asset.days_remaining}d remaining)`
                                      : ''
                                  }`
                                : undefined
                            }
                          >
                            {formatEolDaysLeft(asset.eol_status, asset.days_remaining ?? asset.daysRemaining)}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap align-middle">
                        <div className="flex items-center justify-end gap-1">
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
                          {allowAssignment && (
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
                          )}
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
            fetchAssets();
            loadKpiMetrics();
            setNotification({ type: 'success', message: msg });
          }}
        />
      )}

      {/* Bulk Assign Asset Modal */}
      {isBulkAssignModalOpen && (
        <BulkAssignAssetModal
          selectedAssetIds={Array.from(selectedAssetIds)}
          selectedAssets={Array.from(selectedAssetsMap.values())}
          onClose={() => setIsBulkAssignModalOpen(false)}
          onSuccess={msg => {
            setIsBulkAssignModalOpen(false);
            handleClearSelection();
            triggerDataRefresh();
            fetchAssets();
            loadKpiMetrics();
            setNotification({ type: 'success', message: msg });
          }}
        />
      )}

      {/* Edit / Add EOL Date Modal */}
      {eolModalAsset && (
        <EditEolModal
          asset={eolModalAsset}
          onClose={() => setEolModalAsset(null)}
          onSuccess={(updatedEolDate, msg) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(updatedEolDate);
            targetDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            let calculatedStatus: StandardEOLStatus = EOL_STATUSES.ACTIVE;
            if (diffDays < 0) {
              calculatedStatus = EOL_STATUSES.EXPIRED;
            } else if (diffDays <= 90) {
              calculatedStatus = EOL_STATUSES.EOL_SOON;
            }

            setAssets(prev =>
              prev.map(a => {
                const matchesAsset = a.id === eolModalAsset.id;
                const matchesModel =
                  Boolean(a.manufacturer && eolModalAsset.manufacturer &&
                    a.manufacturer.toLowerCase().trim() === eolModalAsset.manufacturer.toLowerCase().trim()) &&
                  Boolean(a.model && eolModalAsset.model &&
                    a.model.toLowerCase().trim() === eolModalAsset.model.toLowerCase().trim());
                if (matchesAsset || matchesModel) {
                  return {
                    ...a,
                    eol_date: updatedEolDate,
                    eolDate: updatedEolDate,
                    eol_status: calculatedStatus,
                    eolStatus: calculatedStatus,
                    days_remaining: diffDays,
                    daysRemaining: diffDays,
                  };
                }
                return a;
              })
            );

            setEolModalAsset(null);
            triggerDataRefresh();
            fetchAssets();
            loadKpiMetrics();
            setNotification({ type: 'success', message: msg });
          }}
        />
      )}
    </div>
  );
};
