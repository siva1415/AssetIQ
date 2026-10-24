export type AssetSource = 'BIGFIX' | 'JAMF';
export type DeviceType = 'Desktop' | 'Laptop' | 'Server';

// Standardized uppercase asset status values for PostgreSQL & FastAPI
export const ASSET_STATUSES = {
  ACTIVE: 'ACTIVE',
  REVIEW: 'REVIEW',
  NEED_VALIDATION: 'REVIEW',
  IN_STOCK: 'IN STOCK',
  RETIRED: 'RETIRED',
} as const;

export type StandardAssetStatus = 'ACTIVE' | 'REVIEW' | 'IN STOCK' | 'RETIRED';

// Friendly UI labels mapping to standardized API values
export const ASSET_STATUS_LABELS: Record<StandardAssetStatus, string> = {
  ACTIVE: 'Active',
  REVIEW: 'Review',
  'IN STOCK': 'In Stock',
  RETIRED: 'Retired',
};

// Normalized AssetStatus supporting both exact API enum and casing
export type AssetStatus =
  | StandardAssetStatus
  | 'Active'
  | 'Review'
  | 'Need Validation'
  | 'In Stock'
  | 'Retired';

export function toStandardAssetStatus(status?: string | null): StandardAssetStatus {
  if (!status) return ASSET_STATUSES.ACTIVE;
  const s = status.trim().toUpperCase().replace(/_/g, ' ');
  if (s === 'ACTIVE') return ASSET_STATUSES.ACTIVE;
  if (s === 'REVIEW' || s === 'NEED VALIDATION' || s === 'NEEDVALIDATION') return ASSET_STATUSES.REVIEW;
  if (s === 'IN STOCK' || s === 'INSTOCK') return ASSET_STATUSES.IN_STOCK;
  if (s === 'RETIRED') return ASSET_STATUSES.RETIRED;
  return ASSET_STATUSES.ACTIVE;
}

export type AssignmentType = 'Automatic' | 'Manual' | 'Unassigned';

export const EOL_STATUSES = {
  ACTIVE: 'ACTIVE',
  EOL_SOON: 'EOL SOON',
  NEARING_EOL: 'EOL SOON',
  EXPIRED: 'EXPIRED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type StandardEOLStatus = 'ACTIVE' | 'EOL SOON' | 'EXPIRED' | 'UNKNOWN';

export type EOLStatus =
  | 'Active'
  | 'EOL Soon'
  | 'Nearing EOL'
  | 'Expired'
  | 'Unknown'
  | StandardEOLStatus;

export function toStandardEOLStatus(status?: string | null): StandardEOLStatus {
  if (!status) return EOL_STATUSES.UNKNOWN;
  const s = status.trim().toUpperCase().replace(/_/g, ' ');
  if (s === 'ACTIVE') return EOL_STATUSES.ACTIVE;
  if (s === 'EOL SOON' || s === 'EOLSOON' || s === 'NEARING EOL' || s === 'NEARINGEOL' || s.startsWith('NEARING')) {
    return EOL_STATUSES.EOL_SOON;
  }
  if (s === 'EXPIRED') return EOL_STATUSES.EXPIRED;
  if (s === 'UNKNOWN') return EOL_STATUSES.UNKNOWN;
  return EOL_STATUSES.UNKNOWN;
}

export function formatEolDate(dateVal?: string | null): string {
  if (!dateVal) return '—';
  const str = String(dateVal).trim();
  if (
    !str ||
    str === '—' ||
    str === 'null' ||
    str === 'undefined' ||
    str.toUpperCase() === 'UNKNOWN'
  ) {
    return '—';
  }
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fallback
  }
  return str;
}

/**
 * Format the days-left text displayed on the second line below the EOL Status badge.
 * Format:
 * - ACTIVE: "896d left"
 * - EOL SOON: "86d left"
 * - EXPIRED: "-32d left"
 * - UNKNOWN: "-"
 * - If status is unknown or days-left value is unavailable, displays "-"
 */
export function formatEolDaysLeft(
  status?: string | null,
  daysRemaining?: number | null
): string {
  const standardStatus = toStandardEOLStatus(status);
  if (standardStatus === 'UNKNOWN') {
    return '-';
  }
  if (daysRemaining === null || daysRemaining === undefined || isNaN(Number(daysRemaining))) {
    return '-';
  }
  const days = Math.round(Number(daysRemaining));
  return `${days}d left`;
}

export type EmployeeStatus = 'Active' | 'Terminated' | 'On Leave';
export type WorkdayMatchStatus = 'Matched' | 'Not Found in Workday' | 'Admin Account' | 'Unassigned';

export type EOLManufacturer = 'DELL' | 'HP' | 'Lenovo' | 'Apple';

export interface DeviceEOLReference {
  eol_id: number;
  manufacturer: string;
  model: string;
  eol_date: string; // ISO date string (YYYY-MM-DD)
  reference_source?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeviceEOLReferenceCreate {
  manufacturer: string;
  model: string;
  eol_date: string;
  reference_source?: string | null;
}

export interface DeviceEOLReferenceUpdate {
  manufacturer: string;
  model: string;
  eol_date: string;
  reference_source?: string | null;
}

export interface ReportingEvp {
  full_name?: string;
  fullName?: string;
  user_id?: string;
  userId?: string;
  job_title?: string;
  jobTitle?: string;
}

export interface Asset {
  id: string | number;
  assetId?: string | number;
  asset_number: string;
  assetNumber?: string;
  computer_id?: string | number | null;
  computerId?: string | number | null;
  serial_number: string;
  serialNumber?: string;
  source: AssetSource;
  manufacturer: string;
  model: string;
  os_name: string;
  osName?: string;
  mac_address: string;
  macAddress?: string;
  macaddress?: string;
  device_type: DeviceType | string;
  deviceType?: DeviceType | string;
  devicetype?: string;
  managed_by: string;
  managedBy?: string;
  assigned_username: string | null;
  assignedUsername?: string | null;
  last_report_time: string;
  lastDiscoveryDate?: string;
  lastreporttime?: string;
  asset_status: AssetStatus;
  assetStatus?: AssetStatus | string;
  assignment_type: AssignmentType;
  assignmentType?: AssignmentType | string;
  // Calculated or returned from runtime API
  eol_date: string | null;
  eolDate?: string | null;
  eol_status?: EOLStatus;
  calculated_eol_status: EOLStatus;
  eolStatus?: EOLStatus;
  days_remaining: number | null;
  daysRemaining?: number | null;
  hostname?: string | null;
  // Extended matching metadata
  verified_employee_id?: string | null;
  verifiedEmployeeId?: string | null;
  verified_employee_name?: string | null;
  verifiedEmployeeName?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  email_work?: string | null;
  work_email?: string | null;
  workEmail?: string | null;
  division?: string | null;
  job_title?: string | null;
  jobTitle?: string | null;
  manager_user_name?: string | null;
  manager_username?: string | null;
  managerUsername?: string | null;
  manager_name?: string | null;
  managerName?: string | null;
  reporting_evp?: string | ReportingEvp | null;
  reportingEvp?: string | ReportingEvp | null;
  reporting_evp_job_title?: string | null;
  reportingEvpJobTitle?: string | null;
  employee_status?: EmployeeStatus | string | null;
  employeeStatus?: EmployeeStatus | string | null;
  workday_status?: WorkdayMatchStatus;
  workdayStatus?: WorkdayMatchStatus;
  employee?: Partial<Employee> | null;
  workday_employee?: Partial<Employee> | null;
  workdayEmployee?: Partial<Employee> | null;
  matched_employee?: Partial<Employee> | null;
  matchedEmployee?: Partial<Employee> | null;
  department?: string;
  ip_address?: string;
  cpu?: string;
  ram_gb?: number;
  storage_gb?: number;
  notes?: string;
  remarks?: string;
  category?: string;
}

export interface Employee {
  id: string | number;
  employee_id: string;
  user_id: string;
  full_name: string;
  work_email: string;
  department: string;
  division: string;
  job_title: string;
  employee_status: EmployeeStatus;
  manager_username: string | null;
  manager_user_name?: string | null;
  managerUsername?: string | null;
  manager_name: string | null;
  managerName?: string | null;
  reporting_evp?: string | ReportingEvp | null;
  reportingEvp?: string | ReportingEvp | null;
  reporting_evp_job_title?: string | null;
  reportingEvpJobTitle?: string | null;
  location: string;
  hire_date: string;
  assigned_assets_count?: number;
  assigned_assets?: Asset[];
}

export interface DashboardSummary {
  total_assets: number;
  active_assets: number;
  review?: number;
  need_validation: number;
  in_stock: number;
  bigfix_assets: number;
  jamf_assets: number;
  automatically_assigned: number;
  manually_assigned: number;
  unassigned_assets: number;
  employee_count: number;
}

export interface AssetsBySourceItem {
  source: string;
  count: number;
  percentage: number;
}

export interface OwnershipSummaryItem {
  assignment_type: string;
  count: number;
  percentage: number;
}

export interface EOLSummaryItem {
  eol_status: string;
  count: number;
  percentage: number;
}

export interface OperationalStatusItem {
  status: string;
  count: number;
  percentage: number;
}

export interface DepartmentDistributionItem {
  department: string;
  count: number;
  asset_count: number;
  percentage: number;
}

export interface DashboardHardwareAnalysisItem {
  name: string;
  count: number;
  percentage?: number;
}

export interface DashboardHardwareAnalysis {
  by_operating_system: DashboardHardwareAnalysisItem[];
  by_device_type: DashboardHardwareAnalysisItem[];
  by_category?: DashboardHardwareAnalysisItem[];
  total_category_assets?: number;
}

export interface CategoryAnalysisItem {
  name?: string;
  category?: string;
  count?: number;
  total?: number;
  percentage?: number;
  percent?: number;
  color?: string;
}

export interface HardwareAnalysisResponse {
  // Operating System
  byOs?: Record<string, number | null | undefined> | { name?: string; os?: string; count?: number; percentage?: number }[];
  by_os?: Record<string, number | null | undefined> | { name?: string; os?: string; count?: number; percentage?: number }[];
  byOperatingSystem?: Record<string, number | null | undefined> | { name?: string; os?: string; count?: number; percentage?: number }[];
  by_operating_system?: Record<string, number | null | undefined> | { name?: string; os?: string; count?: number; percentage?: number }[];
  totalOsAssets?: number;
  total_os_assets?: number;
  totalOperatingSystemAssets?: number;
  total_operating_system_assets?: number;

  // Device Type
  byDevice?: Record<string, number | null | undefined> | { name?: string; device_type?: string; devicetype?: string; type?: string; count?: number; percentage?: number }[];
  by_device?: Record<string, number | null | undefined> | { name?: string; device_type?: string; devicetype?: string; type?: string; count?: number; percentage?: number }[];
  byDeviceType?: Record<string, number | null | undefined> | { name?: string; device_type?: string; devicetype?: string; type?: string; count?: number; percentage?: number }[];
  by_device_type?: Record<string, number | null | undefined> | { name?: string; device_type?: string; devicetype?: string; type?: string; count?: number; percentage?: number }[];
  totalDeviceAssets?: number;
  total_device_assets?: number;
  totalDeviceTypeAssets?: number;
  total_device_type_assets?: number;

  // Category
  byCategory?: Record<string, number | null | undefined> | CategoryAnalysisItem[];
  by_category?: Record<string, number | null | undefined> | CategoryAnalysisItem[];
  totalCategoryAssets?: number;
  total_category_assets?: number;

  // Total
  totalAssets?: number;
  total_assets?: number;
  total?: number;

  // Deprecated fields kept for backward compatibility if referenced elsewhere
  byDeviceTypeAndCategory?: Record<string, number | null | undefined> | { name: string; count: number }[];
  by_device_type_and_category?: Record<string, number | null | undefined> | { name: string; count: number }[];
  byDeviceCategory?: Record<string, number | null | undefined> | { name: string; count: number }[];
  by_device_category?: Record<string, number | null | undefined> | { name: string; count: number }[];
}

export interface DashboardRedesignOverview {
  kpis: { total_assets: number; active_assets: number; review: number; in_stock: number; employee_count: number };
  assets_by_source: { source: string; count: number }[];
  eol_distribution: { status: string; count: number }[];
  eol_exposure: { model: string; eol_status: string; days_remaining: number | null; count: number }[];
  assets_by_department: { department: string; count: number }[];
  source_summary: {
    source: string; total: number; active: number; review: number; in_stock: number; retired: number;
    auto: number; manual: number; unassigned: number; eol_active: number; eol_soon: number;
    eol_expired: number; eol_unknown: number; active_share: number;
  }[];
  hardware_analysis?: DashboardHardwareAnalysis;
  by_operating_system?: DashboardHardwareAnalysisItem[];
  by_device_type?: DashboardHardwareAnalysisItem[];
  by_device_type_and_category?: DashboardHardwareAnalysisItem[] | Record<string, number>;
  byDeviceTypeAndCategory?: DashboardHardwareAnalysisItem[] | Record<string, number>;
  by_category?: DashboardHardwareAnalysisItem[] | Record<string, number>;
  byCategory?: DashboardHardwareAnalysisItem[] | Record<string, number>;
  total_category_assets?: number;
  totalCategoryAssets?: number;
  total_os_assets?: number;
  totalOsAssets?: number;
  total_device_assets?: number;
  totalDeviceAssets?: number;
}

export interface FilterOptions {
  sources: string[];
  device_types: string[];
  asset_statuses: string[];
  manufacturers: string[];
  models: string[];
  assignment_types: string[];
  departments: string[];
  divisions: string[];
  employee_statuses: string[];
  eol_statuses: string[];
}

export interface FleetKpiMetrics {
  totalAssets: number;
  total?: number;
  total_assets?: number;
  active: number;
  active_assets?: number;
  review?: number;
  needValidation?: number;
  need_validation?: number;
  inStock: number;
  in_stock?: number;
  eolSoon?: number;
  nearingEol?: number;
  nearing_eol?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary?: FleetKpiMetrics;
}

export interface HealthResponse {
  status: string;
  version?: string;
  timestamp?: string;
  last_sync?: string;
  bigfix_status?: string;
  jamf_status?: string;
  workday_status?: string;
  eol_warning_threshold_days?: number;
}

export interface AssetQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  source?: string;
  devicetype?: string;
  device_type?: string;
  asset_status?: string;
  manufacturer?: string;
  model?: string;
  assignment_type?: string;
  eol_status?: string;
  department?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export type AssetExportParams = Omit<AssetQueryParams, 'page' | 'page_size'>;

export interface AssetExportResponse {
  blob: Blob;
  filename?: string;
  count?: number;
}

export interface EmployeeQueryParams {
  page?: number;
  page_size?: number;
  size?: number;
  search?: string;
  q?: string;
  department?: string;
  division?: string;
  employee_status?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// PostgreSQL admin_users schema & API interfaces
export interface AdminUserRecord {
  admin_id: number;
  admin_user_id: string;
  created_at: string;
  updated_at?: string | null;
}

export interface AdminUser {
  admin_id: number;
  admin_user_id: string;
  created_at: string;
  updated_at?: string | null;
  full_name?: string | null;
  email_work?: string | null;
  department?: string | null;
  division?: string | null;
  job_title?: string | null;
  employee_status?: EmployeeStatus | string | null;
}

export interface AvailableWorkdayUser {
  user_id: string;
  full_name: string;
  email_work: string;
  department: string;
  division?: string;
  job_title?: string;
  employee_status: EmployeeStatus | string;
  is_admin: boolean;
}

export interface AvailableWorkdayUsersQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export interface PaginatedAvailableUsersResponse {
  items: AvailableWorkdayUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface BulkAddAdminUsersRequest {
  user_ids: string[];
}

export interface BulkAddAdminUsersResponse {
  added_count: number;
  added_user_ids: string[];
  skipped_user_ids: string[];
  message: string;
}

export interface ReassignAssetRequest {
  user_id: string;
  managed_by: 'INDIVIDUAL' | 'GROUP' | string;
  remarks?: string;
  assigned_username?: string;
  assignment_type?: 'MANUAL' | 'AUTOMATIC' | string;
  asset_status?: StandardAssetStatus | string;
}

export interface ReassignAssetResponse {
  asset_id: string | number;
  assigned_username: string;
  managed_by: string;
  assignment_type: string;
  verified_employee_name?: string | null;
  notes?: string;
  updated_at?: string;
  message: string;
}

export interface BulkAssignAssetFilters {
  search?: string;
  source?: string;
  devicetype?: string;
  device_type?: string;
  asset_status?: string;
  manufacturer?: string;
  model?: string;
  assignment_type?: string;
  eol_status?: string;
}

export interface BulkAssignAssetsRequest {
  asset_ids?: (string | number)[];
  user_id: string;
  managed_by: 'INDIVIDUAL' | 'GROUP' | string;
  remarks?: string | null;
  assigned_username?: string;
  assignment_type?: 'MANUAL' | 'AUTOMATIC' | string;
  asset_status?: StandardAssetStatus | string;
  select_all_matching?: boolean;
  all_matching?: boolean;
  matching_count?: number;
  filters?: BulkAssignAssetFilters;
  search?: string;
  source?: string;
  devicetype?: string;
  device_type?: string;
  asset_status_filter?: string;
  manufacturer?: string;
  model?: string;
  assignment_type_filter?: string;
  eol_status?: string;
}

export interface BulkAssignAssetsResponse {
  assigned_count: number;
  successful_asset_ids: (string | number)[];
  failed_asset_ids: (string | number)[];
  total_processed?: number;
  failed_count?: number;
  failures?: { asset_id: string | number; reason?: string }[];
  message: string;
  success?: boolean;
  status?: 'success' | 'partial' | 'failure' | string;
}

// ==========================================
// AssetIQ Portal User Management & Auth Types
// ==========================================
export type PortalRole = 'SUPERADMIN' | 'ADMIN' | 'VIEWER';
export type PortalUserStatus = 'ACTIVE' | 'INACTIVE';

export interface AppUser {
  id: string | number;
  user_id?: string;
  username: string;
  full_name: string;
  email: string;
  role: PortalRole;
  status: PortalUserStatus;
  created_at: string;
  updated_at?: string | null;
  last_login_at?: string | null;
  last_login?: string | null;
  must_reset_password?: boolean;
  is_active?: boolean;
  avatarUrl?: string;
}

export interface AppUsersQueryParams {
  search?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedAppUsersResponse {
  items: AppUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateAppUserPayload {
  username: string;
  full_name: string;
  email: string;
  role: PortalRole;
}

export interface UpdateAppUserPayload {
  username?: string;
  full_name?: string;
  email?: string;
  role?: PortalRole;
  status?: PortalUserStatus;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  access_token?: string;
  token_type?: string;
  must_reset_password?: boolean;
  user?: AppUser;
  username?: string;
  full_name?: string;
  name?: string;
  email?: string;
  role?: PortalRole | string;
  status?: string;
  last_login_at?: string | null;
  last_login?: string | null;
  message?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password?: string;
  old_password?: string;
}

// ==========================================
// AssetIQ Audit Logs
// ==========================================

export type AuditCategory =
  | 'ASSET_OWNERSHIP'
  | 'EOL_MANAGEMENT'
  | 'ADMIN_USERS'
  | 'USER_MANAGEMENT'
  | string;

export type AuditStatus = 'SUCCESS' | 'FAILURE' | string;

export interface AuditActor {
  id?: string | number;
  username: string;
  full_name?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface AuditLogItem {
  id: string | number;
  audit_id?: string | number;
  asset_tag?: string | null;
  asset_number?: string | null;
  actor?: AuditActor;
  actor_name?: string | null;
  actor_full_name?: string | null;
  actor_username?: string | null;
  actor_role?: string | null;
  portal_user?: string | null;
  portal_user_name?: string | null;
  portal_user_full_name?: string | null;
  portal_username?: string | null;
  username?: string | null;
  category: AuditCategory;
  action: string;
  audit_finding: string;
  finding?: string;
  description?: string;
  detected_at: string;
  timestamp?: string;
  created_at?: string;
  status: AuditStatus;
  entity_type?: string | null;
  entity_id?: string | number | null;
  entity_name?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface AuditSummaryData {
  total?: number;
  total_events?: number;
  asset_ownership?: number;
  eol_management?: number;
  admin_users?: number;
  user_management?: number;
  user_administration?: number;
  category_counts?: Record<string, number>;
}

export interface AuditLogsQueryParams {
  search?: string;
  category?: string;
  action?: string;
  portal_user?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
  limit?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedAuditLogsResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary?: AuditSummaryData;
}

