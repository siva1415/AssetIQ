import axios, { AxiosInstance } from 'axios';
import {
  Asset,
  AssetSource,
  AssetStatus,
  AssignmentType,
  EOLStatus,
  Employee,
  FleetKpiMetrics,
  DeviceEOLReference,
  DeviceEOLReferenceCreate,
  DeviceEOLReferenceUpdate,
  DashboardSummary,
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
  BulkAddAdminUsersRequest,
  BulkAddAdminUsersResponse,
  ReassignAssetRequest,
  ReassignAssetResponse,
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
} from './mockData';

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

  // Device Type: Agreed property deviceType, mapped from assets.devicetype
  const deviceType = raw.deviceType ?? raw.device_type ?? raw.devicetype ?? '';

  // MAC Address: Agreed property macAddress, mapped from macaddress
  const macAddress = raw.macAddress ?? raw.mac_address ?? raw.macaddress ?? '—';

  // Last Discovery Date: Agreed property lastDiscoveryDate, mapped from lastreporttime
  const lastDiscoveryDate = raw.lastDiscoveryDate ?? raw.last_report_time ?? raw.lastreporttime ?? raw.last_discovery_date ?? '';

  // EOL: Agreed properties eolStatus and eolDate
  const eolStatus = (raw.eolStatus ?? raw.eol_status ?? raw.calculated_eol_status ?? raw.calculatedEolStatus ?? 'Unknown') as EOLStatus;
  const eolDate = raw.eolDate ?? raw.eol_date ?? null;
  const daysRemaining = raw.daysRemaining ?? raw.days_remaining ?? null;

  // Status & Assignment
  const assetStatus = (raw.assetStatus ?? raw.asset_status ?? raw.status ?? 'Active') as AssetStatus;
  const assignmentType = (raw.assignmentType ?? raw.assignment_type ?? 'Unassigned') as AssignmentType;
  const managedBy = raw.managedBy ?? raw.managed_by ?? '';

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
    manager_username: raw.manager_username ?? raw.managerUsername ?? raw.employee?.manager_username ?? null,
    managerUsername: raw.managerUsername ?? raw.manager_username ?? raw.employee?.manager_username ?? null,
    manager_name: raw.manager_name ?? raw.managerName ?? raw.employee?.manager_name ?? null,
    managerName: raw.managerName ?? raw.manager_name ?? raw.employee?.manager_name ?? null,
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

// Helper to aggregate Fleet Summary KPI counts from a complete list of Asset items
export function aggregateFleetKpisFromAssets(items: Asset[]): FleetKpiMetrics {
  const totalAssets = items.length;
  let active = 0;
  let needValidation = 0;
  let inStock = 0;
  let nearingEol = 0;

  for (const asset of items) {
    // 1. Operational status:
    // Active, Need Validation, InStock / In Stock
    const rawStatus = (asset.assetStatus || asset.asset_status || '').trim().toLowerCase();
    const cleanStatus = rawStatus.replace(/[\s_]/g, '');

    if (cleanStatus === 'active') {
      active++;
    } else if (cleanStatus === 'needvalidation') {
      needValidation++;
    } else if (cleanStatus === 'instock') {
      inStock++;
    }

    // 2. Backend-calculated EOL status: count assets whose backend EOL status is Nearing EOL
    // (Never derive Nearing EOL from operational asset status)
    const rawEol = (
      asset.eolStatus ||
      asset.calculated_eol_status ||
      (asset as any).eol_status ||
      ''
    ).trim().toLowerCase();
    const cleanEol = rawEol.replace(/[\s_]/g, '');

    if (cleanEol === 'nearingeol') {
      nearingEol++;
    }
  }

  return {
    totalAssets,
    total: totalAssets,
    total_assets: totalAssets,
    active,
    active_assets: active,
    needValidation,
    need_validation: needValidation,
    inStock,
    in_stock: inStock,
    nearingEol,
    nearing_eol: nearingEol,
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

  // 3. Need Validation: needValidation, need_validation, needValidationAssets, need_validation_assets, needValidationCount, need_validation_count
  const needValidationVal = parseNum(
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

  // 5. Nearing EOL: nearingEol, nearing_eol, nearingEolAssets, nearing_eol_assets, nearingEolCount, nearing_eol_count, expiringEol, expiring_eol
  const nearingEolVal = parseNum(
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
    needValidationVal !== null ||
    inStockVal !== null ||
    nearingEolVal !== null ||
    target.totalAssets !== undefined ||
    target.total_assets !== undefined;

  if (isDedicatedKpiObject) {
    const total = totalVal !== null ? totalVal : (fallbackItems ? fallbackItems.length : 0);
    const active = activeVal !== null ? activeVal : 0;
    const needValidation = needValidationVal !== null ? needValidationVal : 0;
    const inStock = inStockVal !== null ? inStockVal : 0;
    const nearingEol = nearingEolVal !== null ? nearingEolVal : 0;
    return {
      totalAssets: total,
      total,
      total_assets: total,
      active,
      active_assets: active,
      needValidation,
      need_validation: needValidation,
      inStock,
      in_stock: inStock,
      nearingEol,
      nearing_eol: nearingEol,
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
  const finalNeedValidation = needValidationVal !== null ? needValidationVal : 0;
  const finalInStock = inStockVal !== null ? inStockVal : 0;
  const finalNearingEol = nearingEolVal !== null ? nearingEolVal : 0;

  return {
    totalAssets: finalTotal,
    total: finalTotal,
    total_assets: finalTotal,
    active: finalActive,
    active_assets: finalActive,
    needValidation: finalNeedValidation,
    need_validation: finalNeedValidation,
    inStock: finalInStock,
    in_stock: finalInStock,
    nearingEol: finalNearingEol,
    nearing_eol: finalNearingEol,
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

  // Assets by source
  public async getAssetsBySource(): Promise<AssetsBySourceItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockAssetsBySource();
    }
    const client = createAxiosClient();
    const response = await client.get<AssetsBySourceItem[]>('/api/dashboard/assets-by-source');
    return response.data;
  }

  // Ownership summary
  public async getOwnershipSummary(): Promise<OwnershipSummaryItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockOwnershipSummary();
    }
    const client = createAxiosClient();
    const response = await client.get<OwnershipSummaryItem[]>('/api/dashboard/ownership-summary');
    return response.data;
  }

  // EOL summary
  public async getEOLSummary(): Promise<EOLSummaryItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockEOLSummary();
    }
    const client = createAxiosClient();
    const response = await client.get<EOLSummaryItem[]>('/api/dashboard/eol-summary');
    return response.data;
  }

  // Operational status distribution
  public async getOperationalStatusSummary(): Promise<OperationalStatusItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockOperationalStatus();
    }
    const client = createAxiosClient();
    const response = await client.get<OperationalStatusItem[]>('/api/dashboard/operational-status');
    if (!Array.isArray(response.data)) {
      throw new ApiError({
        type: 'INVALID_RESPONSE_DATA',
        url: `${getApiBaseUrl()}/api/dashboard/operational-status`,
        message: `[Invalid Response Data] /api/dashboard/operational-status expected an array, got ${typeof response.data}.`,
      });
    }
    return response.data;
  }

  // Department distribution
  public async getDepartmentDistribution(): Promise<DepartmentDistributionItem[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockDepartmentDistribution();
    }
    const client = createAxiosClient();
    const response = await client.get<DepartmentDistributionItem[]>('/api/dashboard/department-summary');
    if (!Array.isArray(response.data)) {
      throw new ApiError({
        type: 'INVALID_RESPONSE_DATA',
        url: `${getApiBaseUrl()}/api/dashboard/department-summary`,
        message: `[Invalid Response Data] /api/dashboard/department-summary expected an array, got ${typeof response.data}.`,
      });
    }
    return response.data;
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
    const client = createAxiosClient();
    const response = await client.get<any>('/api/assets', {
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
    const response = await client.post<ReassignAssetResponse>(`/api/assets/${assetId}/reassign`, data);
    return response.data;
  }

  // Employees list
  public async getEmployees(params: EmployeeQueryParams): Promise<PaginatedResponse<Employee>> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return filterAndPaginateEmployees(params);
    }
    const client = createAxiosClient();
    const response = await client.get<any>('/api/employees', {
      params,
    });
    if (Array.isArray(response.data)) {
      return {
        items: response.data,
        total: response.data.length,
        page: params.page || 1,
        page_size: params.page_size || response.data.length,
        total_pages: 1,
      };
    }
    if (response.data && (Array.isArray(response.data.items) || Array.isArray(response.data.data))) {
      const rawList = response.data.items ?? response.data.data;
      const total = response.data.total ?? response.data.count ?? rawList.length;
      return {
        items: rawList,
        total: Number(total) || rawList.length,
        page: Number(response.data.page) || params.page || 1,
        page_size: Number(response.data.page_size) || params.page_size || rawList.length,
        total_pages: Number(response.data.total_pages) || 1,
      };
    }
    throw new ApiError({
      type: 'INVALID_RESPONSE_DATA',
      url: `${getApiBaseUrl()}/api/employees`,
      message: `[Invalid Response Data] /api/employees expected a paginated object ({ items: [...] }) or array, received: ${typeof response.data}.`,
    });
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
    const response = await client.get<Employee>(`/api/employees/${employeeId}`);
    return response.data;
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

  public async getAvailableWorkdayUsers(search?: string): Promise<AvailableWorkdayUser[]> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return getMockAvailableWorkdayUsers(search);
    }
    const client = createAxiosClient();
    const routes = ['/api/admin-users/available-users', '/api/admin_users/available_users', '/api/admin-users/available-users/'];
    return this.requestWithRouteFallback<AvailableWorkdayUser[]>(client, 'GET', routes, {
      params: search ? { search } : undefined,
    });
  }

  public async bulkAddAdminUsers(userIds: string[]): Promise<BulkAddAdminUsersResponse> {
    if (this.isMockMode) {
      await this.simulateLatency();
      return bulkAddMockAdminUsers(userIds);
    }
    const client = createAxiosClient();
    const payload: BulkAddAdminUsersRequest = { user_ids: userIds };
    const routes = ['/api/admin-users/bulk', '/api/admin_users/bulk', '/api/admin-users/bulk/'];
    return this.requestWithRouteFallback<BulkAddAdminUsersResponse>(client, 'POST', routes, undefined, payload);
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
