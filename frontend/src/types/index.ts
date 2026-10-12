export type AssetSource = 'BIGFIX' | 'JAMF';
export type DeviceType = 'Desktop' | 'Laptop' | 'Server';
export type AssetStatus = 'Active' | 'Need Validation' | 'In Stock' | 'Retired';
export type AssignmentType = 'Automatic' | 'Manual' | 'Unassigned';
export type EOLStatus = 'Active' | 'Nearing EOL' | 'Expired' | 'Unknown';
export type EmployeeStatus = 'Active' | 'Terminated' | 'On Leave';
export type WorkdayMatchStatus = 'Matched' | 'Not Found in Workday' | 'Admin Account' | 'Unassigned';

export type EOLManufacturer = 'DELL' | 'HP' | 'Lenovo' | 'Apple';

export interface DeviceEOLReference {
  eol_id: number;
  manufacturer: 'DELL' | 'HP' | 'Lenovo' | 'Apple';
  model: string;
  eol_date: string; // ISO date string (YYYY-MM-DD)
  reference_source?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeviceEOLReferenceCreate {
  manufacturer: 'DELL' | 'HP' | 'Lenovo' | 'Apple';
  model: string;
  eol_date: string;
}

export interface DeviceEOLReferenceUpdate {
  manufacturer: 'DELL' | 'HP' | 'Lenovo' | 'Apple';
  model: string;
  eol_date: string;
}

export interface Asset {
  id: string | number;
  assetId?: string | number;
  asset_number: string;
  assetNumber?: string;
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
  manager_name: string | null;
  location: string;
  hire_date: string;
  assigned_assets_count?: number;
  assigned_assets?: Asset[];
}

export interface DashboardSummary {
  total_assets: number;
  active_assets: number;
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
  percentage: number;
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
  needValidation: number;
  need_validation?: number;
  inStock: number;
  in_stock?: number;
  nearingEol: number;
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

export interface EmployeeQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
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
  managed_by: 'INDIVIDUAL' | 'GROUP';
  remarks?: string;
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

