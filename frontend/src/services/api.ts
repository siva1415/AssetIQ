import axios, { AxiosInstance } from 'axios';
import * as XLSX from 'xlsx';
import {
  Asset,
  AssetSource,
  AssetStatus,
  StandardAssetStatus,
  ASSET_STATUSES,
  toStandardAssetStatus,
  AssignmentType,
  EOLStatus,
  StandardEOLStatus,
  toStandardEOLStatus,
  formatEolDate,
  Employee,
  EmployeeStatus,
  FleetKpiMetrics,
  DeviceEOLReference,
  DeviceEOLReferenceCreate,
  DeviceEOLReferenceUpdate,
  DashboardSummary,
  DashboardRedesignOverview,
  HardwareAnalysisResponse,
  AssetsBySourceItem,
  OwnershipSummaryItem,
  EOLSummaryItem,
  OperationalStatusItem,
  DepartmentDistributionItem,
  FilterOptions,
  PaginatedResponse,
  HealthResponse,
  AssetQueryParams,
  EmployeeQueryParams,
  AdminUser,
  AvailableWorkdayUser,
  AvailableWorkdayUsersQueryParams,
  PaginatedAvailableUsersResponse,
  BulkAddAdminUsersRequest,
  BulkAddAdminUsersResponse,
  ReassignAssetRequest,
  ReassignAssetResponse,
  BulkAssignAssetsRequest,
  BulkAssignAssetsResponse,
  AssetExportParams,
  AssetExportResponse,
} from '../types';
import {
  MOCK_ASSETS,
  MOCK_EMPLOYEES,
  MOCK_HEALTH,
  calculateMockSummary,
  getMockAssetsBySource,
  getMockOwnershipSummary,
  getMockEOLSummary,
  getMockOperationalStatus,
  getMockDepartmentDistribution,
  getMockFilters,
  filterAndPaginateAssets,
  filterAndPaginateEmployees,
  getMockEOLReferences,
  createMockEOLReference,
  updateMockEOLReference,
  deleteMockEOLReference,
  getMockAdminUsers,
  getMockAvailableWorkdayUsers,
  bulkAddMockAdminUsers,
  deleteMockAdminUser,
  reassignMockAsset,
  bulkAssignMockAssets,
  generateMockAssetsCsvExport,
  generateMockReportXlsxExport,
  buildReportXlsxFromAssets,
  calculateMockReportStats,
} from './mockData';

export interface ReportCardStats {
  masterCount: number;
  expiredCount: number;
  expiringCount: number;
  totalWarrantyIssues: number;
  bigFixCount: number;
  jamfCount: number;
  inStockCount: number;
  needValidationCount: number;
}

// Storage keys
const MOCK_MODE_STORAGE_KEY = 'asset_iq_mock_mode';
const CUSTOM_BASE_URL_KEY = 'asset_iq_custom_api_url';

export type ApiErrorType = 'NETWORK_FAILURE' | 'HTTP_ERROR' | 'INVALID_RESPONSE_DATA';

export class ApiError extends Error {
  public readonly type: ApiErrorType;
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly url: string;
  public readonly detail?: any;
  public readonly originalError?: any;

  constructor(params: {
    type: ApiErrorType;
    message: string;
    url: string;
    status?: number;
    statusText?: string;
    detail?: any;
    originalError?: any;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.type = params.type;
    this.url = params.url;
    this.status = params.status;
    this.statusText = params.statusText;
    this.detail = params.detail;
    this.originalError = params.originalError;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function getInitialMockMode(): boolean {
  // 1. Explicit env variable override if provided
  const metaEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  if (metaEnv?.VITE_MOCK_MODE !== undefined) {
    return metaEnv.VITE_MOCK_MODE === 'true';
  }
  // 2. Saved user preference in localStorage
  const saved = typeof window !== 'undefined' ? localStorage.getItem(MOCK_MODE_STORAGE_KEY) : null;
  if (saved !== null) {
    return saved === 'true';
  }
  // 3. Default to live mode if VITE_API_BASE_URL is provided, otherwise mock preview
  const envUrl = (metaEnv?.VITE_API_BASE_URL || '').trim();
  if (envUrl) {
    return false;
  }
  // Default to false (live API mode) so live connection is attempted first as expected
  return false;
}

export function setStoredMockMode(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_MODE_STORAGE_KEY, String(enabled));
  }
}

export function getApiBaseUrl(): string {
  let raw = '';
  // 1. Check custom override from user settings in localStorage
  const custom = (typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_BASE_URL_KEY) : null)?.trim();
  if (custom) {
    raw = custom;
  } else {
    // 2. Check environment variable VITE_API_BASE_URL
    const metaEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
    const envUrl = (metaEnv?.VITE_API_BASE_URL || '').trim();
    if (envUrl) {
      raw = envUrl;
    } else if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      // 3. For local development on localhost or 127.0.0.1 (e.g. port 5173), default to http://localhost:8000
      raw = 'http://localhost:8000';
    }
  }

  let cleaned = raw.replace(/\/+$/, '');
  // Prevent duplicate /api prefixes if user specified e.g. http://localhost:8000/api
  if (cleaned.endsWith('/api')) {
    cleaned = cleaned.slice(0, -4);
  }
  return cleaned;
}

export function setStoredApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const trimmed = url.trim();
    if (!trimmed) {
      localStorage.removeItem(CUSTOM_BASE_URL_KEY);
    } else {
      localStorage.setItem(CUSTOM_BASE_URL_KEY, trimmed.replace(/\/+$/, ''));
    }
  }
}

// Data normalization function for Asset records from FastAPI backend
export function normalizeAsset(raw: any): Asset {
  if (!raw) return raw;

  const id = raw.assetId ?? raw.asset_id ?? raw.id ?? '';
  const assetNumber = raw.assetNumber ?? raw.asset_number ?? String(id || '—');
  const serialNumber = raw.serialNumber ?? raw.serial_number ?? '—';
  const source = ((raw.source || '').toUpperCase() === 'JAMF' ? 'JAMF' : 'BIGFIX') as AssetSource;
  const manufacturer = raw.manufacturer || '—';
  const model = raw.model || '—';
  const osName = raw.osName ?? raw.os_name ?? raw.osname ?? '—';
  const hostname = raw.hostname ?? null;

  // Device Type: Canonical devicetype from FastAPI backend
  const deviceType = (raw.devicetype ?? raw.device_type ?? raw.deviceType ?? '').trim();

  // MAC Address: Agreed property macAddress, mapped from macaddress
  const macAddress = raw.macAddress ?? raw.mac_address ?? raw.macaddress ?? '—';

  // Last Discovery Date: Agreed property lastDiscoveryDate, mapped from lastreporttime
  const lastDiscoveryDate = raw.lastDiscoveryDate ?? raw.last_report_time ?? raw.lastreporttime ?? raw.last_discovery_date ?? '';

  // EOL: Canonical eol_status and eol_date from backend API
  const rawEol = raw.eol_status ?? raw.eolStatus ?? raw.calculated_eol_status ?? raw.calculatedEolStatus;
  const eolStatus: StandardEOLStatus = toStandardEOLStatus(rawEol);
  const rawEolDate = raw.eolDate ?? raw.eol_date ?? null;
  const eolDate = rawEolDate && String(rawEolDate).trim() !== '' && String(rawEolDate).trim() !== '—'
    ? String(rawEolDate).trim()
    : null;
  const rawDays = raw.daysRemaining ?? raw.days_remaining ?? null;
  const daysRemaining = rawDays !== null && rawDays !== undefined && !isNaN(Number(rawDays))
    ? Number(rawDays)
    : null;

  // Status & Assignment: Canonical asset_status
  const rawStatus = raw.asset_status ?? raw.assetStatus ?? raw.status;
  const assetStatus = toStandardAssetStatus(rawStatus);
  const assignmentType = (raw.assignmentType ?? raw.assignment_type ?? 'Unassigned') as AssignmentType;
  // Canonical managed_by property from backend API contract ('GROUP' | 'INDIVIDUAL')
  const managedBy = typeof raw.managed_by === 'string' ? raw.managed_by.trim() : (raw.managed_by || '');

  // Assigned Username & Workday Matching
  const assignedUsername = raw.assignedUsername ?? raw.assigned_username ?? raw.username ?? null;
  const verifiedEmployeeId = raw.verifiedEmployeeId ?? raw.verified_employee_id ?? raw.employee?.employee_id ?? raw.workday_employee?.employee_id ?? null;
  const verifiedEmployeeName = raw.verifiedEmployeeName ?? raw.verified_employee_name ?? raw.employeeName ?? raw.employee_name ?? raw.fullName ?? raw.full_name ?? raw.employee?.full_name ?? raw.workday_employee?.full_name ?? null;
  const employeeStatus = raw.employeeStatus ?? raw.employee_status ?? raw.employee?.employee_status ?? raw.workday_employee?.employee_status ?? null;
  const workdayStatus = raw.workdayStatus ?? raw.workday_status ?? raw.matchStatus ?? raw.match_status ?? (verifiedEmployeeName ? 'Matched' : (assignedUsername ? 'Not Found in Workday' : 'Unassigned'));

  return {
    id,
    assetId: id,
    asset_number: assetNumber,
    assetNumber,
    serial_number: serialNumber,
    serialNumber,
    source,
    manufacturer,
    model,
    os_name: osName,
    osName,
    hostname,
    mac_address: macAddress,
    macAddress,
    macaddress: macAddress,
    device_type: deviceType,
    deviceType,
    devicetype: deviceType,
    managed_by: managedBy,
    managedBy,
    assigned_username: assignedUsername,
    assignedUsername,
    last_report_time: lastDiscoveryDate,
    lastDiscoveryDate,
    lastreporttime: lastDiscoveryDate,
    asset_status: assetStatus,
    assetStatus,
    assignment_type: assignmentType,
    assignmentType,
    eol_date: eolDate,
    eolDate,
    eol_status: eolStatus,
    calculated_eol_status: eolStatus,
    eolStatus,
    days_remaining: daysRemaining,
    daysRemaining,
    verified_employee_id: verifiedEmployeeId,
    verifiedEmployeeId,
    verified_employee_name: verifiedEmployeeName,
    verifiedEmployeeName,
    full_name: verifiedEmployeeName,
    fullName: verifiedEmployeeName,
    email_work: raw.email_work ?? raw.work_email ?? raw.workEmail ?? raw.employee?.work_email ?? null,
    work_email: raw.work_email ?? raw.workEmail ?? raw.email_work ?? raw.employee?.work_email ?? null,
    workEmail: raw.workEmail ?? raw.work_email ?? raw.email_work ?? raw.employee?.work_email ?? null,
    division: raw.division ?? raw.employee?.division ?? '',
    job_title: raw.job_title ?? raw.jobTitle ?? raw.employee?.job_title ?? '',
    jobTitle: raw.jobTitle ?? raw.job_title ?? raw.employee?.job_title ?? '',
    manager_user_name:
      raw.manager_user_name ??
      raw.manager_username ??
      raw.managerUsername ??
      raw.manager_user ??
      raw.employee?.manager_user_name ??
      raw.employee?.manager_username ??
      raw.workday_employee?.manager_user_name ??
      raw.workday_employee?.manager_username ??
      raw.matched_employee?.manager_user_name ??
      raw.matched_employee?.manager_username ??
      null,
    manager_username:
      raw.manager_user_name ??
      raw.manager_username ??
      raw.managerUsername ??
      raw.manager_user ??
      raw.employee?.manager_user_name ??
      raw.employee?.manager_username ??
      raw.workday_employee?.manager_user_name ??
      raw.workday_employee?.manager_username ??
      raw.matched_employee?.manager_user_name ??
      raw.matched_employee?.manager_username ??
      null,
    managerUsername:
      raw.manager_user_name ??
      raw.manager_username ??
      raw.managerUsername ??
      raw.manager_user ??
      raw.employee?.manager_user_name ??
      raw.employee?.manager_username ??
      raw.workday_employee?.manager_user_name ??
      raw.workday_employee?.manager_username ??
      raw.matched_employee?.manager_user_name ??
      raw.matched_employee?.manager_username ??
      null,
    manager_name:
      raw.manager_name ??
      raw.managerName ??
      raw.employee?.manager_name ??
      raw.workday_employee?.manager_name ??
      raw.matched_employee?.manager_name ??
      null,
    managerName:
      raw.manager_name ??
      raw.managerName ??
      raw.employee?.manager_name ??
      raw.workday_employee?.manager_name ??
      raw.matched_employee?.manager_name ??
      null,
    employee_status: employeeStatus,
    employeeStatus,
    workday_status: workdayStatus,
    workdayStatus,
    employee: raw.employee ?? null,
    workday_employee: raw.workday_employee ?? null,
    workdayEmployee: raw.workdayEmployee ?? null,
    matched_employee: raw.matched_employee ?? null,
    matchedEmployee: raw.matchedEmployee ?? null,
    department: raw.department ?? raw.employee?.department ?? '',
    ip_address: raw.ip_address ?? raw.ipAddress ?? '',
    cpu: raw.cpu ?? '',
    ram_gb: raw.ram_gb ?? raw.ramGb,
    storage_gb: raw.storage_gb ?? raw.storageGb,
    notes: raw.notes ?? raw.remarks ?? '',
    remarks: raw.remarks ?? raw.notes ?? '',
  };
}

// Normalizer for Workday Employee records from FastAPI / PostgreSQL
export function normalizeEmployee(raw: any): Employee {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      employee_id: '',
      user_id: '',
      full_name: '',
      work_email: '',
      department: '',
      division: '',
      job_title: '',
      employee_status: 'Active',
      manager_username: null,
      manager_name: null,
      location: '',
      hire_date: '',
    };
  }
  const employeeId = String(raw.employee_id ?? raw.employeeId ?? raw.user_id ?? '');
  const userId = String(raw.user_id ?? raw.userId ?? raw.username ?? raw.employee_id ?? '');
  const fullName = String(raw.full_name ?? raw.fullName ?? raw.name ?? '');
  const workEmail = String(raw.work_email ?? raw.workEmail ?? raw.email_work ?? raw.email ?? '');
  const mgrUsername =
    raw.manager_username ??
    raw.manager_user_name ??
    raw.managerUsername ??
    raw.manager_user ??
    null;
  const mgrName = raw.manager_name ?? raw.managerName ?? null;

  return {
    id: raw.id ?? employeeId,
    employee_id: employeeId,
    user_id: userId,
    full_name: fullName,
    work_email: workEmail,
    department: String(raw.department ?? ''),
    division: String(raw.division ?? ''),
    job_title: String(raw.job_title ?? raw.jobTitle ?? ''),
    employee_status: (raw.employee_status ?? raw.employeeStatus ?? raw.status ?? 'Active') as EmployeeStatus,
    manager_username: mgrUsername,
    manager_user_name: mgrUsername,
    managerUsername: mgrUsername,
    manager_name: mgrName,
    managerName: mgrName,
    location: String(raw.location ?? ''),
    hire_date: String(raw.hire_date ?? raw.hireDate ?? ''),
    assigned_assets_count:
      Number(raw.assigned_assets_count ?? raw.assignedAssetsCount) ||
      (Array.isArray(raw.assigned_assets) ? raw.assigned_assets.length : undefined),
    assigned_assets: Array.isArray(raw.assigned_assets)
      ? raw.assigned_assets.map(normalizeAsset)
      : undefined,
  };
}

// Normalizer for AvailableWorkdayUser records from Workday directory API
export function normalizeAvailableWorkdayUser(raw: any): AvailableWorkdayUser {
  if (!raw) {
    return {
      user_id: '',
      full_name: '—',
      email_work: '—',
      department: '—',
      employee_status: 'Active',
      is_admin: false,
    };
  }

  const userId = String(raw.user_id ?? raw.userId ?? raw.username ?? raw.employee_id ?? '').trim();
  const fullName = String(raw.full_name ?? raw.fullName ?? raw.name ?? raw.employee_name ?? userId ?? '—').trim();
  const emailWork = String(raw.email_work ?? raw.work_email ?? raw.workEmail ?? raw.email ?? '—').trim();
  const department = String(raw.department ?? raw.dept ?? raw.division ?? '—').trim();
  const division = raw.division ? String(raw.division).trim() : undefined;
  const jobTitle = raw.job_title ?? raw.jobTitle ?? raw.title ?? raw.position;
  const rawStatus = raw.employee_status ?? raw.employeeStatus ?? raw.status;
  const employeeStatus = rawStatus !== undefined && rawStatus !== null ? String(rawStatus).trim() : 'Active';
  const rawIsAdmin = raw.is_admin ?? raw.isAdmin;
  const isAdmin = rawIsAdmin === true || rawIsAdmin === 'true' || rawIsAdmin === 1 || rawIsAdmin === '1';

  return {
    user_id: userId,
    full_name: fullName,
    email_work: emailWork,
    department: department,
    division: division ? String(division) : undefined,
    job_title: jobTitle ? String(jobTitle).trim() : undefined,
    employee_status: employeeStatus,
    is_admin: isAdmin,
  };
}

// Helper to aggregate Fleet Summary KPI counts from a complete list of Asset items
export function aggregateFleetKpisFromAssets(items: Asset[]): FleetKpiMetrics {
  const totalAssets = items.length;
  let active = 0;
  let review = 0;
  let inStock = 0;
  let eolSoon = 0;

  for (const asset of items) {
    // 1. Operational status: ACTIVE, REVIEW, IN STOCK
    const stdStatus = toStandardAssetStatus(asset.asset_status);

    if (stdStatus === ASSET_STATUSES.ACTIVE) {
      active++;
    } else if (stdStatus === ASSET_STATUSES.REVIEW) {
      review++;
    } else if (stdStatus === ASSET_STATUSES.IN_STOCK) {
      inStock++;
    }

    // 2. Canonical EOL status: count assets whose EOL status is EOL SOON
    const rawEol = (asset.eol_status || '').trim().toLowerCase();
    const cleanEol = rawEol.replace(/[\s_]/g, '');

    if (cleanEol === 'eolsoon' || cleanEol === 'nearingeol') {
      eolSoon++;
    }
  }

  return {
    totalAssets,
    total: totalAssets,
    total_assets: totalAssets,
    active,
    active_assets: active,
    review,
    needValidation: review,
    need_validation: review,
    inStock,
    in_stock: inStock,
    eolSoon,
    nearingEol: eolSoon,
    nearing_eol: eolSoon,
  };
}

// Universal normalization function for Fleet Summary KPI metrics
// Maps verified backend contract fields: totalAssets, active, needValidation, inStock, nearingEol
// Handles numeric validation and multiple naming conventions without truthiness hiding zero
export function normalizeFleetKpi(raw: any, fallbackItems?: Asset[]): FleetKpiMetrics {
  const parseNum = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    if (typeof val === 'string' && val.trim() !== '') {
      const n = Number(val.trim());
      return isNaN(n) ? null : n;
    }
    return null;
  };

  if (!raw && !fallbackItems) {
    return {
      totalAssets: 0,
      total: 0,
      total_assets: 0,
      active: 0,
      active_assets: 0,
      needValidation: 0,
      need_validation: 0,
      inStock: 0,
      in_stock: 0,
      nearingEol: 0,
      nearing_eol: 0,
    };
  }

  // If raw is an array of asset items
  if (Array.isArray(raw)) {
    return aggregateFleetKpisFromAssets(raw);
  }

  // Check nested summary, kpi, or metrics objects if wrapped
  const target = (raw && typeof raw === 'object') ? (raw.summary || raw.kpi || raw.metrics || raw) : {};

  // 1. Total Assets: totalAssets, total_assets, totalCount, total_count, total
  const totalVal = parseNum(
    target.totalAssets ??
    target.total_assets ??
    target.totalCount ??
    target.total_count ??
    target.total
  );

  // 2. Active: active, active_assets, activeAssets, activeCount, active_count
  const activeVal = parseNum(
    target.active ??
    target.active_assets ??
    target.activeAssets ??
    target.activeCount ??
    target.active_count
  );

  // 3. Review / Need Validation
  const reviewVal = parseNum(
    target.review ??
    target.reviewAssets ??
    target.review_assets ??
    target.reviewCount ??
    target.review_count ??
    target.needValidation ??
    target.need_validation ??
    target.needValidationAssets ??
    target.need_validation_assets ??
    target.needValidationCount ??
    target.need_validation_count
  );

  // 4. InStock: inStock, in_stock, instock, InStock, inStockAssets, in_stock_assets, inStockCount, in_stock_count
  const inStockVal = parseNum(
    target.inStock ??
    target.in_stock ??
    target.instock ??
    target.InStock ??
    target.inStockAssets ??
    target.in_stock_assets ??
    target.inStockCount ??
    target.in_stock_count
  );

  // 5. EOL Soon / Nearing EOL
  const eolSoonVal = parseNum(
    target.eolSoon ??
    target.eol_soon ??
    target.eolSoonAssets ??
    target.eol_soon_assets ??
    target.eolSoonCount ??
    target.eol_soon_count ??
    target.nearingEol ??
    target.nearing_eol ??
    target.nearingEolAssets ??
    target.nearing_eol_assets ??
    target.nearingEolCount ??
    target.nearing_eol_count ??
    target.expiringEol ??
    target.expiring_eol
  );

  // Check if target is a genuine KPI summary object (contains specific breakdown metrics or explicit totalAssets / total_assets)
  const isDedicatedKpiObject =
    activeVal !== null ||
    reviewVal !== null ||
    inStockVal !== null ||
    eolSoonVal !== null ||
    target.totalAssets !== undefined ||
    target.total_assets !== undefined;

  if (isDedicatedKpiObject) {
    const total = totalVal !== null ? totalVal : (fallbackItems ? fallbackItems.length : 0);
    const active = activeVal !== null ? activeVal : 0;
    const review = reviewVal !== null ? reviewVal : 0;
    const inStock = inStockVal !== null ? inStockVal : 0;
    const eolSoon = eolSoonVal !== null ? eolSoonVal : 0;
    return {
      totalAssets: total,
      total,
      total_assets: total,
      active,
      active_assets: active,
      review,
      needValidation: review,
      need_validation: review,
      inStock,
      in_stock: inStock,
      eolSoon,
      nearingEol: eolSoon,
      nearing_eol: eolSoon,
    };
  }

  // If raw has an items array of assets (e.g. paginated envelope { items: [...], total: ... })
  if (Array.isArray(raw?.items)) {
    const aggregated = aggregateFleetKpisFromAssets(raw.items);
    if (totalVal !== null && totalVal > aggregated.totalAssets) {
      aggregated.totalAssets = totalVal;
      aggregated.total = totalVal;
      aggregated.total_assets = totalVal;
    }
    return aggregated;
  }

  // If fallback items provided
  if (fallbackItems && Array.isArray(fallbackItems)) {
    return aggregateFleetKpisFromAssets(fallbackItems);
  }

  const finalTotal = totalVal !== null ? totalVal : 0;
  const finalActive = activeVal !== null ? activeVal : 0;
  const finalReview = reviewVal !== null ? reviewVal : 0;
  const finalInStock = inStockVal !== null ? inStockVal : 0;
  const finalEolSoon = eolSoonVal !== null ? eolSoonVal : 0;

  return {
    totalAssets: finalTotal,
    total: finalTotal,
    total_assets: finalTotal,
    active: finalActive,
    active_assets: finalActive,
    review: finalReview,
    needValidation: finalReview,
    need_validation: finalReview,
    inStock: finalInStock,
    in_stock: finalInStock,
    eolSoon: finalEolSoon,
    nearingEol: finalEolSoon,
    nearing_eol: finalEolSoon,
  };
}

// Axios instance creation with error discrimination interceptor
export function createAxiosClient(): AxiosInstance {
  const baseURL = getApiBaseUrl();
  const client = axios.create({
    baseURL: baseURL || undefined,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  client.interceptors.response.use(
    response => {
      // Validate that HTML (e.g. Vite dev server index.html) was not received instead of JSON
      if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE html')) {
        const fullUrl = response.config.baseURL
          ? `${response.config.baseURL.replace(/\/+$/, '')}/${(response.config.url || '').replace(/^\/+/, '')}`
          : response.config.url || '';
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          status: response.status,
          statusText: response.statusText,
          url: fullUrl,
          message: `[Invalid Response Data] Received HTML document instead of expected JSON payload from ${fullUrl}. Verify that VITE_API_BASE_URL points to the FastAPI service.`,
        });
      }
      return response;
    },
    error => {
      const config = error.config || {};
      const fullUrl = config.baseURL
        ? `${config.baseURL.replace(/\/+$/, '')}/${(config.url || '').replace(/^\/+/, '')}`
        : (config.url || baseURL || (typeof window !== 'undefined' ? window.location.href : 'API'));

      // Case 1: HTTP Error (Server responded with status code outside 2xx)
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const data = error.response.data;

        let detailMsg = '';
        if (typeof data === 'string') {
          detailMsg = data.length > 200 ? data.slice(0, 200) + '...' : data;
        } else if (data?.detail) {
          if (typeof data.detail === 'string') {
            detailMsg = data.detail;
          } else if (Array.isArray(data.detail)) {
            detailMsg = data.detail
              .map((d: any) => `${d.loc ? d.loc.join('.') : ''}: ${d.msg || JSON.stringify(d)}`)
              .join('; ');
          } else {
            detailMsg = JSON.stringify(data.detail);
          }
        } else if (data?.error) {
          detailMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        } else if (data?.message) {
          detailMsg = data.message;
        }

        const formatted = detailMsg
          ? `[HTTP ${status} ${statusText}] ${detailMsg} (${fullUrl})`
          : `[HTTP ${status} ${statusText}] Request failed (${fullUrl})`;

        return Promise.reject(
          new ApiError({
            type: 'HTTP_ERROR',
            status,
            statusText,
            url: fullUrl,
            detail: data,
            message: formatted,
            originalError: error,
          })
        );
      }

      // Case 2: Network Failure (No response received: CORS, Mixed Content, connection refused, or timeout)
      const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const isTargetHttp = typeof fullUrl === 'string' && fullUrl.startsWith('http://');

      let diag = '';
      if (!fullUrl) {
        diag = 'No API base URL configured. Set VITE_API_BASE_URL or enter the backend URL in Settings.';
      } else if (isHttpsPage && isTargetHttp) {
        diag = `Mixed Content Blocked: App is running over HTTPS (${window.location.origin}) while target API URL uses insecure HTTP (${fullUrl}). Browsers block insecure HTTP requests from HTTPS sites. Please configure an HTTPS API URL (VITE_API_BASE_URL) or run frontend locally.`;
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        diag = `Request timed out after ${config.timeout || 10000}ms. The server at ${fullUrl} took too long to respond.`;
      } else {
        diag = `Cannot reach backend at ${fullUrl}. Ensure the FastAPI server is running, network is accessible, and CORS is enabled for origin '${typeof window !== 'undefined' ? window.location.origin : '*'}'.`;
      }

      const formatted = `[Network Failure] ${diag} (Error: ${error.message || error.code || 'ERR_NETWORK'})`;

      return Promise.reject(
        new ApiError({
          type: 'NETWORK_FAILURE',
          url: fullUrl,
          message: formatted,
          originalError: error,
        })
      );
    }
  );

  return client;
}

class ApiService {
  private isMockMode: boolean = getInitialMockMode();

  public setMock(mock: boolean) {
    this.isMockMode = mock;
    setStoredMockMode(mock);
  }

  public getMock(): boolean {
    return this.isMockMode;
  }

  // Health check
  public async getHealth(): Promise<HealthResponse> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return MOCK_HEALTH;
    }
    const client = createAxiosClient();
    const response = await client.get<HealthResponse>('/health');
    if (!response.data || typeof response.data !== 'object') {
      throw new ApiError({
        type: 'INVALID_RESPONSE_DATA',
        url: `${getApiBaseUrl()}/health`,
        message: `[Invalid Response Data] /health returned unexpected payload: ${String(response.data)}`,
      });
    }
    return response.data;
  }

  // Dashboard summary KPI
  public async getDashboardSummary(): Promise<DashboardSummary> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return calculateMockSummary();
    }
    const client = createAxiosClient();
    const response = await client.get<DashboardSummary>('/api/dashboard/summary');
    return response.data;
  }

  // New dashboard layout overview. Existing dashboard endpoints are unchanged.
  public async getDashboardRedesignOverview(): Promise<DashboardRedesignOverview> {
    if (!this.isMockMode) {
      const client = createAxiosClient();
      const response = await client.get<DashboardRedesignOverview>('/api/dashboard/redesign-overview');
      return response.data;
    }

    await this.simulateLatency();
    const sources = ['BIGFIX', 'JAMF'];
    const sourceSummary = sources.map(source => ({
      source, total: 0, active: 0, review: 0, in_stock: 0, retired: 0, auto: 0, manual: 0, unassigned: 0,
      eol_active: 0, eol_soon: 0, eol_expired: 0, eol_unknown: 0, active_share: 0,
    }));
    const eolCounts: Record<string, number> = { ACTIVE: 0, 'EOL SOON': 0, EXPIRED: 0, UNKNOWN: 0 };
    const statusCounts: Record<string, number> = { ACTIVE: 0, REVIEW: 0, 'IN STOCK': 0, RETIRED: 0 };
    const deptCounts: Record<string, number> = {};
    const modelCounts: Record<string, { model: string; eol_status: string; days_remaining: number | null; count: number }> = {};
    const osCounts: Record<string, number> = {};
    const dtCounts: Record<string, number> = {};
    const owners = new Set<string>();
    for (const asset of MOCK_ASSETS) {
      const source = String(asset.source || '').toUpperCase();
      const stat = sourceSummary.find(item => item.source === source);
      if (!stat) continue;
      const status = toStandardAssetStatus(String(asset.asset_status));
      const eol = toStandardEOLStatus(String(asset.calculated_eol_status));
      const eolKey = eol === 'ACTIVE' || eol === 'EOL SOON' || eol === 'EXPIRED' ? eol : 'UNKNOWN';
      stat.total += 1;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (status === 'ACTIVE') stat.active += 1;
      else if (status === 'REVIEW') stat.review += 1;
      else if (status === 'IN STOCK') stat.in_stock += 1;
      else stat.retired += 1;
      eolCounts[eolKey] += 1;
      if (eolKey === 'ACTIVE') stat.eol_active += 1;
      else if (eolKey === 'EOL SOON') stat.eol_soon += 1;
      else if (eolKey === 'EXPIRED') stat.eol_expired += 1;
      else stat.eol_unknown += 1;
      const username = String(asset.assigned_username || '').trim();
      const assignment = String(asset.assignment_type || '').toUpperCase();
      if (!username) stat.unassigned += 1;
      else if (assignment.includes('AUTO')) stat.auto += 1;
      else stat.manual += 1;
      if (username && asset.department) { owners.add(username.toLowerCase()); deptCounts[asset.department] = (deptCounts[asset.department] || 0) + 1; }
      const modelName = `${asset.manufacturer || 'Unknown'} ${asset.model || 'Unknown'}`.trim();
      const model = modelCounts[modelName] || (modelCounts[modelName] = { model: modelName, eol_status: eolKey, days_remaining: asset.days_remaining ?? null, count: 0 });
      model.count += 1;

      // Operating system normalization
      const rawOs = String(asset.os_name || asset.osName || '').trim();
      if (rawOs && rawOs !== '—' && rawOs !== '-' && rawOs.toLowerCase() !== 'unknown') {
        let osCategory = rawOs;
        const lower = rawOs.toLowerCase();
        if (lower.startsWith('windows') || lower.includes('win')) osCategory = 'Windows';
        else if (lower.includes('macos') || lower.includes('mac os') || lower.includes('os x')) osCategory = 'macOS';
        else if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('red hat')) osCategory = 'Linux';
        else if (lower.includes('vmware') || lower.includes('esxi')) osCategory = 'VMware ESXi';
        osCounts[osCategory] = (osCounts[osCategory] || 0) + 1;
      }

      // Device type normalization
      const rawDt = String(asset.devicetype || asset.device_type || asset.deviceType || '').trim();
      if (rawDt && rawDt !== '—' && rawDt !== '-' && rawDt.toLowerCase() !== 'unknown') {
        const dtCategory = rawDt.charAt(0).toUpperCase() + rawDt.slice(1);
        dtCounts[dtCategory] = (dtCounts[dtCategory] || 0) + 1;
      }
    }
    sourceSummary.forEach(item => { item.active_share = item.total ? Math.round(item.eol_active / item.total * 100) : 0; });
    const urgency: Record<string, number> = { EXPIRED: 0, 'EOL SOON': 1, UNKNOWN: 2, ACTIVE: 3 };
    const by_operating_system = Object.entries(osCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const by_device_type = Object.entries(dtCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      kpis: { total_assets: MOCK_ASSETS.length, active_assets: statusCounts.ACTIVE, review: statusCounts.REVIEW, in_stock: statusCounts['IN STOCK'], employee_count: owners.size },
      assets_by_source: sourceSummary.map(({ source, total }) => ({ source, count: total })),
      eol_distribution: Object.entries(eolCounts).map(([status, count]) => ({ status, count })),
      eol_exposure: Object.values(modelCounts).filter(item => item.eol_status !== 'ACTIVE').sort((a, b) => (urgency[a.eol_status] ?? 3) - (urgency[b.eol_status] ?? 3) || (a.days_remaining ?? 1e9) - (b.days_remaining ?? 1e9)).slice(0, 7),
      assets_by_department: Object.entries(deptCounts).map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count),
      source_summary: sourceSummary,
      by_operating_system,
      by_device_type,
      hardware_analysis: {
        by_operating_system,
        by_device_type,
      },
    };
  }

  /**
   * Hardware Asset Analysis endpoint returning byOs and byDevice maps.
   * GET /api/dashboard/hardware-analysis
   */
  public async getHardwareAnalysis(): Promise<HardwareAnalysisResponse> {
    if (!this.isMockMode) {
      const client = createAxiosClient();
      const response = await client.get<HardwareAnalysisResponse>('/api/dashboard/hardware-analysis');
      return response.data;
    }

    await this.simulateLatency();
    const byOs: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    for (const asset of MOCK_ASSETS) {
      const os = String(asset.os_name || asset.osName || '').trim();
      if (os && os !== '—' && os !== '-' && os.toLowerCase() !== 'unknown') {
        byOs[os] = (byOs[os] || 0) + 1;
      }
      const dt = String(asset.devicetype || asset.device_type || asset.deviceType || '').trim();
      if (dt && dt !== '—' && dt !== '-' && dt.toLowerCase() !== 'unknown') {
        const titleCase = dt.charAt(0).toUpperCase() + dt.slice(1);
        byDevice[titleCase] = (byDevice[titleCase] || 0) + 1;
      }
    }
    return { byOs, byDevice };
  }

  // Assets by source
  public async getAssetsBySource(): Promise<AssetsBySourceItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockAssetsBySource();
    }
    const client = createAxiosClient();
    const primaryRoute = '/api/dashboard/assets-by-source';
    const fallbackRoute = '/api/dashboard/source-summary';

    let response: any;
    let endpointUsed = primaryRoute;

    try {
      response = await client.get<any>(primaryRoute);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 404) {
        try {
          endpointUsed = fallbackRoute;
          response = await client.get<any>(fallbackRoute);
        } catch (fallbackErr: any) {
          console.error(`[API Error] GET ${primaryRoute} and ${fallbackRoute} failed:`, {
            status: fallbackErr?.response?.status,
            statusText: fallbackErr?.response?.statusText,
            message: fallbackErr?.message,
          });
          throw fallbackErr;
        }
      } else {
        console.error(`[API Error] GET ${primaryRoute} failed:`, {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          message: err?.message,
        });
        throw err;
      }
    }

    let rawList: any[] = [];
    if (Array.isArray(response.data)) {
      rawList = response.data;
    } else if (response.data && typeof response.data === 'object') {
      // Backend contract compatibility: unpack recognized wrapper object property if returned
      if (Array.isArray(response.data.data)) {
        rawList = response.data.data;
      } else if (Array.isArray(response.data.sources)) {
        rawList = response.data.sources;
      } else if (Array.isArray(response.data.source_summary)) {
        rawList = response.data.source_summary;
      } else if (Array.isArray(response.data.assets_by_source)) {
        rawList = response.data.assets_by_source;
      } else if (Array.isArray(response.data.items)) {
        rawList = response.data.items;
      } else if (Array.isArray(response.data.results)) {
        rawList = response.data.results;
      } else {
        // If the backend sent a dictionary of source to count, e.g. { "BIGFIX": 150, "JAMF": 80 }
        const entries = Object.entries(response.data);
        const isDictOfNumbers =
          entries.length > 0 &&
          entries.every(([_, v]) => typeof v === 'number' || (!isNaN(Number(v)) && typeof v !== 'boolean'));
        if (isDictOfNumbers) {
          rawList = entries.map(([source, count]) => ({ source, count: Number(count) }));
        } else {
          const receivedType = response.data === null ? 'null' : typeof response.data;
          console.error(`[API Error] Invalid response contract from ${endpointUsed}:`, response.data);
          throw new ApiError({
            type: 'INVALID_RESPONSE_DATA',
            url: `${getApiBaseUrl()}${endpointUsed}`,
            message: `[Invalid Response Data] ${endpointUsed} expected an array of source records, got ${receivedType}.`,
            detail: response.data,
          });
        }
      }
    } else {
      const receivedType = response.data === null ? 'null' : typeof response.data;
      console.error(`[API Error] Invalid response contract from ${endpointUsed}:`, response.data);
      throw new ApiError({
        type: 'INVALID_RESPONSE_DATA',
        url: `${getApiBaseUrl()}${endpointUsed}`,
        message: `[Invalid Response Data] ${endpointUsed} expected an array of source records, got ${receivedType}.`,
        detail: response.data,
      });
    }

    // Validate and normalize records
    const normalized: AssetsBySourceItem[] = [];
    let totalCount = 0;

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item || typeof item !== 'object') {
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          url: `${getApiBaseUrl()}${endpointUsed}`,
          message: `[Invalid Response Data] Record at index ${i} in ${endpointUsed} must be an object with source and count fields.`,
          detail: item,
        });
      }
      const rawSource = item.source ?? item.source_name ?? item.name ?? item.collector;
      if (typeof rawSource !== 'string' || !rawSource.trim()) {
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          url: `${getApiBaseUrl()}${endpointUsed}`,
          message: `[Invalid Response Data] Record at index ${i} in ${endpointUsed} is missing a valid 'source' string.`,
          detail: item,
        });
      }
      const rawCount = item.count ?? item.asset_count ?? item.total ?? item.value;
      const parsedCount = typeof rawCount === 'number' ? rawCount : Number(rawCount);
      if (rawCount === undefined || rawCount === null || isNaN(parsedCount) || parsedCount < 0) {
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          url: `${getApiBaseUrl()}${endpointUsed}`,
          message: `[Invalid Response Data] Record at index ${i} ('${rawSource}') in ${endpointUsed} has invalid 'count': expected a non-negative number, got ${JSON.stringify(rawCount)}.`,
          detail: item,
        });
      }

      totalCount += parsedCount;
      normalized.push({
        source: rawSource.trim(),
        count: parsedCount,
        percentage: typeof item.percentage === 'number' ? item.percentage : 0,
      });
    }

    // Recalculate percentage if missing or zero
    return normalized.map(item => ({
      ...item,
      percentage:
        item.percentage > 0
          ? item.percentage
          : totalCount > 0
          ? Math.round((item.count / totalCount) * 100)
          : 0,
    }));
  }

  // Ownership summary
  public async getOwnershipSummary(): Promise<OwnershipSummaryItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockOwnershipSummary();
    }
    const client = createAxiosClient();
    const endpoint = '/api/dashboard/ownership-summary';
    let response: any;
    try {
      response = await client.get<any>(endpoint);
    } catch (err: any) {
      console.error(`[API Error] GET ${endpoint} failed:`, err);
      throw err;
    }

    let rawList: any[] = [];
    if (Array.isArray(response.data)) {
      rawList = response.data;
    } else if (response.data && typeof response.data === 'object') {
      if (Array.isArray(response.data.data)) {
        rawList = response.data.data;
      } else if (Array.isArray(response.data.items)) {
        rawList = response.data.items;
      } else if (Array.isArray(response.data.ownership_summary)) {
        rawList = response.data.ownership_summary;
      } else if (Array.isArray(response.data.results)) {
        rawList = response.data.results;
      } else {
        const entries = Object.entries(response.data);
        const isDictOfNumbers =
          entries.length > 0 &&
          entries.every(([_, v]) => typeof v === 'number' || (!isNaN(Number(v)) && typeof v !== 'boolean'));
        if (isDictOfNumbers) {
          rawList = entries.map(([assignment_type, count]) => ({ assignment_type, count: Number(count) }));
        }
      }
    }

    let total = 0;
    const items = rawList.map((item: any) => {
      const assignment_type = String(item?.assignment_type ?? item?.type ?? item?.name ?? 'Unassigned').trim();
      const count = Number(item?.count ?? item?.asset_count ?? item?.total ?? 0) || 0;
      total += count;
      return {
        assignment_type,
        count,
        percentage: typeof item?.percentage === 'number' ? item.percentage : 0,
      };
    });

    return items.map(item => ({
      ...item,
      percentage: item.percentage > 0 ? item.percentage : total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }

  // EOL summary
  public async getEOLSummary(): Promise<EOLSummaryItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockEOLSummary();
    }
    const client = createAxiosClient();
    const response = await client.get<any>('/api/dashboard/eol-summary');
    let rawList: any[] = [];
    if (Array.isArray(response.data)) {
      rawList = response.data;
    } else if (response.data && typeof response.data === 'object') {
      if (Array.isArray(response.data.data)) rawList = response.data.data;
      else if (Array.isArray(response.data.items)) rawList = response.data.items;
      else if (Array.isArray(response.data.eol_summary)) rawList = response.data.eol_summary;
      else if (Array.isArray(response.data.results)) rawList = response.data.results;
    }
    if (!Array.isArray(rawList)) {
      return [];
    }
    return rawList.map((item: any) => {
      const raw = String(item?.eol_status ?? item?.status ?? item?.name ?? '').trim();
      const norm = raw.toUpperCase().replace(/_/g, ' ');
      const eol_status =
        norm === 'NEARING EOL' || norm === 'NEARINGEOL' || norm === 'EOL SOON' || norm === 'EOLSOON' || norm.startsWith('NEARING')
          ? 'EOL Soon'
          : raw;
      return {
        ...item,
        eol_status,
        count: Number(item?.count ?? item?.total ?? 0) || 0,
        percentage: Number(item?.percentage ?? 0) || 0,
      };
    });
  }

  /**
   * Normalizes raw operational status records into canonical statuses:
   * ACTIVE, REVIEW, IN STOCK, RETIRED.
   * - Maps legacy 'NEED VALIDATION' to 'REVIEW'.
   * - Deduplicates / merges counts so no record is counted twice.
   * - Displays zero counts accurately.
   */
  public normalizeOperationalStatus(rawItems: any[]): OperationalStatusItem[] {
    const canonicalOrder = ['ACTIVE', 'REVIEW', 'IN STOCK', 'RETIRED'] as const;
    const counts: Record<string, number> = {
      ACTIVE: 0,
      REVIEW: 0,
      'IN STOCK': 0,
      RETIRED: 0,
    };

    const extraStatuses = new Map<string, number>();

    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;

      const rawStatus = String(item.status ?? item.asset_status ?? item.name ?? '').trim();
      if (!rawStatus) continue;

      const rawCount = item.count !== undefined ? item.count : (item.asset_count ?? item.total ?? item.value);
      const count = typeof rawCount === 'number' && !isNaN(rawCount) ? rawCount : Number(rawCount);
      const validCount = !isNaN(count) && count >= 0 ? count : 0;

      // Canonical status mapping
      const upper = rawStatus.toUpperCase().replace(/_/g, ' ');
      if (upper === 'ACTIVE') {
        counts.ACTIVE += validCount;
      } else if (upper === 'REVIEW' || upper === 'NEED VALIDATION' || upper === 'NEEDVALIDATION') {
        counts.REVIEW += validCount;
      } else if (upper === 'IN STOCK' || upper === 'INSTOCK') {
        counts['IN STOCK'] += validCount;
      } else if (upper === 'RETIRED') {
        counts.RETIRED += validCount;
      } else {
        const current = extraStatuses.get(upper) || 0;
        extraStatuses.set(upper, current + validCount);
      }
    }

    // Calculate fleet total for percentage calculation
    let total = counts.ACTIVE + counts.REVIEW + counts['IN STOCK'] + counts.RETIRED;
    for (const c of extraStatuses.values()) {
      total += c;
    }

    const result: OperationalStatusItem[] = canonicalOrder.map(status => {
      const count = counts[status];
      return {
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    for (const [status, count] of extraStatuses.entries()) {
      result.push({
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      });
    }

    return result;
  }

  // Operational status distribution
  public async getOperationalStatusSummary(): Promise<OperationalStatusItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockOperationalStatus();
    }
    const client = createAxiosClient();
    const endpoint = '/api/dashboard/operational-status';
    let response: any;
    try {
      response = await client.get<any>(endpoint);
    } catch (err: any) {
      console.error(`[API Error] GET ${endpoint} failed:`, {
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        message: err?.message,
      });
      throw err;
    }

    let rawList: any[] = [];
    if (Array.isArray(response.data)) {
      rawList = response.data;
    } else if (response.data && typeof response.data === 'object') {
      // Backend contract compatibility: unpack recognized wrapper object property if returned
      if (Array.isArray(response.data.data)) {
        rawList = response.data.data;
      } else if (Array.isArray(response.data.items)) {
        rawList = response.data.items;
      } else if (Array.isArray(response.data.results)) {
        rawList = response.data.results;
      } else if (Array.isArray(response.data.statuses)) {
        rawList = response.data.statuses;
      } else if (Array.isArray(response.data.operational_status)) {
        rawList = response.data.operational_status;
      } else {
        // If the backend sent a dictionary of status to count, e.g. { "ACTIVE": 15, "REVIEW": 2, ... }
        const entries = Object.entries(response.data);
        const isDictOfNumbers =
          entries.length > 0 &&
          entries.every(([k, v]) => typeof v === 'number' || (!isNaN(Number(v)) && typeof v !== 'boolean'));
        if (isDictOfNumbers) {
          rawList = entries.map(([status, count]) => ({ status, count: Number(count) }));
        } else {
          const receivedType = response.data === null ? 'null' : typeof response.data;
          throw new ApiError({
            type: 'INVALID_RESPONSE_DATA',
            url: `${getApiBaseUrl()}${endpoint}`,
            message: `[Invalid Response Data] ${endpoint} expected an array of status records, got ${receivedType}.`,
          });
        }
      }
    } else {
      const receivedType = response.data === null ? 'null' : typeof response.data;
      throw new ApiError({
        type: 'INVALID_RESPONSE_DATA',
        url: `${getApiBaseUrl()}${endpoint}`,
        message: `[Invalid Response Data] ${endpoint} expected an array of status records, got ${receivedType}.`,
      });
    }

    // Validate that each record contains a valid status and numeric count
    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item || typeof item !== 'object') {
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          url: `${getApiBaseUrl()}${endpoint}`,
          message: `[Invalid Response Data] Record at index ${i} in ${endpoint} must be an object with status and count fields.`,
        });
      }
      const rawStatus = item.status ?? item.asset_status ?? item.name;
      if (typeof rawStatus !== 'string' || !rawStatus.trim()) {
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          url: `${getApiBaseUrl()}${endpoint}`,
          message: `[Invalid Response Data] Record at index ${i} in ${endpoint} is missing a valid 'status' string.`,
        });
      }
      const rawCount = item.count ?? item.asset_count ?? item.total ?? item.value;
      const parsedCount = typeof rawCount === 'number' ? rawCount : Number(rawCount);
      if (rawCount === undefined || rawCount === null || isNaN(parsedCount) || parsedCount < 0) {
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          url: `${getApiBaseUrl()}${endpoint}`,
          message: `[Invalid Response Data] Record at index ${i} ('${rawStatus}') in ${endpoint} has invalid 'count': expected a non-negative number, got ${JSON.stringify(rawCount)}.`,
        });
      }
    }

    return this.normalizeOperationalStatus(rawList);
  }

  // Department distribution
  public async getDepartmentDistribution(): Promise<DepartmentDistributionItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockDepartmentDistribution();
    }
    const client = createAxiosClient();
    const response = await client.get<any>('/api/dashboard/department-summary');

    let rawList: any[] = [];
    if (Array.isArray(response.data)) {
      rawList = response.data;
    } else if (response.data && typeof response.data === 'object') {
      // Coordinate with backend contract: unpack recognized wrapper object property
      if (Array.isArray(response.data.data)) {
        rawList = response.data.data;
      } else if (Array.isArray(response.data.items)) {
        rawList = response.data.items;
      } else if (Array.isArray(response.data.departments)) {
        rawList = response.data.departments;
      } else if (Array.isArray(response.data.department_summary)) {
        rawList = response.data.department_summary;
      } else if (Array.isArray(response.data.results)) {
        rawList = response.data.results;
      } else {
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          url: `${getApiBaseUrl()}/api/dashboard/department-summary`,
          message: `[Invalid Response Data] /api/dashboard/department-summary expected an array, got ${typeof response.data}.`,
        });
      }
    } else {
      throw new ApiError({
        type: 'INVALID_RESPONSE_DATA',
        url: `${getApiBaseUrl()}/api/dashboard/department-summary`,
        message: `[Invalid Response Data] /api/dashboard/department-summary expected an array, got ${typeof response.data}.`,
      });
    }

    // Compute total assets for relative fleet percentage calculation
    const totalAssets = rawList.reduce((sum: number, item: any) => {
      const c = Number(item?.asset_count ?? item?.count ?? item?.assets_count ?? 0) || 0;
      return sum + c;
    }, 0);

    // Map actual field names returned by FastAPI to expected chart/table properties
    return rawList.map((item: any) => {
      const department = String(item?.department ?? item?.name ?? item?.dept ?? 'Unspecified').trim() || 'Unspecified';
      const count = Number(item?.asset_count ?? item?.count ?? item?.assets_count ?? 0) || 0;
      const percentage =
        item?.percentage !== undefined && item?.percentage !== null
          ? Number(item.percentage) || 0
          : totalAssets > 0
          ? Math.round((count / totalAssets) * 100)
          : 0;

      return {
        department,
        count,
        asset_count: count,
        percentage,
      };
    });
  }

  // Filter options
  public async getFilters(): Promise<FilterOptions> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockFilters();
    }
    const client = createAxiosClient();
    const response = await client.get<FilterOptions>('/api/filters');
    return response.data;
  }

  // Assets list with query params
  public async getAssets(params: AssetQueryParams): Promise<PaginatedResponse<Asset>> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return filterAndPaginateAssets(params);
    }
    const queryParams: any = { ...params };
    if (params.devicetype && !queryParams.device_type) {
      queryParams.device_type = params.devicetype;
    }
    if (params.device_type && !queryParams.devicetype) {
      queryParams.devicetype = params.device_type;
    }

    // Normalize assignment_type parameter:
    // Send 'Auto' for Automatic Match (never 'Automatic'), 'Manual' for Manual Assignment.
    // Omit when cleared or if 'Unassigned'.
    if (queryParams.assignment_type) {
      const aType = String(queryParams.assignment_type).trim().toLowerCase();
      if (aType === 'auto' || aType === 'automatic') {
        queryParams.assignment_type = 'Auto';
      } else if (aType === 'manual') {
        queryParams.assignment_type = 'Manual';
      } else {
        delete queryParams.assignment_type;
      }
    } else {
      delete queryParams.assignment_type;
    }

    // Normalize asset_status parameter:
    // Canonical values: ACTIVE, REVIEW, IN STOCK, RETIRED
    if (queryParams.asset_status) {
      const s = String(queryParams.asset_status).trim().toUpperCase().replace(/_/g, ' ');
      if (s === 'REVIEW' || s === 'NEED VALIDATION' || s === 'NEEDVALIDATION') {
        queryParams.asset_status = 'REVIEW';
      } else if (s === 'ACTIVE') {
        queryParams.asset_status = 'ACTIVE';
      } else if (s === 'IN STOCK' || s === 'INSTOCK') {
        queryParams.asset_status = 'IN STOCK';
      } else if (s === 'RETIRED') {
        queryParams.asset_status = 'RETIRED';
      }
    }

    // Normalize eol_status parameter:
    // Canonical values: ACTIVE, EOL SOON, EXPIRED, UNKNOWN
    if (queryParams.eol_status) {
      const e = String(queryParams.eol_status).trim().toUpperCase().replace(/_/g, ' ');
      if (e === 'EOL SOON' || e === 'EOLSOON' || e === 'NEARING EOL' || e === 'NEARINGEOL' || e.startsWith('NEARING')) {
        queryParams.eol_status = 'EOL SOON';
      } else if (e === 'ACTIVE') {
        queryParams.eol_status = 'ACTIVE';
      } else if (e === 'EXPIRED') {
        queryParams.eol_status = 'EXPIRED';
      } else if (e === 'UNKNOWN') {
        queryParams.eol_status = 'UNKNOWN';
      }
    }

    // Omit undefined, null, or empty string parameters
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const client = createAxiosClient();
    const response = await client.get<any>('/api/assets', {
      params: queryParams,
    });

    let rawItems: any[] = [];
    let total = 0;
    let page = params.page || 1;
    let pageSize = params.page_size || 25;
    let totalPages = 1;

    if (Array.isArray(response.data)) {
      rawItems = response.data;
      total = response.data.length;
      totalPages = Math.max(1, Math.ceil(total / pageSize));
    } else if (response.data && typeof response.data === 'object') {
      rawItems = response.data.items ?? response.data.data ?? response.data.results ?? response.data.assets ?? [];
      const extractedTotal =
        response.data.total ??
        response.data.count ??
        response.data.total_count ??
        response.data.totalCount ??
        response.data.total_records ??
        response.data.totalRecords;
      total = typeof extractedTotal === 'number' && !isNaN(extractedTotal)
        ? extractedTotal
        : Number(extractedTotal) || rawItems.length;
      page = Number(response.data.page) || page;
      pageSize = Number(response.data.page_size ?? response.data.pageSize) || pageSize;
      totalPages = Number(response.data.total_pages ?? response.data.totalPages) || Math.max(1, Math.ceil(total / pageSize));
    } else {
      throw new ApiError({
        type: 'INVALID_RESPONSE_DATA',
        url: `${getApiBaseUrl()}/api/assets`,
        message: `[Invalid Response Data] /api/assets expected a paginated object ({ items: [...] }) or array, received: ${typeof response.data}.`,
      });
    }

    const items = rawItems.map(normalizeAsset);

    // Extract KPI summary if backend provides it directly or in response.data.summary
    let summary: FleetKpiMetrics | undefined = undefined;
    if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
      if (
        response.data.summary ||
        response.data.kpi ||
        response.data.totalAssets !== undefined ||
        response.data.total_assets !== undefined
      ) {
        summary = normalizeFleetKpi(response.data.summary || response.data, items);
      }
    }

    return {
      items,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      summary,
    };
  }

  // Export standardized CSV report from backend export endpoint
  public async exportAssetsCsv(params: AssetExportParams): Promise<AssetExportResponse> {
    const queryParams: any = { ...params };
    delete queryParams.page;
    delete queryParams.page_size;

    if (params.devicetype && !queryParams.device_type) {
      queryParams.device_type = params.devicetype;
    }
    if (params.device_type && !queryParams.devicetype) {
      queryParams.devicetype = params.device_type;
    }

    if (queryParams.assignment_type) {
      const aType = String(queryParams.assignment_type).trim().toLowerCase();
      if (aType === 'auto' || aType === 'automatic') {
        queryParams.assignment_type = 'Auto';
      } else if (aType === 'manual') {
        queryParams.assignment_type = 'Manual';
      } else {
        delete queryParams.assignment_type;
      }
    } else {
      delete queryParams.assignment_type;
    }

    if (queryParams.asset_status) {
      const s = String(queryParams.asset_status).trim().toUpperCase().replace(/_/g, ' ');
      if (s === 'REVIEW' || s === 'NEED VALIDATION' || s === 'NEEDVALIDATION') {
        queryParams.asset_status = 'REVIEW';
      } else if (s === 'ACTIVE') {
        queryParams.asset_status = 'ACTIVE';
      } else if (s === 'IN STOCK' || s === 'INSTOCK') {
        queryParams.asset_status = 'IN STOCK';
      } else if (s === 'RETIRED') {
        queryParams.asset_status = 'RETIRED';
      }
    }

    if (queryParams.eol_status) {
      const e = String(queryParams.eol_status).trim().toUpperCase().replace(/_/g, ' ');
      if (e === 'EOL SOON' || e === 'EOLSOON' || e === 'NEARING EOL' || e === 'NEARINGEOL' || e.startsWith('NEARING')) {
        queryParams.eol_status = 'EOL SOON';
      } else if (e === 'ACTIVE') {
        queryParams.eol_status = 'ACTIVE';
      } else if (e === 'EXPIRED') {
        queryParams.eol_status = 'EXPIRED';
      } else if (e === 'UNKNOWN') {
        queryParams.eol_status = 'UNKNOWN';
      }
    }

    // Omit undefined, null, or empty string parameters
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    if (this.isMockMode) {
      await this.simulateLatency();
      return generateMockAssetsCsvExport(queryParams);
    }

    const client = createAxiosClient();
    const exportRoutes = [
      '/api/assets/export',
      '/api/assets/export.csv',
      '/api/assets/csv',
    ];

    let lastError: any = null;
    for (const route of exportRoutes) {
      try {
        const response = await client.get(route, {
          params: queryParams,
          responseType: 'blob',
          headers: {
            Accept: 'text/csv, application/octet-stream, application/json, */*',
          },
        });

        const data = response.data;
        if (data instanceof Blob && data.type.includes('application/json')) {
          const text = await data.text();
          let json: any = {};
          try {
            json = JSON.parse(text);
          } catch (_) {}
          if (json?.detail || json?.error || json?.message) {
            throw new Error(json.detail || json.error || json.message);
          }
        }

        let filename: string | undefined = undefined;
        const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
        if (disposition) {
          const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
          if (utf8Match && utf8Match[1]) {
            filename = decodeURIComponent(utf8Match[1].trim());
          } else {
            const basicMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
            if (basicMatch && basicMatch[1]) {
              filename = basicMatch[1].replace(/['"]/g, '').trim();
            }
          }
        }

        return {
          blob: data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8;' }),
          filename,
        };
      } catch (err: any) {
        lastError = err;
        if (err?.response?.status !== 404 && err?.status !== 404) {
          throw err;
        }
      }
    }

    throw lastError || new Error('Backend CSV export endpoint returned an error or was not reachable');
  }

  // Export genuine XLSX report for a specific card from GET /api/assets/export
  public async exportReportXlsx(
    reportId: 'master' | 'warranty' | 'bigfix' | 'jamf' | 'instock' | 'need-validation' | string,
    extraParams?: Record<string, any>
  ): Promise<{ blob: Blob; filename?: string; count?: number }> {
    const reportFilterParams: Record<string, any> = {
      format: 'xlsx',
      report: reportId,
      ...extraParams,
    };

    if (reportId === 'bigfix') {
      reportFilterParams.source = 'BIGFIX';
    } else if (reportId === 'jamf') {
      reportFilterParams.source = 'JAMF';
    } else if (reportId === 'instock') {
      reportFilterParams.asset_status = 'IN STOCK';
    } else if (reportId === 'need-validation') {
      reportFilterParams.asset_status = 'REVIEW';
    } else if (reportId === 'warranty') {
      reportFilterParams.warranty_issues = true;
      reportFilterParams.eol_status = 'EOL SOON,EXPIRED';
    }

    if (this.isMockMode) {
      await this.simulateLatency();
      return generateMockReportXlsxExport(reportId);
    }

    const client = createAxiosClient();
    const exportRoutes = [
      '/api/assets/export',
      '/api/assets/export.xlsx',
      '/api/assets/export.csv',
    ];

    let lastError: any = null;
    for (const route of exportRoutes) {
      try {
        const response = await client.get(route, {
          params: reportFilterParams,
          responseType: 'blob',
          headers: {
            Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, text/csv, application/json, */*',
          },
        });

        const data = response.data;
        if (data instanceof Blob && data.type.includes('application/json')) {
          const text = await data.text();
          let json: any = {};
          try {
            json = JSON.parse(text);
          } catch (_) {}
          if (json?.detail || json?.error || json?.message) {
            throw new Error(json.detail || json.error || json.message);
          }
          if (json?.url || json?.download_url) {
            const fileResp = await axios.get(json.url || json.download_url, { responseType: 'blob' });
            return {
              blob: fileResp.data,
              filename: json.filename,
              count: json.count || json.total,
            };
          }
        }

        let filename: string | undefined = undefined;
        const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
        if (disposition) {
          const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
          if (utf8Match && utf8Match[1]) {
            filename = decodeURIComponent(utf8Match[1].trim());
          } else {
            const basicMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
            if (basicMatch && basicMatch[1]) {
              filename = basicMatch[1].replace(/['"]/g, '').trim();
            }
          }
        }

        if (data instanceof Blob) {
          const buffer = await data.slice(0, 4).arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const isZipXlsx = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
          if (isZipXlsx) {
            return {
              blob: data,
              filename,
            };
          }

          // If backend returned CSV text instead of binary XLSX, convert to genuine XLSX with the 18 columns!
          const text = await data.text();
          if (text.includes('\n') || text.includes(',')) {
            const wb = XLSX.read(text, { type: 'string' });
            const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            return {
              blob: new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
              filename: filename ? filename.replace(/\.csv$/i, '.xlsx') : undefined,
            };
          }
        }

        return {
          blob: data instanceof Blob ? data : new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          filename,
        };
      } catch (err: any) {
        lastError = err;
        if (err?.response?.status !== 404 && err?.status !== 404) {
          throw err;
        }
      }
    }

    // Fallback: If dedicated export route returned 404, fetch all matching assets via paginated /api/assets
    try {
      const allAssets = await this.fetchAllMatchingAssetsForReport(reportId);
      if (!allAssets || allAssets.length === 0) {
        return {
          blob: new Blob([''], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          filename: undefined,
          count: 0,
        };
      }
      return buildReportXlsxFromAssets(reportId, allAssets);
    } catch (fallbackErr) {
      throw lastError || fallbackErr || new Error('Backend export endpoint returned an error or was not reachable');
    }
  }

  // Helper to fetch all matching assets for a report definition across all pagination pages
  public async fetchAllMatchingAssetsForReport(reportId: string): Promise<Asset[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return generateMockReportXlsxExport(reportId).count > 0 ? [...MOCK_ASSETS] : [];
    }

    const client = createAxiosClient();
    const queryParams: Record<string, any> = {};

    if (reportId === 'bigfix') {
      queryParams.source = 'BIGFIX';
    } else if (reportId === 'jamf') {
      queryParams.source = 'JAMF';
    } else if (reportId === 'instock') {
      queryParams.asset_status = 'IN STOCK';
    } else if (reportId === 'need-validation') {
      queryParams.asset_status = 'REVIEW';
    } else if (reportId === 'warranty') {
      queryParams.eol_status = 'EOL SOON,EXPIRED';
    }

    // Try page_size=1000 first, fallback to page_size=100 if rejected
    let pageSize = 1000;
    let initialResp: any = null;
    try {
      initialResp = await client.get('/api/assets', { params: { ...queryParams, page: 1, page_size: pageSize } });
    } catch (err: any) {
      if (err?.response?.status === 422 || err?.response?.status === 400) {
        pageSize = 100;
        initialResp = await client.get('/api/assets', { params: { ...queryParams, page: 1, page_size: pageSize } });
      } else {
        throw err;
      }
    }

    const rawData = initialResp.data;
    let allItems: Asset[] = [];
    let total = 0;
    let totalPages = 1;

    if (Array.isArray(rawData)) {
      allItems = rawData.map(normalizeAsset);
      total = allItems.length;
    } else if (rawData && typeof rawData === 'object') {
      const items = rawData.items ?? rawData.data ?? rawData.results ?? rawData.assets ?? [];
      allItems = items.map(normalizeAsset);
      total = Number(rawData.total ?? rawData.count ?? rawData.total_count ?? items.length) || items.length;
      totalPages = Number(rawData.total_pages ?? rawData.totalPages) || Math.max(1, Math.ceil(total / pageSize));
    }

    // Fetch remaining pages in batches of 5
    if (totalPages > 1) {
      for (let p = 2; p <= totalPages; p += 5) {
        const batchPromises = [];
        for (let batchPage = p; batchPage < p + 5 && batchPage <= totalPages; batchPage++) {
          batchPromises.push(
            client.get<any>('/api/assets', { params: { ...queryParams, page: batchPage, page_size: pageSize } })
          );
        }
        const batchResponses = await Promise.all(batchPromises);
        for (const resp of batchResponses) {
          if (resp?.data) {
            const pageRaw = resp.data;
            const pageItems = Array.isArray(pageRaw) ? pageRaw : (pageRaw.items ?? pageRaw.data ?? pageRaw.results ?? []);
            allItems = allItems.concat(pageItems.map(normalizeAsset));
          }
        }
      }
    }

    // Client-side filter warranty if warranty report and backend didn't support comma eol_status
    if (reportId === 'warranty') {
      allItems = allItems.filter(a => {
        const eolStatus = (a.calculated_eol_status || a.eol_status || '').toUpperCase().replace(/_/g, ' ');
        const days = a.days_remaining ?? a.daysRemaining ?? null;
        if (eolStatus === 'EXPIRED' || (days !== null && days < 0)) return true;
        if (eolStatus === 'EOL SOON' || (days !== null && days >= 0 && days <= 90)) return true;
        return false;
      });
    }

    return allItems;
  }

  // Get live accurate card counts for all six report cards without truncating
  public async getReportCardCounts(): Promise<ReportCardStats> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return calculateMockReportStats();
    }

    // 1. Try dedicated dashboard summary if available
    try {
      const overview = await this.getDashboardRedesignOverview();
      if (overview?.kpis && overview?.assets_by_source && overview?.eol_distribution) {
        const bigFix = overview.assets_by_source.find(s => s.source.toUpperCase() === 'BIGFIX')?.count ?? 0;
        const jamf = overview.assets_by_source.find(s => s.source.toUpperCase() === 'JAMF')?.count ?? 0;
        const expired = overview.eol_distribution.find(e => e.status.toUpperCase() === 'EXPIRED')?.count ?? 0;
        const expiring = overview.eol_distribution.find(e => e.status.toUpperCase() === 'EOL SOON' || e.status.toUpperCase() === 'NEARING EOL')?.count ?? 0;

        return {
          masterCount: overview.kpis.total_assets,
          expiredCount: expired,
          expiringCount: expiring,
          totalWarrantyIssues: expired + expiring,
          bigFixCount: bigFix,
          jamfCount: jamf,
          inStockCount: overview.kpis.in_stock,
          needValidationCount: overview.kpis.review,
        };
      }
    } catch (_) {
      // Continue to direct queries
    }

    // 2. Query exact total counts from backend GET /api/assets using page_size=1
    try {
      const client = createAxiosClient();
      const [
        masterResp,
        bigFixResp,
        jamfResp,
        inStockResp,
        needValResp,
        expiredResp,
        expiringResp,
      ] = await Promise.all([
        client.get<any>('/api/assets', { params: { page: 1, page_size: 1 } }).catch(() => null),
        client.get<any>('/api/assets', { params: { page: 1, page_size: 1, source: 'BIGFIX' } }).catch(() => null),
        client.get<any>('/api/assets', { params: { page: 1, page_size: 1, source: 'JAMF' } }).catch(() => null),
        client.get<any>('/api/assets', { params: { page: 1, page_size: 1, asset_status: 'IN STOCK' } }).catch(() => null),
        client.get<any>('/api/assets', { params: { page: 1, page_size: 1, asset_status: 'REVIEW' } }).catch(() => null),
        client.get<any>('/api/assets', { params: { page: 1, page_size: 1, eol_status: 'EXPIRED' } }).catch(() => null),
        client.get<any>('/api/assets', { params: { page: 1, page_size: 1, eol_status: 'EOL SOON' } }).catch(() => null),
      ]);

      const getTotal = (resp: any): number => {
        if (!resp?.data) return 0;
        const d = resp.data;
        if (typeof d.total === 'number') return d.total;
        if (typeof d.count === 'number') return d.count;
        if (typeof d.total_count === 'number') return d.total_count;
        if (typeof d.total_records === 'number') return d.total_records;
        if (Array.isArray(d)) return d.length;
        if (Array.isArray(d.items)) return d.items.length;
        return 0;
      };

      const masterCount = getTotal(masterResp);
      const bigFixCount = getTotal(bigFixResp);
      const jamfCount = getTotal(jamfResp);
      const inStockCount = getTotal(inStockResp);
      const needValidationCount = getTotal(needValResp);
      const expiredCount = getTotal(expiredResp);
      const expiringCount = getTotal(expiringResp);

      if (masterCount > 0) {
        return {
          masterCount,
          expiredCount,
          expiringCount,
          totalWarrantyIssues: expiredCount + expiringCount,
          bigFixCount,
          jamfCount,
          inStockCount,
          needValidationCount,
        };
      }
    } catch (_) {
      // Continue to fallback
    }

    // 3. Fallback to mock dataset calculation
    return calculateMockReportStats();
  }

  // Dedicated Fleet Summary KPI endpoint with fallback to complete asset dataset aggregation
  public async getFleetKpiSummary(params?: { source?: string; search?: string }): Promise<FleetKpiMetrics> {
    if (this.isMockMode) {
      await this.simulateLatency();
      let mockList = [...MOCK_ASSETS];
      if (params?.source) {
        mockList = mockList.filter(a => a.source.toUpperCase() === params.source?.toUpperCase());
      }
      return aggregateFleetKpisFromAssets(mockList);
    }

    const client = createAxiosClient();
    const queryParams: Record<string, string> = {};
    if (params?.source) queryParams.source = params.source;
    if (params?.search) queryParams.search = params.search;

    // 1. Try dedicated KPI summary endpoints first
    const summaryRoutes = [
      '/api/assets/summary',
      '/api/fleet/summary',
      '/api/kpi/summary',
      '/api/assets/kpi',
    ];

    for (const route of summaryRoutes) {
      try {
        const resp = await client.get<any>(route, { params: queryParams });
        if (resp.data && typeof resp.data === 'object') {
          const target = resp.data.summary || resp.data.kpi || resp.data;
          // Must contain specific KPI breakdown metrics
          if (
            (target.totalAssets !== undefined || target.total_assets !== undefined) &&
            (target.active !== undefined || target.active_assets !== undefined ||
             target.needValidation !== undefined || target.need_validation !== undefined ||
             target.inStock !== undefined || target.in_stock !== undefined ||
             target.nearingEol !== undefined || target.nearing_eol !== undefined)
          ) {
            const normalized = normalizeFleetKpi(resp.data);
            if (typeof normalized.totalAssets === 'number' && !isNaN(normalized.totalAssets)) {
              return normalized;
            }
          }
        }
      } catch (err: any) {
        // Ignore 404/405, continue to next summary route or fallback to dataset
      }
    }

    // 2. Fallback: Query complete asset dataset in current scope
    // We try page_size=1000 first, if backend limits with 422, fallback to page_size=100
    try {
      const resp = await client.get<any>('/api/assets', {
        params: { ...queryParams, page: 1, page_size: 1000 },
      });

      // If backend returned summary object in envelope
      if (resp.data?.summary && typeof resp.data.summary === 'object') {
        const norm = normalizeFleetKpi(resp.data.summary);
        if (typeof norm.totalAssets === 'number' && !isNaN(norm.totalAssets)) {
          return norm;
        }
      }

      // Check if resp.data itself is a dedicated KPI object
      if (
        resp.data &&
        typeof resp.data === 'object' &&
        !Array.isArray(resp.data) &&
        resp.data.totalAssets !== undefined &&
        (resp.data.active !== undefined || resp.data.needValidation !== undefined)
      ) {
        return normalizeFleetKpi(resp.data);
      }

      const rawItems = Array.isArray(resp.data)
        ? resp.data
        : (resp.data?.items ?? resp.data?.data ?? resp.data?.results ?? []);
      const total = resp.data?.total ?? resp.data?.count ?? rawItems.length;

      let allItems = rawItems.map(normalizeAsset);

      // If total > items.length and there are multiple pages, fetch pages to get complete dataset
      if (total > allItems.length && resp.data?.total_pages && resp.data.total_pages > 1) {
        const totalPages = resp.data.total_pages;
        const pagePromises = [];
        for (let p = 2; p <= Math.min(totalPages, 10); p++) {
          pagePromises.push(
            client.get<any>('/api/assets', {
              params: { ...queryParams, page: p, page_size: resp.data.page_size || 100 },
            }).catch(() => null)
          );
        }
        const results = await Promise.all(pagePromises);
        for (const res of results) {
          if (res?.data) {
            const pageItems = Array.isArray(res.data) ? res.data : (res.data.items || res.data.data || []);
            allItems = allItems.concat(pageItems.map(normalizeAsset));
          }
        }
      }

      const aggregated = aggregateFleetKpisFromAssets(allItems);
      if (typeof total === 'number' && !isNaN(total) && total > aggregated.totalAssets) {
        aggregated.totalAssets = total;
        aggregated.total = total;
      }
      return aggregated;
    } catch (err: any) {
      if (err?.status === 422 || err?.response?.status === 422) {
        const resp = await client.get<any>('/api/assets', {
          params: { ...queryParams, page: 1, page_size: 100 },
        });
        const rawItems = Array.isArray(resp.data)
          ? resp.data
          : (resp.data?.items ?? resp.data?.data ?? []);
        const total = resp.data?.total ?? resp.data?.count ?? rawItems.length;
        let allItems = rawItems.map(normalizeAsset);

        if (total > allItems.length && resp.data?.total_pages && resp.data.total_pages > 1) {
          const totalPages = resp.data.total_pages;
          const pagePromises = [];
          for (let p = 2; p <= Math.min(totalPages, 10); p++) {
            pagePromises.push(
              client.get<any>('/api/assets', {
                params: { ...queryParams, page: p, page_size: resp.data.page_size || 100 },
              }).catch(() => null)
            );
          }
          const results = await Promise.all(pagePromises);
          for (const res of results) {
            if (res?.data) {
              const pageItems = Array.isArray(res.data) ? res.data : (res.data.items || res.data.data || []);
              allItems = allItems.concat(pageItems.map(normalizeAsset));
            }
          }
        }

        const aggregated = aggregateFleetKpisFromAssets(allItems);
        if (typeof total === 'number' && !isNaN(total) && total > aggregated.totalAssets) {
          aggregated.totalAssets = total;
          aggregated.total = total;
          aggregated.total_assets = total;
        }
        return aggregated;
      }
      throw err;
    }
  }

  // Asset by ID
  public async getAssetById(assetId: string | number): Promise<Asset> {
    if (this.isMockMode) {
      await this.simulateLatency();
      const found = MOCK_ASSETS.find(a => String(a.id) === String(assetId) || a.asset_number === String(assetId));
      if (!found) throw new Error(`Asset ${assetId} not found`);
      return normalizeAsset(found);
    }
    const client = createAxiosClient();
    const response = await client.get<any>(`/api/assets/${assetId}`);
    if (!response.data || typeof response.data !== 'object') {
      throw new ApiError({
        type: 'INVALID_RESPONSE_DATA',
        url: `${getApiBaseUrl()}/api/assets/${assetId}`,
        message: `[Invalid Response Data] /api/assets/${assetId} returned invalid asset record.`,
      });
    }
    return normalizeAsset(response.data);
  }

  // Assign or reassign Workday employee to asset (POST /api/assets/{asset_id}/reassign)
  public async reassignAsset(assetId: string | number, data: ReassignAssetRequest): Promise<ReassignAssetResponse> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return reassignMockAsset(assetId, data);
    }
    const client = createAxiosClient();

    // Standardize asset_status to exact uppercase value (defaulting to 'ACTIVE' for manual assignment)
    const assetStatus: StandardAssetStatus = data.asset_status
      ? toStandardAssetStatus(data.asset_status)
      : ASSET_STATUSES.ACTIVE;

    const payload: Record<string, any> = {
      asset_status: assetStatus,
      assignment_type: 'MANUAL',
      assigned_username: data.assigned_username || data.user_id,
      user_id: data.user_id,
      managed_by: data.managed_by,
    };

    if (data.remarks !== undefined && data.remarks !== null && data.remarks !== '') {
      payload.remarks = data.remarks;
      payload.notes = data.remarks;
    }

    let response: any;
    try {
      response = await client.post<any>(`/api/assets/${assetId}/reassign`, payload);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 404 || status === 405) {
        try {
          response = await client.post<any>(`/api/assets/${assetId}/assign`, payload);
        } catch {
          try {
            response = await client.put<any>(`/api/assets/${assetId}/reassign`, payload);
          } catch {
            throw err;
          }
        }
      } else {
        throw err;
      }
    }

    const resData = response.data?.data ?? response.data ?? {};
    return {
      asset_id: resData.asset_id ?? resData.assetId ?? assetId,
      assigned_username: resData.assigned_username ?? resData.assignedUsername ?? data.user_id,
      managed_by: resData.managed_by ?? resData.managedBy ?? data.managed_by,
      assignment_type: resData.assignment_type ?? resData.assignmentType ?? 'Manual',
      verified_employee_name: resData.verified_employee_name ?? resData.verifiedEmployeeName,
      notes: resData.notes ?? resData.remarks ?? data.remarks,
      updated_at: resData.updated_at ?? resData.updatedAt ?? new Date().toISOString(),
      message: resData.message ?? `Asset ${assetId} successfully assigned to ${data.user_id}.`,
    };
  }

  // Assignment API alias
  public async assignAsset(assetId: string | number, data: ReassignAssetRequest): Promise<ReassignAssetResponse> {
    return this.reassignAsset(assetId, data);
  }

  // Bulk Assign or Reassign Workday employee to multiple assets
  public async bulkAssignAssets(data: BulkAssignAssetsRequest): Promise<BulkAssignAssetsResponse> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return bulkAssignMockAssets(data);
    }
    const client = createAxiosClient();

    const assetStatus: StandardAssetStatus = data.asset_status
      ? toStandardAssetStatus(data.asset_status)
      : ASSET_STATUSES.ACTIVE;

    const payload: Record<string, any> = {
      user_id: data.user_id,
      assigned_username: data.assigned_username || data.user_id,
      managed_by: data.managed_by,
      assignment_type: 'MANUAL',
      asset_status: assetStatus,
    };

    if (data.select_all_matching) {
      payload.select_all_matching = true;
      payload.all_matching = true;
      payload.select_all = true;
      if (data.filters) {
        payload.filters = data.filters;
        Object.assign(payload, data.filters);
      }
      payload.asset_ids = data.asset_ids || [];
    } else {
      payload.asset_ids = data.asset_ids || [];
    }

    // Remarks behavior:
    // If remarks contain text, submit entered value.
    // If remarks are blank or contain only whitespace, submit null so the backend
    // updates assets.remarks to SQL NULL for every successfully assigned asset.
    // Do not omit remarks in a way that causes old remarks to remain.
    const remarksTrimmed = (data.remarks ?? '').trim();
    if (remarksTrimmed !== '') {
      payload.remarks = remarksTrimmed;
      payload.notes = remarksTrimmed;
    } else {
      payload.remarks = null;
      payload.notes = null;
    }

    // Attempt standard bulk assignment routes
    const routes = [
      '/api/assets/bulk-assign',
      '/api/assets/bulk-reassign',
      '/api/assets/assign/bulk',
      '/api/assets/reassign/bulk',
      '/api/assets/bulk',
    ];

    for (const route of routes) {
      try {
        const response = await client.post<any>(route, payload);
        const resData = response.data?.data ?? response.data ?? {};
        const fallbackTargetCount = data.select_all_matching ? (resData.total ?? 0) : (data.asset_ids?.length ?? 0);
        const assignedCount =
          resData.assigned_count ??
          resData.count ??
          resData.successful_count ??
          (Array.isArray(resData.successful_asset_ids) ? resData.successful_asset_ids.length : fallbackTargetCount);
        const successfulIds =
          resData.successful_asset_ids ??
          resData.asset_ids ??
          (data.select_all_matching ? [] : (data.asset_ids || []));
        const failedIds = resData.failed_asset_ids ?? [];
        const failedCount = resData.failed_count ?? failedIds.length;
        const totalProcessed = resData.total_processed ?? resData.total ?? (assignedCount + failedCount);

        return {
          assigned_count: assignedCount,
          successful_asset_ids: successfulIds,
          failed_asset_ids: failedIds,
          total_processed: totalProcessed,
          failed_count: failedCount,
          failures: resData.failures ?? [],
          message:
            resData.message ??
            `Successfully assigned ${assignedCount} assets to ${data.user_id}.`,
        };
      } catch (err: any) {
        const status = err?.status || err?.response?.status;
        if (status !== 404 && status !== 405) {
          throw err;
        }
      }
    }

    // Fallback: If backend does not expose a dedicated bulk endpoint, run individual reassignments
    if (!data.select_all_matching && data.asset_ids && data.asset_ids.length > 0) {
      const results = await Promise.allSettled(
        data.asset_ids.map(assetId =>
          this.reassignAsset(assetId, {
            user_id: data.user_id,
            assigned_username: data.assigned_username || data.user_id,
            managed_by: data.managed_by,
            remarks: remarksTrimmed !== '' ? remarksTrimmed : (null as any),
            assignment_type: 'MANUAL',
            asset_status: assetStatus,
          })
        )
      );

      const successful: (string | number)[] = [];
      const failed: (string | number)[] = [];
      results.forEach((res, index) => {
        if (res.status === 'fulfilled') {
          successful.push(data.asset_ids![index]);
        } else {
          failed.push(data.asset_ids![index]);
        }
      });

      if (successful.length === 0 && failed.length > 0) {
        throw new Error(`Failed to assign assets: All ${failed.length} requests failed.`);
      }

      return {
        assigned_count: successful.length,
        successful_asset_ids: successful,
        failed_asset_ids: failed,
        total_processed: data.asset_ids.length,
        failed_count: failed.length,
        message: `Successfully assigned ${successful.length} of ${data.asset_ids.length} assets to ${data.user_id}.`,
      };
    }

    throw new Error('Bulk assignment endpoint is not available on the server.');
  }

  // Bulk assign alias
  public async bulkReassignAssets(data: BulkAssignAssetsRequest): Promise<BulkAssignAssetsResponse> {
    return this.bulkAssignAssets(data);
  }

  // Employees list with safe parameter normalization to prevent FastAPI HTTP 422
  public async getEmployees(params: EmployeeQueryParams): Promise<PaginatedResponse<Employee>> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return filterAndPaginateEmployees(params);
    }
    const client = createAxiosClient();

    const page = Math.max(1, Number(params.page) || 1);
    // FastAPI standard pagination limits page_size (le=100)
    const pageSize = Math.min(100, Math.max(1, Number(params.page_size ?? (params as any).size) || 10));

    const cleanParams: Record<string, any> = {
      page,
      page_size: pageSize,
    };
    if (params.search && params.search.trim()) {
      cleanParams.search = params.search.trim();
    }
    if (params.department && params.department.trim()) {
      cleanParams.department = params.department.trim();
    }
    if (params.division && params.division.trim()) {
      cleanParams.division = params.division.trim();
    }
    if (params.employee_status && params.employee_status.trim()) {
      cleanParams.employee_status = params.employee_status.trim();
    }
    if (params.sort_by && params.sort_by.trim()) {
      cleanParams.sort_by = params.sort_by.trim();
    }
    if (params.sort_order && params.sort_order.trim()) {
      cleanParams.sort_order = params.sort_order.trim();
    }

    const parseResponse = (data: any): PaginatedResponse<Employee> => {
      let rawList: any[] = [];
      let total = 0;
      let respPage = page;
      let respPageSize = pageSize;
      let totalPages = 1;

      if (Array.isArray(data)) {
        total = data.length;
        totalPages = Math.max(1, Math.ceil(total / respPageSize));
        const startIndex = (respPage - 1) * respPageSize;
        rawList = data.slice(startIndex, startIndex + respPageSize);
      } else if (data && typeof data === 'object') {
        const fullList = data.items ?? data.data ?? data.results ?? data.employees ?? [];
        const extractedTotal =
          data.total ??
          data.count ??
          data.total_count ??
          data.totalCount ??
          data.total_records ??
          data.totalRecords;
        total = typeof extractedTotal === 'number' && !isNaN(extractedTotal)
          ? extractedTotal
          : Number(extractedTotal) || fullList.length;
        respPage = Number(data.page) || respPage;
        respPageSize = Number(data.page_size ?? data.pageSize ?? data.size) || respPageSize;
        totalPages = Number(data.total_pages ?? data.totalPages ?? data.last_page) || Math.max(1, Math.ceil(total / respPageSize));

        if (extractedTotal === undefined && fullList.length > respPageSize) {
          const startIndex = (respPage - 1) * respPageSize;
          rawList = fullList.slice(startIndex, startIndex + respPageSize);
        } else {
          rawList = fullList;
        }
      } else {
        throw new ApiError({
          type: 'INVALID_RESPONSE_DATA',
          url: `${getApiBaseUrl()}/api/employees`,
          message: `[Invalid Response Data] /api/employees expected a paginated object ({ items: [...] }) or array, received: ${typeof data}.`,
        });
      }

      return {
        items: rawList.map(normalizeEmployee),
        total,
        page: respPage,
        page_size: respPageSize,
        total_pages: totalPages,
      };
    };

    try {
      const response = await client.get<any>('/api/employees', { params: cleanParams });
      return parseResponse(response.data);
    } catch (err: any) {
      // If 422 Unprocessable Entity, attempt fallback parameter formats (e.g., 'size' for fastapi-pagination)
      const status = err?.status || err?.response?.status;
      if (status === 422) {
        try {
          const fallbackParams: Record<string, any> = { ...cleanParams, size: pageSize };
          delete fallbackParams.page_size;
          const retryResp = await client.get<any>('/api/employees', { params: fallbackParams });
          return parseResponse(retryResp.data);
        } catch {
          try {
            // Minimal pagination params
            const minParams: Record<string, any> = { page, page_size: Math.min(pageSize, 20) };
            if (cleanParams.search) minParams.search = cleanParams.search;
            const minResp = await client.get<any>('/api/employees', { params: minParams });
            return parseResponse(minResp.data);
          } catch {
            throw err;
          }
        }
      }
      throw err;
    }
  }

  // Employee by ID
  public async getEmployeeById(employeeId: string | number): Promise<Employee> {
    if (this.isMockMode) {
      await this.simulateLatency();
      const emp = MOCK_EMPLOYEES.find(e => String(e.id) === String(employeeId) || e.employee_id === String(employeeId) || e.user_id === String(employeeId));
      if (!emp) throw new Error(`Employee ${employeeId} not found`);
      const assigned = MOCK_ASSETS.filter(a => a.assigned_username === emp.user_id || a.verified_employee_id === emp.employee_id);
      return {
        ...emp,
        assigned_assets_count: assigned.length,
        assigned_assets: assigned,
      };
    }
    const client = createAxiosClient();
    const response = await client.get<any>(`/api/employees/${employeeId}`);
    const data = response.data;
    const mgrUser =
      data.manager_user_name ??
      data.manager_username ??
      data.managerUsername ??
      data.manager_user ??
      null;
    const mgrName = data.manager_name ?? data.managerName ?? null;
    return {
      ...data,
      manager_user_name: mgrUser,
      manager_username: mgrUser,
      managerUsername: mgrUser,
      manager_name: mgrName,
      managerName: mgrName,
    };
  }

  // EOL list
  public async getEOLAssets(params: AssetQueryParams): Promise<PaginatedResponse<Asset>> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return filterAndPaginateAssets(params);
    }
    const client = createAxiosClient();
    const response = await client.get<any>('/api/eol', {
      params,
    });
    let rawItems: any[] = [];
    let total = 0;
    let page = params.page || 1;
    let pageSize = params.page_size || 25;
    let totalPages = 1;

    if (Array.isArray(response.data)) {
      rawItems = response.data;
      total = response.data.length;
      totalPages = Math.max(1, Math.ceil(total / pageSize));
    } else if (response.data && typeof response.data === 'object') {
      rawItems = response.data.items ?? response.data.data ?? response.data.results ?? response.data.assets ?? [];
      const extractedTotal =
        response.data.total ??
        response.data.count ??
        response.data.total_count ??
        response.data.totalCount ??
        response.data.total_records ??
        response.data.totalRecords;
      total = typeof extractedTotal === 'number' && !isNaN(extractedTotal)
        ? extractedTotal
        : Number(extractedTotal) || rawItems.length;
      page = Number(response.data.page) || page;
      pageSize = Number(response.data.page_size ?? response.data.pageSize) || pageSize;
      totalPages = Number(response.data.total_pages ?? response.data.totalPages) || Math.max(1, Math.ceil(total / pageSize));
    }

    return {
      items: rawItems.map(normalizeAsset),
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    };
  }

  // Device EOL References - CRUD operations for device_eol_reference
  public async getEOLReferences(search?: string): Promise<DeviceEOLReference[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockEOLReferences(search);
    }
    const client = createAxiosClient();
    const routes = ['/api/eol-reference', '/api/eol-references', '/api/eol_reference', '/api/eol/reference'];
    return this.requestWithRouteFallback<DeviceEOLReference[]>(client, 'GET', routes, {
      params: search ? { search } : undefined,
    });
  }

  public async createEOLReference(data: DeviceEOLReferenceCreate): Promise<DeviceEOLReference> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return createMockEOLReference(data);
    }
    const client = createAxiosClient();
    const routes = ['/api/eol-reference', '/api/eol-references', '/api/eol_reference'];
    return this.requestWithRouteFallback<DeviceEOLReference>(client, 'POST', routes, undefined, data);
  }

  // Create or update EOL reference for a manufacturer/model
  public async saveEOLReference(data: DeviceEOLReferenceCreate): Promise<DeviceEOLReference> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return createMockEOLReference(data);
    }
    const client = createAxiosClient();
    try {
      const routes = ['/api/eol-reference', '/api/eol-references', '/api/eol_reference'];
      return await this.requestWithRouteFallback<DeviceEOLReference>(client, 'POST', routes, undefined, data);
    } catch (err: any) {
      const isConflict =
        err?.response?.status === 409 ||
        err?.response?.status === 400 ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('already exists'));
      if (isConflict) {
        try {
          const refs = await this.getEOLReferences(data.model);
          const match = refs.find(
            r =>
              r.manufacturer.toLowerCase().trim() === data.manufacturer.toLowerCase().trim() &&
              r.model.toLowerCase().trim() === data.model.toLowerCase().trim()
          );
          if (match && match.eol_id) {
            return await this.updateEOLReference(match.eol_id, data);
          }
        } catch {
          // fallback failed, throw original
        }
      }
      throw err;
    }
  }

  public async updateEOLReference(eolId: number, data: DeviceEOLReferenceUpdate): Promise<DeviceEOLReference> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return updateMockEOLReference(eolId, data);
    }
    const client = createAxiosClient();
    const routes = [`/api/eol-reference/${eolId}`, `/api/eol-references/${eolId}`, `/api/eol_reference/${eolId}`];
    return this.requestWithRouteFallback<DeviceEOLReference>(client, 'PUT', routes, undefined, data);
  }

  public async deleteEOLReference(eolId: number): Promise<void> {
    if (this.isMockMode) {
      await this.simulateLatency();
      deleteMockEOLReference(eolId);
      return;
    }
    const client = createAxiosClient();
    const routes = [`/api/eol-reference/${eolId}`, `/api/eol-references/${eolId}`, `/api/eol_reference/${eolId}`];
    await this.requestWithRouteFallback<void>(client, 'DELETE', routes);
  }

  // Admin User Management - operations for PostgreSQL admin_users table
  public async getAdminUsers(search?: string): Promise<AdminUser[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockAdminUsers(search);
    }
    const client = createAxiosClient();
    const routes = ['/api/admin-users', '/api/admin_users', '/api/admin-users/'];
    return this.requestWithRouteFallback<AdminUser[]>(client, 'GET', routes, {
      params: search ? { search } : undefined,
    });
  }

  public async getAvailableWorkdayUsers(
    params?: string | AvailableWorkdayUsersQueryParams
  ): Promise<PaginatedAvailableUsersResponse> {
    const searchParam = typeof params === 'string' ? params : params?.search;
    const cleanSearch = searchParam?.trim();
    const page = typeof params === 'object' && params?.page ? Math.max(1, params.page) : 1;
    const pageSize = typeof params === 'object' && params?.page_size ? Math.max(1, params.page_size) : 10;

    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockAvailableWorkdayUsers({ page, page_size: pageSize, search: cleanSearch });
    }

    const client = createAxiosClient();
    const queryParams: Record<string, any> = {
      page,
      page_size: pageSize,
    };
    if (cleanSearch) {
      queryParams.search = cleanSearch;
    }

    // Determine target route with 404 fallback
    const routes = ['/api/admin-users/available-users', '/api/admin_users/available_users'];

    let resp: any = null;
    let endpointUsed = routes[0];

    try {
      resp = await client.get<any>(routes[0], {
        params: queryParams,
      });
      endpointUsed = routes[0];
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 404) {
        endpointUsed = routes[1];
        resp = await client.get<any>(routes[1], {
          params: queryParams,
        });
      } else {
        throw err;
      }
    }

    const responseData = resp.data;
    let target = responseData;
    if (target && target.data && typeof target.data === 'object' && !Array.isArray(target.data)) {
      if (target.data.items || target.data.results || target.data.users || target.data.employees || target.data.records) {
        target = target.data;
      }
    }

    const rawList =
      target?.items ??
      target?.data ??
      target?.results ??
      target?.users ??
      target?.employees ??
      target?.records ??
      (Array.isArray(target) ? target : []);

    const rawItems = Array.isArray(rawList) ? rawList : [];
    const items: AvailableWorkdayUser[] = [];
    const seen = new Set<string>();

    for (const raw of rawItems) {
      const normalized = normalizeAvailableWorkdayUser(raw);
      if (!normalized.user_id) continue;
      const lower = normalized.user_id.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        items.push(normalized);
      }
    }

    const meta = target?.meta ?? target?.pagination ?? {};
    const rawTotal =
      target?.total ??
      target?.count ??
      target?.total_records ??
      target?.totalRecords ??
      target?.total_count ??
      target?.totalCount ??
      meta.total ??
      meta.total_records ??
      meta.count;

    const total = rawTotal !== undefined && rawTotal !== null
      ? (Number(rawTotal) || items.length)
      : items.length;

    const respPage =
      Number(target?.page ?? target?.current_page ?? target?.currentPage ?? meta.page ?? meta.current_page) ||
      page;

    const respPageSize =
      Number(
        target?.page_size ??
        target?.pageSize ??
        target?.size ??
        target?.limit ??
        target?.per_page ??
        target?.perPage ??
        meta.page_size ??
        meta.size ??
        meta.limit
      ) ||
      pageSize;

    const rawTotalPages =
      target?.total_pages ??
      target?.totalPages ??
      target?.pages ??
      target?.page_count ??
      target?.last_page ??
      meta.total_pages ??
      meta.totalPages ??
      meta.last_page;

    const totalPages = Number(rawTotalPages) || Math.max(1, Math.ceil(total / (respPageSize || 1)));

    let finalItems = items;
    if (rawTotal === undefined && items.length > respPageSize) {
      const startIndex = (respPage - 1) * respPageSize;
      finalItems = items.slice(startIndex, startIndex + respPageSize);
    }

    return {
      items: finalItems,
      total,
      page: respPage,
      page_size: respPageSize,
      total_pages: totalPages,
    };
  }

  public async bulkAddAdminUsers(userIds: string[]): Promise<BulkAddAdminUsersResponse> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return bulkAddMockAdminUsers(userIds);
    }
    const client = createAxiosClient();
    const payload: BulkAddAdminUsersRequest = { user_ids: userIds };

    // Primary backend contract: POST /api/admin-users
    try {
      const response = await client.post<any>('/api/admin-users', payload);
      const res = response.data?.data ?? response.data ?? {};
      return this.normalizeBulkAddResponse(res, userIds);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 404) {
        try {
          const altResponse = await client.post<any>('/api/admin_users', payload);
          const altRes = altResponse.data?.data ?? altResponse.data ?? {};
          return this.normalizeBulkAddResponse(altRes, userIds);
        } catch {
          try {
            const bulkResponse = await client.post<any>('/api/admin-users/bulk', payload);
            const bulkRes = bulkResponse.data?.data ?? bulkResponse.data ?? {};
            return this.normalizeBulkAddResponse(bulkRes, userIds);
          } catch {
            throw err;
          }
        }
      }
      throw err;
    }
  }

  private normalizeBulkAddResponse(res: any, requestedUserIds: string[]): BulkAddAdminUsersResponse {
    const addedCount = typeof res.added_count === 'number'
      ? res.added_count
      : Array.isArray(res.added_user_ids)
      ? res.added_user_ids.length
      : Array.isArray(res)
      ? res.length
      : requestedUserIds.length;

    const addedUserIds = Array.isArray(res.added_user_ids)
      ? res.added_user_ids
      : Array.isArray(res)
      ? res.map((r: any) => r.admin_user_id || r.user_id || r)
      : requestedUserIds;

    const skippedUserIds = Array.isArray(res.skipped_user_ids)
      ? res.skipped_user_ids
      : [];

    const message = res.message || (
      skippedUserIds.length > 0
        ? `Added ${addedCount} user(s); skipped ${skippedUserIds.length} user(s).`
        : `Successfully registered ${addedCount} administrator user${addedCount === 1 ? '' : 's'}.`
    );

    return {
      added_count: addedCount,
      added_user_ids: addedUserIds,
      skipped_user_ids: skippedUserIds,
      message,
    };
  }

  public async deleteAdminUser(adminUserId: string): Promise<void> {
    if (this.isMockMode) {
      await this.simulateLatency();
      deleteMockAdminUser(adminUserId);
      return;
    }
    const client = createAxiosClient();
    const encoded = encodeURIComponent(adminUserId);
    const routes = [`/api/admin-users/${encoded}`, `/api/admin_users/${encoded}`];
    await this.requestWithRouteFallback<void>(client, 'DELETE', routes);
  }

  private async requestWithRouteFallback<T>(
    client: AxiosInstance,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    routes: string[],
    config?: any,
    data?: any
  ): Promise<T> {
    let lastError: any = null;
    for (const route of routes) {
      try {
        let resp: any;
        if (method === 'GET') {
          resp = await client.get<T>(route, config);
        } else if (method === 'POST') {
          resp = await client.post<T>(route, data, config);
        } else if (method === 'PUT') {
          resp = await client.put<T>(route, data, config);
        } else if (method === 'DELETE') {
          resp = await client.delete<T>(route, config);
        }
        return resp.data;
      } catch (err: any) {
        lastError = err;
        // Only try alternative route if it was a 404 (Not Found)
        if (err?.status !== 404 && err?.response?.status !== 404) {
          throw err;
        }
      }
    }
    throw lastError;
  }

  private async simulateLatency(ms: number = 180): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const api = new ApiService();
