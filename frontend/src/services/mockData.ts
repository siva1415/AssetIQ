import {
  Asset,
  Employee,
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
  AdminUserRecord,
  AvailableWorkdayUser,
  BulkAddAdminUsersResponse,
  ReassignAssetRequest,
  ReassignAssetResponse,
  ASSET_STATUSES,
  toStandardAssetStatus,
  toStandardEOLStatus,
} from '../types';

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 1,
    employee_id: 'EMP-1001',
    user_id: 'jchen',
    full_name: 'Jessica Chen',
    work_email: 'jessica.chen@enterprise.corp',
    department: 'Engineering',
    division: 'Platform Infrastructure',
    job_title: 'Staff Cloud Architect',
    employee_status: 'Active',
    manager_username: 'mthorne',
    manager_name: 'Marcus Thorne',
    location: 'San Francisco, CA',
    hire_date: '2021-03-15',
  },
  {
    id: 2,
    employee_id: 'EMP-1002',
    user_id: 'mthorne',
    full_name: 'Marcus Thorne',
    work_email: 'marcus.thorne@enterprise.corp',
    department: 'Engineering',
    division: 'Platform Infrastructure',
    job_title: 'VP of Engineering',
    employee_status: 'Active',
    manager_username: 'evance',
    manager_name: 'Elena Vance',
    location: 'San Francisco, CA',
    hire_date: '2019-08-01',
  },
  {
    id: 3,
    employee_id: 'EMP-1003',
    user_id: 'dpatel',
    full_name: 'Devan Patel',
    work_email: 'devan.patel@enterprise.corp',
    department: 'Finance',
    division: 'Corporate FP&A',
    job_title: 'Senior Financial Analyst',
    employee_status: 'Active',
    manager_username: 'sarahw',
    manager_name: 'Sarah Washington',
    location: 'New York, NY',
    hire_date: '2022-01-10',
  },
  {
    id: 4,
    employee_id: 'EMP-1004',
    user_id: 'sarahw',
    full_name: 'Sarah Washington',
    work_email: 'sarah.washington@enterprise.corp',
    department: 'Finance',
    division: 'Corporate FP&A',
    job_title: 'Director of Global Finance',
    employee_status: 'Active',
    manager_username: 'evance',
    manager_name: 'Elena Vance',
    location: 'New York, NY',
    hire_date: '2018-06-22',
  },
  {
    id: 5,
    employee_id: 'EMP-1005',
    user_id: 'arobinson',
    full_name: 'Alex Robinson',
    work_email: 'alex.robinson@enterprise.corp',
    department: 'Security & Compliance',
    division: 'Information Security',
    job_title: 'Lead SecOps Engineer',
    employee_status: 'Active',
    manager_username: 'mthorne',
    manager_name: 'Marcus Thorne',
    location: 'Austin, TX',
    hire_date: '2020-11-04',
  },
  {
    id: 6,
    employee_id: 'EMP-1006',
    user_id: 'lhernandez',
    full_name: 'Lucia Hernandez',
    work_email: 'lucia.hernandez@enterprise.corp',
    department: 'Marketing',
    division: 'Brand & Growth',
    job_title: 'Product Marketing Lead',
    employee_status: 'Active',
    manager_username: 'kgrant',
    manager_name: 'Keith Grant',
    location: 'Chicago, IL',
    hire_date: '2022-05-18',
  },
  {
    id: 7,
    employee_id: 'EMP-1007',
    user_id: 'kgrant',
    full_name: 'Keith Grant',
    work_email: 'keith.grant@enterprise.corp',
    department: 'Marketing',
    division: 'Brand & Growth',
    job_title: 'VP of Marketing',
    employee_status: 'Active',
    manager_username: 'evance',
    manager_name: 'Elena Vance',
    location: 'Chicago, IL',
    hire_date: '2019-02-14',
  },
  {
    id: 8,
    employee_id: 'EMP-1008',
    user_id: 'bkim',
    full_name: 'Brian Kim',
    work_email: 'brian.kim@enterprise.corp',
    department: 'Sales',
    division: 'Enterprise Accounts',
    job_title: 'Strategic Account Executive',
    employee_status: 'Active',
    manager_username: 'tcollins',
    manager_name: 'Tara Collins',
    location: 'Seattle, WA',
    hire_date: '2023-04-03',
  },
  {
    id: 9,
    employee_id: 'EMP-1009',
    user_id: 'tcollins',
    full_name: 'Tara Collins',
    work_email: 'tara.collins@enterprise.corp',
    department: 'Sales',
    division: 'Enterprise Accounts',
    job_title: 'VP of Global Enterprise Sales',
    employee_status: 'Active',
    manager_username: 'evance',
    manager_name: 'Elena Vance',
    location: 'Seattle, WA',
    hire_date: '2017-09-15',
  },
  {
    id: 10,
    employee_id: 'EMP-1010',
    user_id: 'rnakamura',
    full_name: 'Rei Nakamura',
    work_email: 'rei.nakamura@enterprise.corp',
    department: 'Product',
    division: 'Product Experience',
    job_title: 'Principal UX Designer',
    employee_status: 'Active',
    manager_username: 'mthorne',
    manager_name: 'Marcus Thorne',
    location: 'San Francisco, CA',
    hire_date: '2021-08-30',
  },
  {
    id: 11,
    employee_id: 'EMP-1011',
    user_id: 'owilson',
    full_name: 'Oliver Wilson',
    work_email: 'oliver.wilson@enterprise.corp',
    department: 'Human Resources',
    division: 'People Operations',
    job_title: 'Senior People Partner',
    employee_status: 'Active',
    manager_username: 'evance',
    manager_name: 'Elena Vance',
    location: 'Austin, TX',
    hire_date: '2022-09-12',
  },
  {
    id: 12,
    employee_id: 'EMP-1012',
    user_id: 'rrossi',
    full_name: 'Roberto Rossi',
    work_email: 'roberto.rossi@enterprise.corp',
    department: 'Engineering',
    division: 'Core Systems',
    job_title: 'Senior Systems Engineer',
    employee_status: 'Terminated',
    manager_username: 'mthorne',
    manager_name: 'Marcus Thorne',
    location: 'Boston, MA',
    hire_date: '2020-02-17',
  },
  {
    id: 13,
    employee_id: 'EMP-1013',
    user_id: 'amartin',
    full_name: 'Aisha Martin',
    work_email: 'aisha.martin@enterprise.corp',
    department: 'Engineering',
    division: 'Data Analytics',
    job_title: 'Senior Data Scientist',
    employee_status: 'On Leave',
    manager_username: 'mthorne',
    manager_name: 'Marcus Thorne',
    location: 'San Francisco, CA',
    hire_date: '2022-07-05',
  },
  {
    id: 14,
    employee_id: 'EMP-1014',
    user_id: 'evance',
    full_name: 'Elena Vance',
    work_email: 'elena.vance@enterprise.corp',
    department: 'Executive',
    division: 'Executive Office',
    job_title: 'Chief Operating Officer',
    employee_status: 'Active',
    manager_username: null,
    manager_name: null,
    location: 'San Francisco, CA',
    hire_date: '2016-01-15',
  },
];

export let MOCK_DEVICE_EOL_REFERENCES: DeviceEOLReference[] = [
  {
    eol_id: 1,
    manufacturer: 'Apple',
    model: 'MacBook Pro 16" M2 Pro',
    eol_date: '2028-06-30',
    reference_source: 'Apple Support Lifecycle & Vintage List',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 2,
    manufacturer: 'DELL',
    model: 'Precision 7680 Workstation',
    eol_date: '2028-01-15',
    reference_source: 'Dell ProSupport Hardware Roadmap',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 3,
    manufacturer: 'Lenovo',
    model: 'ThinkPad T14s Gen 4',
    eol_date: '2027-11-20',
    reference_source: 'Lenovo Premier Support Catalog',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 4,
    manufacturer: 'Apple',
    model: 'MacBook Air 15" M2',
    eol_date: '2028-03-31',
    reference_source: 'Apple Support Lifecycle & Vintage List',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 5,
    manufacturer: 'Apple',
    model: 'Mac Studio M2 Max',
    eol_date: '2028-09-30',
    reference_source: 'Apple Support Lifecycle & Vintage List',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 6,
    manufacturer: 'DELL',
    model: 'PowerEdge R750',
    eol_date: '2027-04-15',
    reference_source: 'Dell Enterprise Server Support Matrix',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 7,
    manufacturer: 'DELL',
    model: 'PowerEdge R640',
    eol_date: '2026-11-15',
    reference_source: 'Dell Enterprise Server Support Matrix',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 8,
    manufacturer: 'Lenovo',
    model: 'ThinkPad X1 Carbon Gen 8',
    eol_date: '2025-10-14',
    reference_source: 'Lenovo End-of-Life Official Bulletin',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 9,
    manufacturer: 'DELL',
    model: 'OptiPlex 7090 Micro',
    eol_date: '2027-08-30',
    reference_source: 'Dell Client Hardware Support',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 10,
    manufacturer: 'Apple',
    model: 'MacBook Pro 14" M1 Pro',
    eol_date: '2026-12-01',
    reference_source: 'Apple Support Lifecycle & Vintage List',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 11,
    manufacturer: 'HP',
    model: 'EliteBook 840 G8',
    eol_date: '2026-10-25',
    reference_source: 'HP Care Pack Support Lifecycle Guide',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 12,
    manufacturer: 'Lenovo',
    model: 'ThinkPad P1 Gen 6',
    eol_date: '2028-11-15',
    reference_source: 'Lenovo Premier Support Catalog',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 13,
    manufacturer: 'Apple',
    model: 'MacBook Pro 16" M3 Max',
    eol_date: '2029-03-31',
    reference_source: 'Apple Support Lifecycle & Vintage List',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 14,
    manufacturer: 'Apple',
    model: 'MacBook Air 13" M1',
    eol_date: '2025-11-30',
    reference_source: 'Apple Support Lifecycle & Vintage List',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 15,
    manufacturer: 'Lenovo',
    model: 'ThinkPad X1 Yoga Gen 7',
    eol_date: '2028-02-28',
    reference_source: 'Lenovo Premier Support Catalog',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 16,
    manufacturer: 'DELL',
    model: 'Latitude 7440',
    eol_date: '2028-05-15',
    reference_source: 'Dell ProSupport Plus Catalog',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 17,
    manufacturer: 'Apple',
    model: 'MacBook Pro 14" M3 Pro',
    eol_date: '2029-01-31',
    reference_source: 'Apple Support Lifecycle & Vintage List',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 18,
    manufacturer: 'Lenovo',
    model: 'ThinkStation P620',
    eol_date: '2028-07-20',
    reference_source: 'Lenovo Workstation Hardware Lifecycle',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 19,
    manufacturer: 'Apple',
    model: 'MacBook Pro 13" M2',
    eol_date: '2028-04-15',
    reference_source: 'Apple Support Lifecycle & Vintage List',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    eol_id: 20,
    manufacturer: 'HP',
    model: 'ZBook Fury 16 G10',
    eol_date: '2028-10-01',
    reference_source: 'HP Enterprise Workstation Matrix',
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
];

// Helper to recalculate runtime asset EOL statuses after EOL reference table updates
export function recalculateAssetEOLFromReferences(): void {
  const refMap = new Map<string, string>();
  for (const ref of MOCK_DEVICE_EOL_REFERENCES) {
    const key = `${ref.manufacturer.toLowerCase()}::${ref.model.toLowerCase().trim()}`;
    refMap.set(key, ref.eol_date);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const asset of MOCK_ASSETS) {
    // Standardize mfr lookup: 'Apple Inc.' -> 'apple', 'Dell Inc.' -> 'dell', 'HP Inc.' -> 'hp', 'Lenovo' -> 'lenovo'
    let normMfr = asset.manufacturer.toLowerCase();
    if (normMfr.includes('apple')) normMfr = 'apple';
    else if (normMfr.includes('dell')) normMfr = 'dell';
    else if (normMfr.includes('hp')) normMfr = 'hp';
    else if (normMfr.includes('lenovo')) normMfr = 'lenovo';

    const key = `${normMfr}::${asset.model.toLowerCase().trim()}`;
    const matchedEolDate = refMap.get(key);

    if (matchedEolDate) {
      asset.eol_date = matchedEolDate;
      const targetDate = new Date(matchedEolDate);
      targetDate.setHours(0, 0, 0, 0);
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      asset.days_remaining = diffDays;

      if (diffDays < 0) {
        asset.calculated_eol_status = 'EXPIRED';
        asset.eol_status = 'EXPIRED';
      } else if (diffDays <= 90) {
        asset.calculated_eol_status = 'EOL SOON';
        asset.eol_status = 'EOL SOON';
      } else {
        asset.calculated_eol_status = 'ACTIVE';
        asset.eol_status = 'ACTIVE';
      }
    } else {
      asset.eol_date = null;
      asset.days_remaining = null;
      asset.calculated_eol_status = 'UNKNOWN';
      asset.eol_status = 'UNKNOWN';
    }
  }
}

export function getMockEOLReferences(search?: string): DeviceEOLReference[] {
  let list = [...MOCK_DEVICE_EOL_REFERENCES];
  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    list = list.filter(
      r => r.manufacturer.toLowerCase().includes(q) || r.model.toLowerCase().includes(q)
    );
  }
  // Default sort by manufacturer, then model
  list.sort((a, b) => {
    const mComp = a.manufacturer.localeCompare(b.manufacturer);
    if (mComp !== 0) return mComp;
    return a.model.localeCompare(b.model);
  });
  return list;
}

export function createMockEOLReference(data: DeviceEOLReferenceCreate): DeviceEOLReference {
  const normMfr = data.manufacturer;
  const normModel = data.model.trim();

  // Check unique constraint on (manufacturer, model)
  const existing = MOCK_DEVICE_EOL_REFERENCES.find(
    r => r.manufacturer.toLowerCase() === normMfr.toLowerCase() && r.model.toLowerCase() === normModel.toLowerCase()
  );
  if (existing) {
    throw new Error(`A reference record already exists for ${normMfr} - ${normModel}. Duplicate model combination is not allowed.`);
  }

  const maxId = MOCK_DEVICE_EOL_REFERENCES.reduce((max, r) => Math.max(max, r.eol_id), 0);
  const newRecord: DeviceEOLReference = {
    eol_id: maxId + 1,
    manufacturer: normMfr,
    model: normModel,
    eol_date: data.eol_date,
    reference_source: 'Manual Administrator Entry',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  MOCK_DEVICE_EOL_REFERENCES.push(newRecord);
  recalculateAssetEOLFromReferences();
  return newRecord;
}

export function updateMockEOLReference(eolId: number, data: DeviceEOLReferenceUpdate): DeviceEOLReference {
  const idx = MOCK_DEVICE_EOL_REFERENCES.findIndex(r => r.eol_id === eolId);
  if (idx === -1) {
    throw new Error(`Device EOL Reference record with ID ${eolId} was not found.`);
  }

  const normMfr = data.manufacturer;
  const normModel = data.model.trim();

  // Check uniqueness with other records
  const duplicate = MOCK_DEVICE_EOL_REFERENCES.find(
    r => r.eol_id !== eolId &&
      r.manufacturer.toLowerCase() === normMfr.toLowerCase() &&
      r.model.toLowerCase() === normModel.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`Another reference record already exists for ${normMfr} - ${normModel}. Duplicate model combination is not allowed.`);
  }

  const current = MOCK_DEVICE_EOL_REFERENCES[idx];
  const updatedRecord: DeviceEOLReference = {
    ...current,
    manufacturer: normMfr,
    model: normModel,
    eol_date: data.eol_date,
    updated_at: new Date().toISOString(),
  };

  MOCK_DEVICE_EOL_REFERENCES[idx] = updatedRecord;
  recalculateAssetEOLFromReferences();
  return updatedRecord;
}

export function deleteMockEOLReference(eolId: number): void {
  const idx = MOCK_DEVICE_EOL_REFERENCES.findIndex(r => r.eol_id === eolId);
  if (idx === -1) {
    throw new Error(`Device EOL Reference record with ID ${eolId} was not found.`);
  }

  MOCK_DEVICE_EOL_REFERENCES.splice(idx, 1);
  recalculateAssetEOLFromReferences();
}

// PostgreSQL admin_users table storage representation:
// admin_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
// admin_user_id VARCHAR(100) NOT NULL UNIQUE
// created_at TIMESTAMPTZ DEFAULT NOW()
// updated_at TIMESTAMPTZ
export const MOCK_ADMIN_USERS_TABLE: AdminUserRecord[] = [
  {
    admin_id: 1,
    admin_user_id: 'arobinson',
    created_at: '2026-09-15T08:30:00Z',
    updated_at: null,
  },
  {
    admin_id: 2,
    admin_user_id: 'mthorne',
    created_at: '2026-09-20T10:15:00Z',
    updated_at: null,
  },
  {
    admin_id: 3,
    admin_user_id: 'jchen',
    created_at: '2026-10-01T14:45:00Z',
    updated_at: null,
  },
];

export function getMockAdminUsers(search?: string): AdminUser[] {
  // Join admin_users with workday_employees: admin_users.admin_user_id = workday_employees.user_id
  let results: AdminUser[] = MOCK_ADMIN_USERS_TABLE.map(admin => {
    const emp = MOCK_EMPLOYEES.find(
      e => e.user_id.toLowerCase() === admin.admin_user_id.toLowerCase()
    );
    return {
      admin_id: admin.admin_id,
      admin_user_id: admin.admin_user_id,
      created_at: admin.created_at,
      updated_at: admin.updated_at,
      full_name: emp ? emp.full_name : null,
      email_work: emp ? emp.work_email : null,
      department: emp ? emp.department : null,
      division: emp ? emp.division : null,
      job_title: emp ? emp.job_title : null,
      employee_status: emp ? emp.employee_status : null,
    };
  });

  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    results = results.filter(
      u =>
        u.admin_user_id.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email_work && u.email_work.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
    );
  }

  // Sort by most recently added by default (created_at descending)
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return results;
}

export function getMockAvailableWorkdayUsers(search?: string): AvailableWorkdayUser[] {
  let list: AvailableWorkdayUser[] = MOCK_EMPLOYEES.map(emp => {
    const isAdmin = MOCK_ADMIN_USERS_TABLE.some(
      a => a.admin_user_id.toLowerCase() === emp.user_id.toLowerCase()
    );
    return {
      user_id: emp.user_id,
      full_name: emp.full_name,
      email_work: emp.work_email,
      department: emp.department,
      division: emp.division,
      job_title: emp.job_title,
      employee_status: emp.employee_status,
      is_admin: isAdmin,
    };
  });

  // Backend filters out users already listed as admins
  list = list.filter(u => !u.is_admin);

  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    list = list.filter(
      u =>
        u.user_id.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.email_work.toLowerCase().includes(q)
    );
  }

  // Sort alphabetically by full name
  list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return list;
}

export function bulkAddMockAdminUsers(userIds: string[]): BulkAddAdminUsersResponse {
  const added: string[] = [];
  const skipped: string[] = [];

  for (const uid of userIds) {
    const trimmed = uid.trim();
    if (!trimmed) continue;

    // Validate that user exists in workday_employees
    const employeeExists = MOCK_EMPLOYEES.some(
      e => e.user_id.toLowerCase() === trimmed.toLowerCase()
    );
    if (!employeeExists) {
      skipped.push(trimmed);
      continue;
    }

    // Check duplicate in admin_users
    const alreadyAdmin = MOCK_ADMIN_USERS_TABLE.some(
      a => a.admin_user_id.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyAdmin) {
      skipped.push(trimmed);
      continue;
    }

    const nextId = MOCK_ADMIN_USERS_TABLE.reduce((max, a) => Math.max(max, a.admin_id), 0) + 1;
    MOCK_ADMIN_USERS_TABLE.push({
      admin_id: nextId,
      admin_user_id: trimmed,
      created_at: new Date().toISOString(),
      updated_at: null,
    });
    added.push(trimmed);
  }

  const message = added.length > 0
    ? `Successfully registered ${added.length} administrator user${added.length === 1 ? '' : 's'}.`
    : `No new administrator users were added.`;

  return {
    added_count: added.length,
    added_user_ids: added,
    skipped_user_ids: skipped,
    message,
  };
}

export function deleteMockAdminUser(adminUserId: string): void {
  const idx = MOCK_ADMIN_USERS_TABLE.findIndex(
    a => a.admin_user_id.toLowerCase() === adminUserId.toLowerCase()
  );
  if (idx === -1) {
    throw new Error(`Admin user '${adminUserId}' was not found in admin_users table.`);
  }
  MOCK_ADMIN_USERS_TABLE.splice(idx, 1);
}

export function reassignMockAsset(
  assetId: string | number,
  data: ReassignAssetRequest
): ReassignAssetResponse {
  const normAssetId = String(assetId).trim();
  const asset = MOCK_ASSETS.find(
    a => String(a.id) === normAssetId || a.asset_number === normAssetId
  );
  if (!asset) {
    throw new Error(`Asset '${assetId}' was not found in the database.`);
  }

  // Verify employee exists in workday_employees
  const emp = MOCK_EMPLOYEES.find(
    e => e.user_id.toLowerCase() === data.user_id.toLowerCase().trim()
  );
  if (!emp) {
    throw new Error(`Workday employee with user ID '${data.user_id}' was not found.`);
  }

  // Validate managed_by
  const normManagedBy = data.managed_by?.trim().toUpperCase();
  if (normManagedBy !== 'INDIVIDUAL' && normManagedBy !== 'GROUP') {
    throw new Error(`Invalid managed_by value '${data.managed_by}'. Must be 'INDIVIDUAL' or 'GROUP'.`);
  }

  // Update existing asset record
  asset.assigned_username = emp.user_id;
  asset.managed_by = normManagedBy;
  asset.assignment_type = 'Manual';

  // Update verified Workday identity details
  asset.verified_employee_id = emp.employee_id;
  asset.verified_employee_name = emp.full_name;
  asset.full_name = emp.full_name;
  asset.email_work = emp.work_email;
  asset.work_email = emp.work_email;
  asset.department = emp.department;
  asset.division = emp.division;
  asset.job_title = emp.job_title;
  asset.manager_user_name = emp.manager_username;
  asset.manager_username = emp.manager_username;
  asset.manager_name = emp.manager_name;
  asset.employee_status = emp.employee_status;
  asset.workday_status = 'Matched';

  // Manual assignment must update operational asset status to ACTIVE
  asset.asset_status = ASSET_STATUSES.ACTIVE;

  // Persist remarks
  if (data.remarks !== undefined) {
    asset.notes = data.remarks.trim();
    asset.remarks = data.remarks.trim();
  }

  return {
    asset_id: asset.id,
    assigned_username: asset.assigned_username,
    managed_by: asset.managed_by,
    assignment_type: asset.assignment_type,
    verified_employee_name: asset.verified_employee_name,
    notes: asset.notes,
    updated_at: new Date().toISOString(),
    message: `Asset ${asset.asset_number} successfully assigned to ${emp.full_name} (${emp.user_id}).`,
  };
}

export const MOCK_ASSETS: Asset[] = [
  {
    id: 'AST-001',
    asset_number: 'AST-10492',
    serial_number: 'C02G40PZMD6T',
    source: 'JAMF',
    manufacturer: 'Apple Inc.',
    model: 'MacBook Pro 16" M2 Pro',
    os_name: 'macOS Sonoma 14.5',
    mac_address: 'F0:18:98:4B:22:91',
    device_type: 'Laptop',
    managed_by: 'Jamf Pro Cloud',
    assigned_username: 'jchen',
    last_report_time: '2026-10-09T18:42:10Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2028-06-30',
    calculated_eol_status: 'Active',
    days_remaining: 628,
    verified_employee_id: 'EMP-1001',
    verified_employee_name: 'Jessica Chen',
    workday_status: 'Matched',
    department: 'Engineering',
    ip_address: '10.24.112.44',
    cpu: 'Apple M2 Pro (12-Core)',
    ram_gb: 32,
    storage_gb: 1024,
    notes: 'Primary developer workstation.',
  },
  {
    id: 'AST-002',
    asset_number: 'AST-10493',
    serial_number: '5CG2419XYZ',
    source: 'BIGFIX',
    manufacturer: 'Dell Inc.',
    model: 'Precision 7680 Workstation',
    os_name: 'Windows 11 Enterprise 23H2',
    mac_address: '00:50:56:C0:00:08',
    device_type: 'Laptop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'arobinson',
    last_report_time: '2026-10-10T02:15:33Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2028-01-15',
    calculated_eol_status: 'Active',
    days_remaining: 462,
    verified_employee_id: 'EMP-1005',
    verified_employee_name: 'Alex Robinson',
    workday_status: 'Matched',
    department: 'Security & Compliance',
    ip_address: '10.24.114.88',
    cpu: 'Intel Core i9-13950HX',
    ram_gb: 64,
    storage_gb: 2048,
    notes: 'SecOps forensics & packet analysis station.',
  },
  {
    id: 'AST-003',
    asset_number: 'AST-10494',
    serial_number: 'PF3X89AZ',
    source: 'BIGFIX',
    manufacturer: 'Lenovo',
    model: 'ThinkPad T14s Gen 4',
    os_name: 'Windows 11 Enterprise 22H2',
    mac_address: '48:2A:E3:89:D1:45',
    device_type: 'Laptop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'dpatel',
    last_report_time: '2026-10-09T22:11:05Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2027-11-20',
    calculated_eol_status: 'Active',
    days_remaining: 406,
    verified_employee_id: 'EMP-1003',
    verified_employee_name: 'Devan Patel',
    workday_status: 'Matched',
    department: 'Finance',
    ip_address: '10.24.116.12',
    cpu: 'AMD Ryzen 7 PRO 7840U',
    ram_gb: 32,
    storage_gb: 1024,
  },
  {
    id: 'AST-004',
    asset_number: 'AST-10495',
    serial_number: 'C02D1189MD6R',
    source: 'JAMF',
    manufacturer: 'Apple Inc.',
    model: 'MacBook Air 15" M2',
    os_name: 'macOS Sonoma 14.4.1',
    mac_address: 'F0:18:98:90:33:14',
    device_type: 'Laptop',
    managed_by: 'Jamf Pro Cloud',
    assigned_username: 'lhernandez',
    last_report_time: '2026-10-08T15:30:19Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2028-03-31',
    calculated_eol_status: 'Active',
    days_remaining: 538,
    verified_employee_id: 'EMP-1006',
    verified_employee_name: 'Lucia Hernandez',
    workday_status: 'Matched',
    department: 'Marketing',
    ip_address: '10.24.120.94',
    cpu: 'Apple M2 (8-Core)',
    ram_gb: 16,
    storage_gb: 512,
  },
  {
    id: 'AST-005',
    asset_number: 'AST-10496',
    serial_number: 'C02H55PZMD6T',
    source: 'JAMF',
    manufacturer: 'Apple Inc.',
    model: 'Mac Studio M2 Max',
    os_name: 'macOS Sonoma 14.5',
    mac_address: 'A4:83:E7:33:91:02',
    device_type: 'Desktop',
    managed_by: 'Jamf Pro Cloud',
    assigned_username: 'rnakamura',
    last_report_time: '2026-10-10T01:04:12Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Manual',
    eol_date: '2028-09-30',
    calculated_eol_status: 'Active',
    days_remaining: 720,
    verified_employee_id: 'EMP-1010',
    verified_employee_name: 'Rei Nakamura',
    workday_status: 'Matched',
    department: 'Product',
    ip_address: '10.24.112.98',
    cpu: 'Apple M2 Max (12-Core)',
    ram_gb: 64,
    storage_gb: 2048,
    notes: 'Studio desktop for design asset rendering. Manual executive approval.',
  },
  {
    id: 'AST-006',
    asset_number: 'AST-10497',
    serial_number: '7XJ99021B',
    source: 'BIGFIX',
    manufacturer: 'Dell Inc.',
    model: 'PowerEdge R750',
    os_name: 'Red Hat Enterprise Linux 9.2',
    mac_address: '00:1E:67:D8:1A:4C',
    device_type: 'Server',
    managed_by: 'BigFix Datacenter',
    assigned_username: 'admin_svc',
    last_report_time: '2026-10-10T03:30:00Z',
    asset_status: 'REVIEW',
    assignment_type: 'Manual',
    eol_date: '2027-04-15',
    calculated_eol_status: 'Active',
    days_remaining: 187,
    verified_employee_id: null,
    verified_employee_name: null,
    workday_status: 'Admin Account',
    department: 'Engineering',
    ip_address: '172.16.4.110',
    cpu: 'Dual Intel Xeon Gold 6338',
    ram_gb: 256,
    storage_gb: 16384,
    notes: 'Primary database cluster host node 01.',
  },
  {
    id: 'AST-007',
    asset_number: 'AST-10498',
    serial_number: '8YJ99022C',
    source: 'BIGFIX',
    manufacturer: 'Dell Inc.',
    model: 'PowerEdge R640',
    os_name: 'Ubuntu Server 20.04 LTS',
    mac_address: '00:1E:67:D8:1B:5D',
    device_type: 'Server',
    managed_by: 'BigFix Datacenter',
    assigned_username: 'root',
    last_report_time: '2026-10-09T11:22:15Z',
    asset_status: 'REVIEW',
    assignment_type: 'Manual',
    eol_date: '2026-11-15',
    calculated_eol_status: 'EOL Soon',
    days_remaining: 36,
    verified_employee_id: null,
    verified_employee_name: null,
    workday_status: 'Admin Account',
    department: 'Engineering',
    ip_address: '172.16.4.115',
    cpu: 'Dual Intel Xeon Silver 4214',
    ram_gb: 128,
    storage_gb: 8192,
    notes: 'Legacy authentication secondary cache server. EOL upcoming.',
  },
  {
    id: 'AST-008',
    asset_number: 'AST-10499',
    serial_number: 'PF1098XZ',
    source: 'BIGFIX',
    manufacturer: 'Lenovo',
    model: 'ThinkPad X1 Carbon Gen 8',
    os_name: 'Windows 10 Enterprise 21H2',
    mac_address: '3C:52:82:11:AB:09',
    device_type: 'Laptop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'rrossi',
    last_report_time: '2026-08-14T09:12:00Z',
    asset_status: 'REVIEW',
    assignment_type: 'Automatic',
    eol_date: '2025-10-14',
    calculated_eol_status: 'Expired',
    days_remaining: -361,
    verified_employee_id: 'EMP-1012',
    verified_employee_name: 'Roberto Rossi',
    workday_status: 'Matched',
    department: 'Engineering',
    ip_address: '10.24.118.42',
    cpu: 'Intel Core i7-10610U',
    ram_gb: 16,
    storage_gb: 512,
    notes: 'CRITICAL: Assigned employee terminated in Workday. Device not checked in for 55+ days. EOL expired.',
  },
  {
    id: 'AST-009',
    asset_number: 'AST-10500',
    serial_number: 'PF9921KA',
    source: 'BIGFIX',
    manufacturer: 'Dell Inc.',
    model: 'OptiPlex 7090 Micro',
    os_name: 'Windows 11 Enterprise 22H2',
    mac_address: '18:66:DA:55:12:87',
    device_type: 'Desktop',
    managed_by: 'BigFix Corporate',
    assigned_username: null,
    last_report_time: '2026-09-28T14:10:00Z',
    asset_status: 'IN STOCK',
    assignment_type: 'Unassigned',
    eol_date: '2027-08-30',
    calculated_eol_status: 'Active',
    days_remaining: 324,
    verified_employee_id: null,
    verified_employee_name: null,
    workday_status: 'Unassigned',
    department: 'IT Operations',
    ip_address: '10.24.10.105',
    cpu: 'Intel Core i5-11500',
    ram_gb: 16,
    storage_gb: 512,
    notes: 'Warehouse spare desktop pool ready for provisioning.',
  },
  {
    id: 'AST-010',
    asset_number: 'AST-10501',
    serial_number: 'C02FP092MD6S',
    source: 'JAMF',
    manufacturer: 'Apple Inc.',
    model: 'MacBook Pro 14" M1 Pro',
    os_name: 'macOS Ventura 13.6',
    mac_address: 'A0:78:17:88:99:01',
    device_type: 'Laptop',
    managed_by: 'Jamf Pro Cloud',
    assigned_username: null,
    last_report_time: '2026-10-02T16:45:00Z',
    asset_status: 'IN STOCK',
    assignment_type: 'Unassigned',
    eol_date: '2026-12-01',
    calculated_eol_status: 'EOL Soon',
    days_remaining: 52,
    verified_employee_id: null,
    verified_employee_name: null,
    workday_status: 'Unassigned',
    department: 'IT Operations',
    ip_address: '10.24.10.112',
    cpu: 'Apple M1 Pro (8-Core)',
    ram_gb: 16,
    storage_gb: 512,
    notes: 'Returned device during employee re-org. Needs refresh due to approaching EOL.',
  },
  {
    id: 'AST-011',
    asset_number: 'AST-10502',
    serial_number: '5CG9918ABC',
    source: 'BIGFIX',
    manufacturer: 'HP Inc.',
    model: 'EliteBook 840 G8',
    os_name: 'Windows 11 Enterprise 22H2',
    mac_address: '2C:60:0C:44:90:31',
    device_type: 'Laptop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'ext_mkhan',
    last_report_time: '2026-10-09T08:14:22Z',
    asset_status: 'REVIEW',
    assignment_type: 'Automatic',
    eol_date: '2026-10-25',
    calculated_eol_status: 'EOL Soon',
    days_remaining: 15,
    verified_employee_id: null,
    verified_employee_name: null,
    workday_status: 'Not Found in Workday',
    department: 'Contractor Services',
    ip_address: '10.24.122.50',
    cpu: 'Intel Core i5-1145G7',
    ram_gb: 16,
    storage_gb: 512,
    notes: 'Orphan username: ext_mkhan not found in current Workday employee directory.',
  },
  {
    id: 'AST-012',
    asset_number: 'AST-10503',
    serial_number: 'PF8829XX',
    source: 'BIGFIX',
    manufacturer: 'Lenovo',
    model: 'ThinkPad P1 Gen 6',
    os_name: 'Windows 11 Enterprise 23H2',
    mac_address: '64:4E:99:21:40:55',
    device_type: 'Laptop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'bkim',
    last_report_time: '2026-10-10T02:50:11Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2028-11-15',
    calculated_eol_status: 'Active',
    days_remaining: 766,
    verified_employee_id: 'EMP-1008',
    verified_employee_name: 'Brian Kim',
    workday_status: 'Matched',
    department: 'Sales',
    ip_address: '10.24.124.71',
    cpu: 'Intel Core i7-13800H',
    ram_gb: 32,
    storage_gb: 1024,
  },
  {
    id: 'AST-013',
    asset_number: 'AST-10504',
    serial_number: 'C02G2211MD6U',
    source: 'JAMF',
    manufacturer: 'Apple Inc.',
    model: 'MacBook Pro 16" M3 Max',
    os_name: 'macOS Sonoma 14.5',
    mac_address: 'AC:DE:48:00:11:22',
    device_type: 'Laptop',
    managed_by: 'Jamf Pro Cloud',
    assigned_username: 'mthorne',
    last_report_time: '2026-10-09T23:44:19Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2029-03-31',
    calculated_eol_status: 'Active',
    days_remaining: 902,
    verified_employee_id: 'EMP-1002',
    verified_employee_name: 'Marcus Thorne',
    workday_status: 'Matched',
    department: 'Engineering',
    ip_address: '10.24.112.10',
    cpu: 'Apple M3 Max (16-Core)',
    ram_gb: 64,
    storage_gb: 2048,
  },
  {
    id: 'AST-014',
    asset_number: 'AST-10505',
    serial_number: 'C02C3300MD6R',
    source: 'JAMF',
    manufacturer: 'Apple Inc.',
    model: 'MacBook Air 13" M1',
    os_name: 'macOS Monterey 12.7.2',
    mac_address: '7C:D1:C3:90:82:11',
    device_type: 'Laptop',
    managed_by: 'Jamf Pro Cloud',
    assigned_username: 'temp_user_99',
    last_report_time: '2026-09-15T12:00:00Z',
    asset_status: 'REVIEW',
    assignment_type: 'Automatic',
    eol_date: '2025-11-30',
    calculated_eol_status: 'Expired',
    days_remaining: -314,
    verified_employee_id: null,
    verified_employee_name: null,
    workday_status: 'Not Found in Workday',
    department: 'Human Resources',
    ip_address: '10.24.120.15',
    cpu: 'Apple M1 (8-Core)',
    ram_gb: 8,
    storage_gb: 256,
    notes: 'Generic temp username assigned; no Workday record found.',
  },
  {
    id: 'AST-015',
    asset_number: 'AST-10506',
    serial_number: 'PF7712CC',
    source: 'BIGFIX',
    manufacturer: 'Lenovo',
    model: 'ThinkPad X1 Yoga Gen 7',
    os_name: 'Windows 11 Enterprise 22H2',
    mac_address: '3C:52:82:77:99:11',
    device_type: 'Laptop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'owilson',
    last_report_time: '2026-10-09T19:22:45Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2028-02-28',
    calculated_eol_status: 'Active',
    days_remaining: 506,
    verified_employee_id: 'EMP-1011',
    verified_employee_name: 'Oliver Wilson',
    workday_status: 'Matched',
    department: 'Human Resources',
    ip_address: '10.24.128.44',
    cpu: 'Intel Core i7-1260P',
    ram_gb: 16,
    storage_gb: 512,
  },
  {
    id: 'AST-016',
    asset_number: 'AST-10507',
    serial_number: '5CG1109BBA',
    source: 'BIGFIX',
    manufacturer: 'Dell Inc.',
    model: 'Latitude 7440',
    os_name: 'Windows 11 Enterprise 23H2',
    mac_address: '10:65:30:44:81:90',
    device_type: 'Laptop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'sarahw',
    last_report_time: '2026-10-09T21:05:12Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2028-05-15',
    calculated_eol_status: 'Active',
    days_remaining: 582,
    verified_employee_id: 'EMP-1004',
    verified_employee_name: 'Sarah Washington',
    workday_status: 'Matched',
    department: 'Finance',
    ip_address: '10.24.116.05',
    cpu: 'Intel Core i7-1365U',
    ram_gb: 32,
    storage_gb: 1024,
  },
  {
    id: 'AST-017',
    asset_number: 'AST-10508',
    serial_number: 'C02K9988MD6S',
    source: 'JAMF',
    manufacturer: 'Apple Inc.',
    model: 'MacBook Pro 14" M3 Pro',
    os_name: 'macOS Sonoma 14.5',
    mac_address: 'F0:18:98:77:21:88',
    device_type: 'Laptop',
    managed_by: 'Jamf Pro Cloud',
    assigned_username: 'evance',
    last_report_time: '2026-10-10T00:15:30Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2029-01-31',
    calculated_eol_status: 'Active',
    days_remaining: 843,
    verified_employee_id: 'EMP-1014',
    verified_employee_name: 'Elena Vance',
    workday_status: 'Matched',
    department: 'Executive',
    ip_address: '10.24.110.02',
    cpu: 'Apple M3 Pro (11-Core)',
    ram_gb: 36,
    storage_gb: 1024,
  },
  {
    id: 'AST-018',
    asset_number: 'AST-10509',
    serial_number: '9ZJ11029D',
    source: 'BIGFIX',
    manufacturer: 'Cisco Systems',
    model: 'UCS B200 M5 Blade',
    os_name: 'VMware ESXi 7.0 Update 3',
    mac_address: '00:25:B5:11:00:22',
    device_type: 'Server',
    managed_by: 'BigFix Datacenter',
    assigned_username: 'backup_adm',
    last_report_time: '2026-10-10T03:00:00Z',
    asset_status: 'REVIEW',
    assignment_type: 'Manual',
    eol_date: '2026-11-30',
    calculated_eol_status: 'EOL Soon',
    days_remaining: 51,
    verified_employee_id: null,
    verified_employee_name: null,
    workday_status: 'Admin Account',
    department: 'Infrastructure',
    ip_address: '172.16.8.50',
    cpu: 'Dual Intel Xeon Gold 6248R',
    ram_gb: 512,
    storage_gb: 32768,
  },
  {
    id: 'AST-019',
    asset_number: 'AST-10510',
    serial_number: 'PF4433RR',
    source: 'BIGFIX',
    manufacturer: 'Lenovo',
    model: 'ThinkStation P620',
    os_name: 'Windows 11 Pro for Workstations',
    mac_address: '64:4E:99:88:12:00',
    device_type: 'Desktop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'amartin',
    last_report_time: '2026-09-20T17:30:00Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Manual',
    eol_date: '2028-07-20',
    calculated_eol_status: 'Active',
    days_remaining: 648,
    verified_employee_id: 'EMP-1013',
    verified_employee_name: 'Aisha Martin',
    workday_status: 'Matched',
    department: 'Engineering',
    ip_address: '10.24.112.55',
    cpu: 'AMD Threadripper PRO 5955WX',
    ram_gb: 128,
    storage_gb: 4096,
    notes: 'Secondary workstation. Employee currently on approved medical leave.',
  },
  {
    id: 'AST-020',
    asset_number: 'AST-10511',
    serial_number: 'UNKNOWN-SN-99',
    source: 'BIGFIX',
    manufacturer: 'Generic / Custom Build',
    model: 'Custom Rack Unit',
    os_name: 'Ubuntu 18.04.6 LTS',
    mac_address: '52:54:00:12:34:56',
    device_type: 'Server',
    managed_by: 'BigFix Datacenter',
    assigned_username: null,
    last_report_time: '2026-07-10T12:00:00Z',
    asset_status: 'REVIEW',
    assignment_type: 'Unassigned',
    eol_date: null,
    calculated_eol_status: 'Unknown',
    days_remaining: null,
    verified_employee_id: null,
    verified_employee_name: null,
    workday_status: 'Unassigned',
    department: 'Engineering',
    ip_address: '172.16.99.14',
    cpu: 'Intel Core i7-7700K',
    ram_gb: 32,
    storage_gb: 1000,
    notes: 'Unidentified legacy lab box. EOL date unknown in OEM catalog. Stale check-in.',
  },
  {
    id: 'AST-021',
    asset_number: 'AST-10512',
    serial_number: 'C02J0099MD6P',
    source: 'JAMF',
    manufacturer: 'Apple Inc.',
    model: 'MacBook Pro 13" M2',
    os_name: 'macOS Ventura 13.5',
    mac_address: 'A0:78:17:11:44:22',
    device_type: 'Laptop',
    managed_by: 'Jamf Pro Cloud',
    assigned_username: 'tcollins',
    last_report_time: '2026-10-09T20:30:10Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2028-04-15',
    calculated_eol_status: 'Active',
    days_remaining: 552,
    verified_employee_id: 'EMP-1009',
    verified_employee_name: 'Tara Collins',
    workday_status: 'Matched',
    department: 'Sales',
    ip_address: '10.24.124.10',
    cpu: 'Apple M2 (8-Core)',
    ram_gb: 24,
    storage_gb: 1024,
  },
  {
    id: 'AST-022',
    asset_number: 'AST-10513',
    serial_number: '5CG4421ZZX',
    source: 'BIGFIX',
    manufacturer: 'HP Inc.',
    model: 'ZBook Fury 16 G10',
    os_name: 'Windows 11 Enterprise 23H2',
    mac_address: '2C:60:0C:88:99:AA',
    device_type: 'Laptop',
    managed_by: 'BigFix Corporate',
    assigned_username: 'kgrant',
    last_report_time: '2026-10-09T18:11:00Z',
    asset_status: 'ACTIVE',
    assignment_type: 'Automatic',
    eol_date: '2028-10-01',
    calculated_eol_status: 'Active',
    days_remaining: 721,
    verified_employee_id: 'EMP-1007',
    verified_employee_name: 'Keith Grant',
    workday_status: 'Matched',
    department: 'Marketing',
    ip_address: '10.24.120.08',
    cpu: 'Intel Core i9-13950HX',
    ram_gb: 64,
    storage_gb: 2048,
  },
];

// Ensure mock assets have manager, remarks, and canonical fields populated
for (const a of MOCK_ASSETS) {
  if (!a.devicetype && a.device_type) {
    a.devicetype = String(a.device_type);
  }
  if (!a.device_type && a.devicetype) {
    a.device_type = a.devicetype;
  }
  const canonicalEol = toStandardEOLStatus(a.eol_status || a.calculated_eol_status);
  a.eol_status = canonicalEol;
  a.calculated_eol_status = canonicalEol;
  if (a.verified_employee_id || a.assigned_username) {
    const emp = MOCK_EMPLOYEES.find(
      e => (a.verified_employee_id && e.employee_id === a.verified_employee_id) ||
           (a.assigned_username && e.user_id === a.assigned_username)
    );
    if (emp) {
      a.manager_user_name = emp.manager_username;
      a.manager_username = emp.manager_username;
      a.managerUsername = emp.manager_username;
      a.manager_name = emp.manager_name;
      a.managerName = emp.manager_name;
      a.employee_status = emp.employee_status;
      a.full_name = emp.full_name;
      a.work_email = emp.work_email;
      a.division = emp.division;
      a.job_title = emp.job_title;
    }
  }
  if (!a.remarks && a.notes) {
    a.remarks = a.notes;
  }
}

// Helper to calculate summary from mock dataset
export function calculateMockSummary(assets: Asset[] = MOCK_ASSETS, employees: Employee[] = MOCK_EMPLOYEES): DashboardSummary {
  const active_assets = assets.filter(a => toStandardAssetStatus(a.asset_status) === ASSET_STATUSES.ACTIVE).length;
  const review = assets.filter(a => toStandardAssetStatus(a.asset_status) === ASSET_STATUSES.REVIEW).length;
  const in_stock = assets.filter(a => toStandardAssetStatus(a.asset_status) === ASSET_STATUSES.IN_STOCK).length;
  const bigfix_assets = assets.filter(a => a.source === 'BIGFIX').length;
  const jamf_assets = assets.filter(a => a.source === 'JAMF').length;
  const automatically_assigned = assets.filter(a => a.assignment_type === 'Automatic').length;
  const manually_assigned = assets.filter(a => a.assignment_type === 'Manual').length;
  const unassigned_assets = assets.filter(a => a.assignment_type === 'Unassigned').length;

  return {
    total_assets: assets.length,
    active_assets,
    review,
    need_validation: review,
    in_stock,
    bigfix_assets,
    jamf_assets,
    automatically_assigned,
    manually_assigned,
    unassigned_assets,
    employee_count: employees.length,
  };
}

export function getMockAssetsBySource(assets: Asset[] = MOCK_ASSETS): AssetsBySourceItem[] {
  const total = assets.length || 1;
  const bigfixCount = assets.filter(a => a.source === 'BIGFIX').length;
  const jamfCount = assets.filter(a => a.source === 'JAMF').length;
  return [
    { source: 'BIGFIX (Windows/Linux/Servers)', count: bigfixCount, percentage: Math.round((bigfixCount / total) * 100) },
    { source: 'JAMF (macOS/Apple)', count: jamfCount, percentage: Math.round((jamfCount / total) * 100) },
  ];
}

export function getMockOwnershipSummary(assets: Asset[] = MOCK_ASSETS): OwnershipSummaryItem[] {
  const total = assets.length || 1;
  const auto = assets.filter(a => a.assignment_type === 'Automatic').length;
  const manual = assets.filter(a => a.assignment_type === 'Manual').length;
  const unassigned = assets.filter(a => a.assignment_type === 'Unassigned').length;
  return [
    { assignment_type: 'Automatically Assigned', count: auto, percentage: Math.round((auto / total) * 100) },
    { assignment_type: 'Manually Assigned', count: manual, percentage: Math.round((manual / total) * 100) },
    { assignment_type: 'Unassigned', count: unassigned, percentage: Math.round((unassigned / total) * 100) },
  ];
}

export function getMockEOLSummary(assets: Asset[] = MOCK_ASSETS): EOLSummaryItem[] {
  const total = assets.length || 1;
  const active = assets.filter(a => a.calculated_eol_status === 'Active').length;
  const nearing = assets.filter(a => {
    const s = (a.calculated_eol_status || a.eol_status || '').toUpperCase().replace(/_/g, ' ');
    return s === 'EOL SOON' || s === 'NEARING EOL' || s.startsWith('NEARING') || s.startsWith('EOL SOON');
  }).length;
  const expired = assets.filter(a => a.calculated_eol_status === 'Expired').length;
  const unknown = assets.filter(a => a.calculated_eol_status === 'Unknown').length;

  return [
    { eol_status: 'Active (> 90 Days)', count: active, percentage: Math.round((active / total) * 100) },
    { eol_status: 'EOL Soon (≤ 90 Days)', count: nearing, percentage: Math.round((nearing / total) * 100) },
    { eol_status: 'Expired', count: expired, percentage: Math.round((expired / total) * 100) },
    { eol_status: 'Unknown', count: unknown, percentage: Math.round((unknown / total) * 100) },
  ];
}

export function getMockOperationalStatus(assets: Asset[] = MOCK_ASSETS): OperationalStatusItem[] {
  const total = assets.length || 1;
  const counts: Record<string, number> = {};
  assets.forEach(a => {
    const std = toStandardAssetStatus(a.asset_status);
    counts[std] = (counts[std] || 0) + 1;
  });
  return Object.entries(counts).map(([status, count]) => ({
    status,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}

export function getMockDepartmentDistribution(assets: Asset[] = MOCK_ASSETS): DepartmentDistributionItem[] {
  const total = assets.length || 1;
  const counts: Record<string, number> = {};
  assets.forEach(a => {
    const dept = a.department || 'Unspecified';
    counts[dept] = (counts[dept] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([department, count]) => ({
      department,
      count,
      asset_count: count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export function getMockFilters(assets: Asset[] = MOCK_ASSETS, employees: Employee[] = MOCK_EMPLOYEES): FilterOptions {
  return {
    sources: Array.from(new Set(assets.map(a => a.source))),
    device_types: Array.from(new Set(assets.map(a => (a.devicetype || a.device_type || '').trim()).filter(Boolean))),
    asset_statuses: [
      ASSET_STATUSES.ACTIVE,
      ASSET_STATUSES.REVIEW,
      ASSET_STATUSES.IN_STOCK,
      ASSET_STATUSES.RETIRED,
    ],
    manufacturers: Array.from(new Set(assets.map(a => a.manufacturer))),
    models: Array.from(new Set(assets.map(a => a.model))),
    assignment_types: Array.from(new Set(assets.map(a => a.assignment_type))),
    departments: Array.from(new Set(employees.map(e => e.department))),
    divisions: Array.from(new Set(employees.map(e => e.division))),
    employee_statuses: Array.from(new Set(employees.map(e => e.employee_status))),
    eol_statuses: ['ACTIVE', 'EOL SOON', 'EXPIRED', 'UNKNOWN'],
  };
}

export function filterAndPaginateAssets(
  params: AssetQueryParams,
  assets: Asset[] = MOCK_ASSETS
): PaginatedResponse<Asset> {
  let filtered = [...assets];

  if (params.search) {
    const q = params.search.trim().toLowerCase();
    filtered = filtered.filter(a =>
      a.asset_number.toLowerCase().includes(q) ||
      a.serial_number.toLowerCase().includes(q) ||
      a.model.toLowerCase().includes(q) ||
      a.manufacturer.toLowerCase().includes(q) ||
      (a.assigned_username && a.assigned_username.toLowerCase().includes(q)) ||
      (a.verified_employee_name && a.verified_employee_name.toLowerCase().includes(q))
    );
  }

  if (params.source) {
    const s = params.source.trim().toLowerCase();
    filtered = filtered.filter(a => a.source.toLowerCase() === s);
  }

  const deviceTypeParam = params.devicetype || params.device_type;
  if (deviceTypeParam && deviceTypeParam.trim()) {
    const targetDt = deviceTypeParam.trim().toLowerCase();
    filtered = filtered.filter(a => {
      const dt = (a.devicetype || a.device_type || '').trim().toLowerCase();
      return dt === targetDt;
    });
  }

  if (params.asset_status) {
    const filterStd = toStandardAssetStatus(params.asset_status);
    filtered = filtered.filter(a => toStandardAssetStatus(a.asset_status) === filterStd);
  }

  if (params.manufacturer) {
    filtered = filtered.filter(a => a.manufacturer.toLowerCase() === params.manufacturer?.toLowerCase());
  }

  if (params.model) {
    filtered = filtered.filter(a => a.model.toLowerCase().includes(params.model!.toLowerCase()));
  }

  if (params.assignment_type) {
    const filterVal = params.assignment_type.trim().toLowerCase();
    filtered = filtered.filter(a => {
      const aVal = (a.assignment_type || '').trim().toLowerCase();
      if (filterVal === 'auto' || filterVal === 'automatic') {
        return aVal === 'auto' || aVal === 'automatic';
      }
      if (filterVal === 'manual') {
        return aVal === 'manual';
      }
      return aVal === filterVal;
    });
  }

  if (params.eol_status && params.eol_status.trim()) {
    const targetEol = params.eol_status.trim().toLowerCase().replace(/_/g, ' ');
    filtered = filtered.filter(a => {
      const eol = (a.eol_status || a.calculated_eol_status || '').trim().toLowerCase().replace(/_/g, ' ');
      if (eol === targetEol) return true;
      if (targetEol === 'active' && eol.startsWith('active')) return true;
      if (
        (targetEol === 'eol soon' || targetEol.startsWith('nearing') || targetEol.startsWith('eol soon')) &&
        (eol === 'eol soon' || eol.startsWith('nearing') || eol.startsWith('eol soon'))
      ) return true;
      if (targetEol === 'expired' && eol.startsWith('expired')) return true;
      if (targetEol === 'unknown' && eol.startsWith('unknown')) return true;
      return false;
    });
  }

  if (params.department) {
    filtered = filtered.filter(a => a.department?.toLowerCase() === params.department?.toLowerCase());
  }

  // Sort
  if (params.sort_by) {
    const key = params.sort_by as keyof Asset;
    const order = params.sort_order === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      const valA = a[key] ?? '';
      const valB = b[key] ?? '';
      if (valA < valB) return -1 * order;
      if (valA > valB) return 1 * order;
      return 0;
    });
  }

  const page = params.page || 1;
  const pageSize = params.page_size || 10;
  const total = filtered.length;
  const total_pages = Math.ceil(total / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const items = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages,
  };
}

export function filterAndPaginateEmployees(
  params: EmployeeQueryParams,
  employees: Employee[] = MOCK_EMPLOYEES,
  assets: Asset[] = MOCK_ASSETS
): PaginatedResponse<Employee> {
  // Attach assigned assets to each employee
  let enriched = employees.map(emp => {
    const assigned = assets.filter(
      a => a.assigned_username === emp.user_id || a.verified_employee_id === emp.employee_id
    );
    return {
      ...emp,
      assigned_assets_count: assigned.length,
      assigned_assets: assigned,
    };
  });

  if (params.search) {
    const q = params.search.toLowerCase();
    enriched = enriched.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      e.user_id.toLowerCase().includes(q) ||
      e.work_email.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q) ||
      e.job_title.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  }

  if (params.department) {
    enriched = enriched.filter(e => e.department.toLowerCase() === params.department?.toLowerCase());
  }

  if (params.division) {
    enriched = enriched.filter(e => e.division.toLowerCase() === params.division?.toLowerCase());
  }

  if (params.employee_status) {
    enriched = enriched.filter(e => e.employee_status.toLowerCase() === params.employee_status?.toLowerCase());
  }

  // Sort
  if (params.sort_by) {
    const key = params.sort_by as keyof Employee;
    const order = params.sort_order === 'desc' ? -1 : 1;
    enriched.sort((a, b) => {
      const valA = a[key] ?? '';
      const valB = b[key] ?? '';
      if (valA < valB) return -1 * order;
      if (valA > valB) return 1 * order;
      return 0;
    });
  }

  const page = params.page || 1;
  const pageSize = params.page_size || 10;
  const total = enriched.length;
  const total_pages = Math.ceil(total / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const items = enriched.slice(startIndex, startIndex + pageSize);

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages,
  };
}

export const MOCK_HEALTH: HealthResponse = {
  status: 'healthy',
  version: '2.4.1',
  timestamp: new Date().toISOString(),
  last_sync: '2026-10-10T03:00:00Z',
  bigfix_status: 'Connected (Sync 14m ago)',
  jamf_status: 'Connected (Sync 18m ago)',
  workday_status: 'Connected (Daily sync ok)',
  eol_warning_threshold_days: 90,
};
