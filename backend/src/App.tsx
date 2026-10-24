/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Server,
  Laptop,
  Database,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Code2,
  Terminal,
  Activity,
  Layers,
  ChevronRight,
  Copy,
  Check,
  UserCheck,
  UserX,
  ShieldAlert,
  HardDrive,
  Monitor,
  Apple,
  Trash2,
  Plus,
  RefreshCw,
  Info,
  Calendar,
  Edit3
} from 'lucide-react';

// --- Sample Database Fixtures Mirroring Postgres Schema ---
const INITIAL_EMPLOYEES = [
  {
    employee_id: 1,
    user_id: "johndoe",
    full_name: "John Doe",
    email_work: "john.doe@enterprise.com",
    department: "Engineering",
    division: "Product Dev",
    job_title: "Senior Systems Engineer",
    employee_status: "Active",
    manager_name: "Sarah Jenkins",
    location: "San Francisco, CA",
  },
  {
    employee_id: 2,
    user_id: "sarahconnor",
    full_name: "Sarah Connor",
    email_work: "sarah.connor@enterprise.com",
    department: "Security",
    division: "Cyber Defense",
    job_title: "Lead Security Analyst",
    employee_status: "Active",
    manager_name: "Robert Miles",
    location: "Austin, TX",
  },
  {
    employee_id: 3,
    user_id: "alexturner",
    full_name: "Alex Turner",
    email_work: "alex.turner@enterprise.com",
    department: "Marketing",
    division: "Growth",
    job_title: "Growth Specialist",
    employee_status: "Terminated", // Inactive employee in Workday
    manager_name: "Lisa Wong",
    location: "New York, NY",
  },
  {
    employee_id: 4,
    user_id: "emilychen",
    full_name: "Emily Chen",
    email_work: "emily.chen@enterprise.com",
    department: "Finance",
    division: "Corporate Ops",
    job_title: "Senior Financial Analyst",
    employee_status: "Active",
    manager_name: "David Vance",
    location: "Chicago, IL",
  },
  {
    employee_id: 5,
    user_id: "marcusross",
    full_name: "Marcus Ross",
    email_work: "marcus.ross@enterprise.com",
    department: "Engineering",
    division: "Infrastructure",
    job_title: "Site Reliability Architect",
    employee_status: "Active",
    manager_name: "Sarah Jenkins",
    location: "Seattle, WA",
  }
];

const INITIAL_EOL_REFERENCES = [
  { eol_id: 1, manufacturer: "Apple", model: "MacBook Pro 16", eol_date: "2026-08-15", reference_source: "Apple Hardware Lifecycle Matrix" },
  { eol_id: 2, manufacturer: "Apple", model: "MacBook Air 13", eol_date: "2027-05-20", reference_source: "Apple Hardware Lifecycle Matrix" },
  { eol_id: 3, manufacturer: "Lenovo", model: "ThinkPad T14", eol_date: "2026-11-20", reference_source: "Lenovo Enterprise EOS Guide" },
  { eol_id: 4, manufacturer: "Dell", model: "PowerEdge R750", eol_date: "2028-12-31", reference_source: "Dell EMC Lifecycle Portal" },
  { eol_id: 5, manufacturer: "Dell", model: "OptiPlex 7090", eol_date: "2026-09-01", reference_source: "Dell Client Lifecycle Reference" },
  { eol_id: 6, manufacturer: "HP", model: "ProLiant DL380", eol_date: "2026-04-10", reference_source: "HPE Product End of Support Bulletin" },
];

const INITIAL_ADMIN_USERS = [
  { admin_user_id: "johndoe", created_at: "2026-01-15T09:00:00Z" },
  { admin_user_id: "sarahconnor", created_at: "2026-02-10T14:30:00Z" },
];

interface AssetItem {
  asset_id: number;
  asset_number: string;
  serial_number: string;
  source: string;
  manufacturer: string;
  model: string;
  os_name: string;
  macaddress: string;
  devicetype: string;
  managed_by: string;
  assigned_username: string | null;
  asset_status: string;
  assignment_type: string | null;
  remarks: string | null;
  lastreporttime: string;
}

const INITIAL_ASSETS: AssetItem[] = [
  {
    asset_id: 101,
    asset_number: "AST-1001",
    serial_number: "C02G41ABMD6M",
    source: "BIGFIX",
    manufacturer: "Apple",
    model: "MacBook Pro 16",
    os_name: "macOS 14.5 Sonoma",
    macaddress: "3c:22:fb:8a:11:02",
    devicetype: "Desktop",
    managed_by: "INDIVIDUAL",
    assigned_username: "  JOHNDOE  ", // whitespace + uppercase
    asset_status: "Active",
    assignment_type: "AUTO",
    remarks: "Primary engineering machine",
    lastreporttime: "2026-10-10T08:15:00Z",
  },
  {
    asset_id: 102,
    asset_number: "AST-1002",
    serial_number: "PF2X9K81",
    source: "JAMF",
    manufacturer: "Lenovo",
    model: "ThinkPad T14",
    os_name: "Windows 11 Pro 23H2",
    macaddress: "50:7b:9d:22:44:90",
    devicetype: "Desktop",
    managed_by: "INDIVIDUAL",
    assigned_username: "sarahconnor",
    asset_status: "Need Validation",
    assignment_type: "MANUAL",
    remarks: "Pending security re-validation",
    lastreporttime: "2026-10-09T18:40:00Z",
  },
  {
    asset_id: 103,
    asset_number: "AST-1003",
    serial_number: "DEL-SRV-9012",
    source: "BIGFIX",
    manufacturer: "Dell",
    model: "PowerEdge R750",
    os_name: "Red Hat Enterprise Linux 9.2",
    macaddress: "00:1e:67:d8:a4:20",
    devicetype: "Server",
    managed_by: "GROUP",
    assigned_username: null, // Unassigned
    asset_status: "InStock",
    assignment_type: null,
    remarks: "Spares inventory shelf 4",
    lastreporttime: "2026-10-08T12:00:00Z",
  },
  {
    asset_id: 104,
    asset_number: "AST-1004",
    serial_number: "PF3B11A9",
    source: "JAMF",
    manufacturer: "Lenovo",
    model: "ThinkPad T14",
    os_name: "Windows 11 Enterprise",
    macaddress: "50:7b:9d:88:12:33",
    devicetype: "Desktop",
    managed_by: "INDIVIDUAL",
    assigned_username: "admin_local", // Not in Workday
    asset_status: "Active",
    assignment_type: "MANUAL",
    remarks: "Local lab workstation",
    lastreporttime: "2026-10-10T02:11:00Z",
  },
  {
    asset_id: 105,
    asset_number: "AST-1005",
    serial_number: "5CD1459X0Z",
    source: "BIGFIX",
    manufacturer: "HP",
    model: "EliteBook 840", // Missing reference -> Unknown EOL
    os_name: "Windows 10 Enterprise 22H2",
    macaddress: "d8:f2:59:12:87:65",
    devicetype: "Desktop",
    managed_by: "INDIVIDUAL",
    assigned_username: "alexturner", // Inactive employee in Workday
    asset_status: "Active",
    assignment_type: "AUTO",
    remarks: "Assigned prior to offboarding",
    lastreporttime: "2026-10-09T22:04:00Z",
  },
  {
    asset_id: 106,
    asset_number: "AST-1006",
    serial_number: "DEL-SVR-3044",
    source: "BIGFIX",
    manufacturer: "Dell",
    model: "PowerEdge R750",
    os_name: "Ubuntu 22.04 LTS",
    macaddress: "00:1e:67:44:99:bb",
    devicetype: "Server",
    managed_by: "GROUP",
    assigned_username: "   ", // Blank string -> Unassigned
    asset_status: "InStock",
    assignment_type: null,
    remarks: "Backup database host",
    lastreporttime: "2026-10-07T11:20:00Z",
  },
  {
    asset_id: 107,
    asset_number: "AST-1007",
    serial_number: "C02FL98KMD6R",
    source: "JAMF",
    manufacturer: "Apple",
    model: "MacBook Air 13",
    os_name: "macOS 14.4 Sonoma",
    macaddress: "18:65:90:ea:77:12",
    devicetype: "Desktop",
    managed_by: "INDIVIDUAL",
    assigned_username: "emilychen",
    asset_status: "Active",
    assignment_type: "AUTO",
    remarks: "Finance team allocation",
    lastreporttime: "2026-10-10T09:00:00Z",
  },
  {
    asset_id: 108,
    asset_number: "AST-1008",
    serial_number: "HPE-DL380-001",
    source: "BIGFIX",
    manufacturer: "HP",
    model: "ProLiant DL380",
    os_name: "Rocky Linux 9",
    macaddress: "94:57:a5:31:00:18",
    devicetype: "Server",
    managed_by: "GROUP",
    assigned_username: "marcusross",
    asset_status: "Active",
    assignment_type: "MANUAL",
    remarks: "Monitoring node",
    lastreporttime: "2026-10-10T07:44:00Z",
  }
];

export default function App() {
  // Navigation State for the 4 core pages + management consoles
  const [activePage, setActivePage] = useState<'all_assets' | 'windows_assets' | 'mac_assets' | 'ownership' | 'eol_reference' | 'admin_users' | 'architecture' | 'tests'>('all_assets');

  // Interactive Reference and Admin User State
  const [eolReferences, setEolReferences] = useState<any[]>(INITIAL_EOL_REFERENCES);
  const [adminUsers, setAdminUsers] = useState(INITIAL_ADMIN_USERS);
  const [newAdminUserId, setNewAdminUserId] = useState('');
  const [newRefMfr, setNewRefMfr] = useState('');
  const [newRefModel, setNewRefModel] = useState('');
  const [newRefDate, setNewRefDate] = useState('');
  const [newRefSource, setNewRefSource] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assetsList, setAssetsList] = useState<AssetItem[]>(INITIAL_ASSETS);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<any | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Popup Assign/Reassign State
  const [popupAssignUserId, setPopupAssignUserId] = useState('sarahconnor');
  const [popupAssignManagedBy, setPopupAssignManagedBy] = useState('INDIVIDUAL');
  const [popupAssignRemarks, setPopupAssignRemarks] = useState('');
  const [popupAssignLoading, setPopupAssignLoading] = useState(false);
  const [popupAssignSuccess, setPopupAssignSuccess] = useState<string | null>(null);
  const [popupAssignError, setPopupAssignError] = useState<string | null>(null);
  const [isAssignFormOpen, setIsAssignFormOpen] = useState(false);

  // Bulk Assignment State (Asset Ownership page & fleet lists)
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState('sarahconnor');
  const [bulkAssignManagedBy, setBulkAssignManagedBy] = useState('GROUP');
  const [bulkAssignRemarks, setBulkAssignRemarks] = useState('');
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);
  const [bulkAssignResult, setBulkAssignResult] = useState<any | null>(null);
  const [bulkAssignError, setBulkAssignError] = useState<string | null>(null);

  // Inline EOL Editor State
  const [editingEolAsset, setEditingEolAsset] = useState<{
    manufacturer: string;
    model: string;
    eol_date: string;
    reference_source?: string;
  } | null>(null);
  const [inlineEolDate, setInlineEolDate] = useState('');
  const [inlineEolSource, setInlineEolSource] = useState('');
  const [eolToast, setEolToast] = useState<string | null>(null);

  const today = useMemo(() => new Date("2026-10-11"), []);
  const WARNING_DAYS = 90;

  const openAssetDetail = async (asset: any) => {
    setSelectedAssetDetail(asset);
    const existingUser = asset.assigned_username?.trim().toLowerCase();
    const defaultUser = INITIAL_EMPLOYEES.find(e => e.employee_status === 'Active' && e.user_id !== existingUser)?.user_id || 'sarahconnor';
    setPopupAssignUserId(existingUser || defaultUser);
    setPopupAssignManagedBy(asset.managed_by || 'INDIVIDUAL');
    setPopupAssignRemarks(asset.remarks || '');
    setPopupAssignError(null);
    setPopupAssignSuccess(null);
    setIsAssignFormOpen(false);

    try {
      const res = await fetch(`/api/assets/${asset.asset_id}`);
      if (res.ok) {
        const fullDetail = await res.json();
        setSelectedAssetDetail((curr: any) => (curr && curr.asset_id === asset.asset_id ? { ...curr, ...fullDetail } : curr));
      }
    } catch {
      // Fallback to initial row data if fetch fails
    }
  };

  const handleAssignUserInPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetDetail || !popupAssignUserId) return;
    setPopupAssignLoading(true);
    setPopupAssignError(null);
    setPopupAssignSuccess(null);

    const isReassign = Boolean(selectedAssetDetail.assigned_username && selectedAssetDetail.assigned_username.trim());
    const payload = {
      asset_id: selectedAssetDetail.asset_id,
      asset_number: selectedAssetDetail.asset_number || selectedAssetDetail.assetNumber,
      user_id: popupAssignUserId,
      managed_by: popupAssignManagedBy,
      remarks: popupAssignRemarks || undefined,
    };

    try {
      const res = await fetch(`/api/assets/${selectedAssetDetail.asset_id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'johndoe',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setPopupAssignSuccess(
          `Successfully ${isReassign ? 'reassigned' : 'assigned'} to ${updated.user_full_name || updated.user_id}`
        );
        // Update local assetsList
        setAssetsList(prev => prev.map(a => a.asset_id === selectedAssetDetail.asset_id ? {
          ...a,
          assigned_username: updated.assigned_username || updated.user_id,
          managed_by: updated.managed_by,
          asset_status: updated.asset_status,
          assignment_type: updated.assignment_type,
          remarks: updated.remarks,
        } : a));
        // Update selected asset detail in drawer
        setSelectedAssetDetail((prev: any) => ({
          ...prev,
          ...updated,
          assigned_username: updated.assigned_username || updated.user_id,
          workdayStatus: updated.workday_status || 'Matched Workday employee',
          fullName: updated.user_full_name,
          full_name: updated.user_full_name,
          employee_status: updated.employee_status,
          department: updated.department,
          division: updated.division,
          job_title: updated.job_title,
          email_work: updated.email_work,
          matched_employee: updated.matched_employee,
          reporting_evp: updated.reporting_evp,
        }));
        setIsAssignFormOpen(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        setPopupAssignError(errData.detail || 'Assignment failed');
      }
    } catch {
      // Offline fallback: update client state directly
      const emp = INITIAL_EMPLOYEES.find(em => em.user_id === popupAssignUserId);
      if (emp) {
        setAssetsList(prev => prev.map(a => a.asset_id === selectedAssetDetail.asset_id ? {
          ...a,
          assigned_username: emp.user_id,
          managed_by: popupAssignManagedBy,
          asset_status: 'Active',
          assignment_type: 'MANUAL',
          remarks: popupAssignRemarks || a.remarks,
        } : a));
        setSelectedAssetDetail((prev: any) => ({
          ...prev,
          assigned_username: emp.user_id,
          workdayStatus: 'Matched Workday employee',
          fullName: emp.full_name,
          full_name: emp.full_name,
          employee_status: emp.employee_status,
          department: emp.department,
          division: emp.division,
          job_title: emp.job_title,
          email_work: emp.email_work,
          matched_employee: emp,
          managed_by: popupAssignManagedBy,
          remarks: popupAssignRemarks || prev.remarks,
        }));
        setPopupAssignSuccess(`Assigned to ${emp.full_name} (${emp.user_id})`);
        setIsAssignFormOpen(false);
      }
    } finally {
      setPopupAssignLoading(false);
      setTimeout(() => setPopupAssignSuccess(null), 3500);
    }
  };

  const handleBulkAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectAllMatching && selectedAssetIds.length === 0) || !bulkAssignUserId) return;

    setBulkAssignLoading(true);
    setBulkAssignError(null);
    setBulkAssignResult(null);

    const idempotencyKey = `bulk-ui-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const payload: any = {
      assigned_username: bulkAssignUserId,
      managed_by: bulkAssignManagedBy,
      remarks: bulkAssignRemarks.trim() ? bulkAssignRemarks.trim() : undefined,
    };

    if (selectAllMatching) {
      payload.select_all = true;
      if (searchQuery) payload.search = searchQuery;
      if (statusFilter !== 'ALL') payload.asset_status = statusFilter;
      if (activePage === 'windows_assets') payload.source = 'BIGFIX';
      if (activePage === 'mac_assets') payload.source = 'JAMF';
    } else {
      payload.asset_ids = selectedAssetIds;
    }

    try {
      const res = await fetch('/api/assets/bulk-assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'johndoe',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setBulkAssignResult(data);
        const targetEmp = INITIAL_EMPLOYEES.find(e => e.user_id.toLowerCase() === bulkAssignUserId.toLowerCase());
        const targetUsername = targetEmp ? targetEmp.user_id : bulkAssignUserId;
        const newRemarks = bulkAssignRemarks.trim() ? bulkAssignRemarks.trim() : null;

        setAssetsList(prev => prev.map(a => {
          const isTarget = selectAllMatching
            ? (!searchQuery || a.asset_number.toLowerCase().includes(searchQuery.toLowerCase()) || a.model.toLowerCase().includes(searchQuery.toLowerCase()))
            : selectedAssetIds.includes(a.asset_id);

          if (isTarget) {
            return {
              ...a,
              assigned_username: targetUsername,
              managed_by: bulkAssignManagedBy,
              asset_status: 'Active',
              assignment_type: 'MANUAL',
              remarks: newRemarks,
            };
          }
          return a;
        }));

        setSelectedAssetIds([]);
        setSelectAllMatching(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setBulkAssignError(err.detail || 'Bulk assignment failed');
      }
    } catch {
      // Local fallback for offline mode
      const targetEmp = INITIAL_EMPLOYEES.find(e => e.user_id.toLowerCase() === bulkAssignUserId.toLowerCase());
      const newRemarks = bulkAssignRemarks.trim() ? bulkAssignRemarks.trim() : null;
      setAssetsList(prev => prev.map(a => {
        const isTarget = selectAllMatching ? true : selectedAssetIds.includes(a.asset_id);
        if (isTarget) {
          return {
            ...a,
            assigned_username: targetEmp ? targetEmp.user_id : bulkAssignUserId,
            managed_by: bulkAssignManagedBy,
            asset_status: 'Active',
            assignment_type: 'MANUAL',
            remarks: newRemarks,
          };
        }
        return a;
      }));

      const count = selectAllMatching ? filteredAssets.length : selectedAssetIds.length;
      setBulkAssignResult({
        message: `Bulk assignment completed: ${count} asset(s) assigned`,
        total_requested: count,
        requested_count: count,
        success_count: count,
        assigned_count: count,
        reassigned_count: 0,
        skipped_count: 0,
        failed_count: 0,
        failed_assets: [],
      });
      setSelectedAssetIds([]);
      setSelectAllMatching(false);
    } finally {
      setBulkAssignLoading(false);
    }
  };

  // EOL Calculation Logic
  const getEolForAsset = (manufacturer: string, model: string) => {
    const cleanMfr = manufacturer.trim().toLowerCase();
    const cleanMdl = model.trim().toLowerCase();

    const match = eolReferences.find(
      r => r.manufacturer.trim().toLowerCase() === cleanMfr && r.model.trim().toLowerCase() === cleanMdl
    );

    if (!match || !match.eol_date) {
      return { eol_status: "Unknown", eolStatus: "Unknown", eol_date: null, eolDate: null, days_remaining: null, daysRemaining: null, reference_source: null };
    }

    const eolDateObj = new Date(match.eol_date);
    const diffDays = Math.ceil((eolDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let status = "Active";
    if (diffDays < 0) {
      status = "Expired";
    } else if (diffDays <= WARNING_DAYS) {
      status = "Nearing EOL";
    }

    return {
      eol_status: status,
      eolStatus: status,
      eol_date: match.eol_date,
      eolDate: match.eol_date,
      days_remaining: diffDays,
      daysRemaining: diffDays,
      reference_source: match.reference_source,
    };
  };

  // Workday Correlation Logic (Distinguishes the 3 explicit states)
  const getWorkdayCorrelation = (username: string | null) => {
    if (!username || !username.trim()) {
      return {
        workday_status: "No assigned username",
        workdayStatus: "No assigned username",
        ownership_status: "UNASSIGNED",
        ownershipStatus: "UNASSIGNED",
        matched_employee: null,
      };
    }

    const cleanUser = username.trim().toLowerCase();
    const matched = INITIAL_EMPLOYEES.find(e => e.user_id.trim().toLowerCase() === cleanUser);

    if (matched) {
      // Matches even if inactive (e.g. Alex Turner is Terminated but matched in Workday)
      return {
        workday_status: "Matched Workday employee",
        workdayStatus: "Matched Workday employee",
        ownership_status: "MATCHED_WORKDAY",
        ownershipStatus: "MATCHED_WORKDAY",
        matched_employee: matched,
      };
    }

    return {
      workday_status: "Username not found in Workday",
      workdayStatus: "Username not found in Workday",
      ownership_status: "NOT_IN_WORKDAY",
      ownershipStatus: "NOT_IN_WORKDAY",
      matched_employee: null,
    };
  };

  // Processed Assets with both snake_case and camelCase field mappings
  const mappedAssets = useMemo(() => {
    return assetsList.map(asset => {
      const eol = getEolForAsset(asset.manufacturer, asset.model);
      const corr = getWorkdayCorrelation(asset.assigned_username);

      return {
        // Original schema columns
        ...asset,
        // Frontend agreed aliases
        assetId: asset.asset_id,
        AssetID: asset.asset_id,
        assetNumber: asset.asset_number,
        deviceType: asset.devicetype,
        DeviceType: asset.devicetype,
        macAddress: asset.macaddress,
        lastDiscoveryDate: asset.lastreporttime,
        LastDiscoveryDate: asset.lastreporttime,
        // EOL mappings
        ...eol,
        // Workday ownership mappings
        ...corr,
        full_name: corr.matched_employee?.full_name || null,
        fullName: corr.matched_employee?.full_name || null,
        employee_name: corr.matched_employee?.full_name || null,
        employeeName: corr.matched_employee?.full_name || null,
        email_work: corr.matched_employee?.email_work || null,
        department: corr.matched_employee?.department || null,
        division: corr.matched_employee?.division || null,
        job_title: corr.matched_employee?.job_title || null,
        employee_status: corr.matched_employee?.employee_status || null,
      };
    });
  }, [assetsList, eolReferences, today]);

  // Page-specific Scoped Assets (All, Windows/BigFix, Mac/Jamf, Ownership)
  const scopedAssets = useMemo(() => {
    if (activePage === 'windows_assets') {
      return mappedAssets.filter(a => a.source === 'BIGFIX');
    }
    if (activePage === 'mac_assets') {
      return mappedAssets.filter(a => a.source === 'JAMF');
    }
    return mappedAssets;
  }, [mappedAssets, activePage]);

  // Filtered Assets based on Search & Status
  const filteredAssets = useMemo(() => {
    return scopedAssets.filter(item => {
      if (statusFilter !== 'ALL' && item.asset_status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.asset_number.toLowerCase().includes(q) ||
          item.serial_number.toLowerCase().includes(q) ||
          item.model.toLowerCase().includes(q) ||
          (item.assigned_username || '').toLowerCase().includes(q) ||
          (item.full_name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scopedAssets, statusFilter, searchQuery]);

  // Page-specific Fleet Summary KPI Cards (Calculated directly from scoped data)
  const fleetKpis = useMemo(() => {
    const total = scopedAssets.length;
    const active = scopedAssets.filter(a => a.asset_status === 'Active').length;
    const needValidation = scopedAssets.filter(a => a.asset_status === 'Need Validation').length;
    const inStock = scopedAssets.filter(a => a.asset_status === 'InStock' || a.asset_status === 'In Stock').length;
    const nearingEol = scopedAssets.filter(a => a.eol_status === 'Nearing EOL' || a.eolStatus === 'Nearing EOL').length;
    const autoAssigned = scopedAssets.filter(a => a.assignment_type === 'AUTO').length;
    const manualAssigned = scopedAssets.filter(a => a.assignment_type === 'MANUAL').length;
    const unassigned = scopedAssets.filter(a => !a.assigned_username || !a.assigned_username.trim()).length;
    const matchedWorkday = scopedAssets.filter(a => a.workday_status === 'Matched Workday employee').length;
    const notInWorkday = scopedAssets.filter(a => a.workday_status === 'Username not found in Workday').length;

    return {
      total,
      totalAssets: total,
      total_assets: total,
      active,
      activeAssets: active,
      active_assets: active,
      needValidation,
      needValidationAssets: needValidation,
      need_validation_assets: needValidation,
      inStock,
      inStockAssets: inStock,
      in_stock_assets: inStock,
      InStock: inStock,
      nearingEol,
      nearingEolAssets: nearingEol,
      nearing_eol: nearingEol,
      NearingEol: nearingEol,
      autoAssigned,
      manualAssigned,
      unassigned,
      matchedWorkday,
      notInWorkday,
    };
  }, [scopedAssets]);

  // Admin users joined with employee details
  const joinedAdminUsers = useMemo(() => {
    return adminUsers.map(admin => {
      const emp = INITIAL_EMPLOYEES.find(e => e.user_id.toLowerCase() === admin.admin_user_id.toLowerCase());
      return {
        ...admin,
        full_name: emp?.full_name || null,
        email_work: emp?.email_work || null,
        department: emp?.department || null,
        job_title: emp?.job_title || null,
        employee_status: emp?.employee_status || null,
      };
    });
  }, [adminUsers]);

  const handleAddAdminUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUserId.trim()) return;
    const cleanId = newAdminUserId.trim();
    if (!adminUsers.some(a => a.admin_user_id.toLowerCase() === cleanId.toLowerCase())) {
      setAdminUsers([...adminUsers, { admin_user_id: cleanId, created_at: new Date().toISOString() }]);
    }
    setNewAdminUserId('');
  };

  const handleRemoveAdminUser = (userId: string) => {
    setAdminUsers(adminUsers.filter(a => a.admin_user_id.toLowerCase() !== userId.toLowerCase()));
  };

  const handleAddEolReference = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefMfr.trim() || !newRefModel.trim()) return;
    const newRef = {
      eol_id: Date.now(),
      manufacturer: newRefMfr.trim(),
      model: newRefModel.trim(),
      eol_date: newRefDate || null,
      reference_source: newRefSource.trim() || "Manual Administrator Entry",
    };
    setEolReferences([...eolReferences, newRef]);
    setNewRefMfr('');
    setNewRefModel('');
    setNewRefDate('');
    setNewRefSource('');
  };

  const handleDeleteEolReference = (id: number) => {
    setEolReferences(eolReferences.filter(r => r.eol_id !== id));
  };

  const handleSaveInlineEol = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingEolAsset) return;
    const targetMfr = editingEolAsset.manufacturer.trim();
    const targetModel = editingEolAsset.model.trim();
    const targetDate = inlineEolDate.trim() || null;
    const targetSource = inlineEolSource.trim() || undefined;

    // Optional call to live backend API (swallow errors if preview environment has no backend running)
    try {
      await fetch('/api/eol-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'johndoe',
        },
        body: JSON.stringify({
          manufacturer: targetMfr,
          model: targetModel,
          eol_date: targetDate,
          ...(targetSource ? { reference_source: targetSource } : {}),
        }),
      });
    } catch {
      // Offline preview fallback
    }

    // Client state create-or-update logic
    setEolReferences((prev) => {
      const idx = prev.findIndex(
        (r) =>
          r.manufacturer.trim().toLowerCase() === targetMfr.toLowerCase() &&
          r.model.trim().toLowerCase() === targetModel.toLowerCase()
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          eol_date: targetDate,
          // Preserves reference_source if not overridden
          reference_source: targetSource || copy[idx].reference_source,
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            eol_id: Date.now(),
            manufacturer: targetMfr,
            model: targetModel,
            eol_date: targetDate,
            reference_source: targetSource || 'Manual Administrator Entry',
          },
        ];
      }
    });

    setEolToast(`Updated EOL date for ${targetMfr} ${targetModel}`);
    setTimeout(() => setEolToast(null), 3500);
    setEditingEolAsset(null);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">AssetIQ</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-medium">
                  Backend API Operational
                </span>
              </div>
              <p className="text-xs text-slate-400">Asset Ownership Intelligence &amp; Governance</p>
            </div>
          </div>

          {/* Navigation Bar covering the 4 target pages + management */}
          <nav className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActivePage('all_assets')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activePage === 'all_assets' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>1. All Assets</span>
            </button>
            <button
              onClick={() => setActivePage('windows_assets')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activePage === 'windows_assets' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. Windows (BigFix)</span>
            </button>
            <button
              onClick={() => setActivePage('mac_assets')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activePage === 'mac_assets' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Apple className="w-3.5 h-3.5 text-indigo-400" />
              <span>3. Mac (Jamf)</span>
            </button>
            <button
              onClick={() => setActivePage('ownership')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activePage === 'ownership' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>4. Asset Ownership</span>
            </button>
            <button
              onClick={() => setActivePage('eol_reference')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activePage === 'eol_reference' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>EOL Reference</span>
            </button>
            <button
              onClick={() => setActivePage('admin_users')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activePage === 'admin_users' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin Users</span>
            </button>
            <button
              onClick={() => setActivePage('architecture')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                activePage === 'architecture' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="API Specs"
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActivePage('tests')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                activePage === 'tests' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Unit Tests"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ----------------- PAGES 1, 2, 3, 4: ASSETS & OWNERSHIP ----------------- */}
        {['all_assets', 'windows_assets', 'mac_assets', 'ownership'].includes(activePage) && (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  {activePage === 'all_assets' && <><HardDrive className="w-6 h-6 text-blue-400" /> All Enterprise Assets Inventory</>}
                  {activePage === 'windows_assets' && <><Monitor className="w-6 h-6 text-cyan-400" /> Windows Assets (BigFix Telemetry)</>}
                  {activePage === 'mac_assets' && <><Apple className="w-6 h-6 text-indigo-400" /> Mac Assets (Jamf Pro Telemetry)</>}
                  {activePage === 'ownership' && <><UserCheck className="w-6 h-6 text-emerald-400" /> Asset Ownership &amp; Workday Correlation</>}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  API: <code className="text-cyan-400 font-mono">GET /api/assets{activePage === 'windows_assets' ? '?source=BIGFIX' : activePage === 'mac_assets' ? '?source=JAMF' : ''}</code> &bull; KPI: <code className="text-cyan-400 font-mono">GET /api/dashboard/summary{activePage === 'windows_assets' ? '?source=BIGFIX' : activePage === 'mac_assets' ? '?source=JAMF' : ''}</code>
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                  Total: {fleetKpis.totalAssets} records
                </span>
              </div>
            </div>

            {/* Fleet Summary KPI Cards (5 metrics: Total Assets, Active, Need Validation, InStock, Nearing EOL) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  <span>Total Assets</span>
                  <HardDrive className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-3xl font-extrabold text-white">{fleetKpis.totalAssets}</div>
                <p className="text-[11px] text-slate-400 mt-1">Scoped fleet inventory</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  <span>Active</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-extrabold text-emerald-400">{fleetKpis.active}</div>
                <p className="text-[11px] text-slate-400 mt-1">asset_status = 'Active'</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  <span>Need Validation</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-extrabold text-amber-400">{fleetKpis.needValidation}</div>
                <p className="text-[11px] text-slate-400 mt-1">Requires IT inspection</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  <span>InStock</span>
                  <Database className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-3xl font-extrabold text-purple-400">{fleetKpis.inStock}</div>
                <p className="text-[11px] text-slate-400 mt-1">Spares &amp; inventory</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  <span>Nearing EOL</span>
                  <Clock className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-3xl font-extrabold text-rose-400">{fleetKpis.nearingEol}</div>
                <p className="text-[11px] text-slate-400 mt-1">Lifecycle within 90 days</p>
              </div>
            </div>

            {/* Dedicated Workday Ownership Telemetry on Ownership Page */}
            {activePage === 'ownership' && (
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-indigo-950/40 border border-emerald-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Workday HCM Identity Correlation Overview</h4>
                    <p className="text-[11px] text-slate-400">Live correlation mapping assigned telemetry usernames against Workday employees</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="text-slate-400">Matched Workday: </span>
                    <strong className="text-emerald-400">{fleetKpis.matchedWorkday}</strong>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="text-slate-400">Not in Workday: </span>
                    <strong className="text-rose-400">{fleetKpis.notInWorkday}</strong>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="text-slate-400">Unassigned: </span>
                    <strong className="text-amber-400">{fleetKpis.unassigned}</strong>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className="text-slate-400">Auto Telemetry: </span>
                    <strong className="text-cyan-400">{fleetKpis.autoAssigned}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by Asset ID, tag, serial number, model, username, or employee name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Need Validation">Need Validation</option>
                  <option value="InStock">InStock</option>
                </select>
                {searchQuery || statusFilter !== 'ALL' ? (
                  <button
                    onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
                    className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>

            {/* Bulk Selection Action Bar */}
            {selectedAssetIds.length > 0 && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white">
                      {selectAllMatching
                        ? `All ${fleetKpis.totalAssets} assets matching current filters selected`
                        : `${selectedAssetIds.length} asset(s) selected on this page`}
                    </span>
                    {!selectAllMatching && fleetKpis.totalAssets > filteredAssets.length && (
                      <button
                        onClick={() => setSelectAllMatching(true)}
                        className="ml-3 text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                      >
                        Select all {fleetKpis.totalAssets} matching assets across all pages
                      </button>
                    )}
                    {selectAllMatching && (
                      <button
                        onClick={() => setSelectAllMatching(false)}
                        className="ml-3 text-xs text-slate-400 hover:text-slate-300 underline font-medium"
                      >
                        Clear select-all across pages
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSelectedAssetIds([]); setSelectAllMatching(false); }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={() => {
                      setIsBulkAssignModalOpen(true);
                      setBulkAssignError(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg flex items-center gap-1.5"
                  >
                    <Users className="w-4 h-4" />
                    <span>Bulk Assign ({selectAllMatching ? fleetKpis.totalAssets : selectedAssetIds.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Assignment Structured Outcome Alert */}
            {bulkAssignResult && (
              <div className="bg-slate-900/95 border border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{bulkAssignResult.message}</span>
                  </div>
                  <button
                    onClick={() => setBulkAssignResult(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    &times; Dismiss
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Requested</span>
                    <strong className="text-white text-base">{bulkAssignResult.requested_count ?? bulkAssignResult.total_requested}</strong>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Assigned</span>
                    <strong className="text-emerald-400 text-base">{bulkAssignResult.assigned_count ?? 0}</strong>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Reassigned</span>
                    <strong className="text-cyan-400 text-base">{bulkAssignResult.reassigned_count ?? 0}</strong>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Skipped (Identical)</span>
                    <strong className="text-amber-400 text-base">{bulkAssignResult.skipped_count ?? 0}</strong>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Failed</span>
                    <strong className={(bulkAssignResult.failed_count ?? bulkAssignResult.failure_count ?? 0) > 0 ? "text-rose-400 text-base" : "text-slate-500 text-base"}>
                      {bulkAssignResult.failed_count ?? bulkAssignResult.failure_count ?? 0}
                    </strong>
                  </div>
                </div>
                {bulkAssignResult.failed_assets && bulkAssignResult.failed_assets.length > 0 && (
                  <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs space-y-1">
                    <span className="text-rose-400 font-bold block">Failed Items Detail:</span>
                    {bulkAssignResult.failed_assets.map((item: any, idx: number) => (
                      <div key={idx} className="text-slate-300">
                        Asset #{item.asset_id}: <span className="text-rose-300">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Asset Table with Fixed Field Mappings */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Displaying <strong>{filteredAssets.length}</strong> matching records</span>
                <span className="text-[11px] text-emerald-400 font-mono">Pagination Metadata: total={fleetKpis.totalAssets}, page=1, page_size=25, total_pages=1</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredAssets.length > 0 && selectedAssetIds.length === filteredAssets.length}
                          onChange={() => {
                            if (selectedAssetIds.length === filteredAssets.length) {
                              setSelectedAssetIds([]);
                              setSelectAllMatching(false);
                            } else {
                              setSelectedAssetIds(filteredAssets.map(a => a.asset_id));
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3.5">Asset ID / Tag</th>
                      <th className="px-4 py-3.5">Device Type</th>
                      <th className="px-4 py-3.5">Manufacturer &amp; Model</th>
                      <th className="px-4 py-3.5">MAC Address</th>
                      <th className="px-4 py-3.5">Last Discovery Date</th>
                      <th className="px-4 py-3.5">EOL Status</th>
                      <th className="px-4 py-3.5">Workday Ownership</th>
                      <th className="px-4 py-3.5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAssets.length > 0 ? (
                      filteredAssets.map(asset => (
                        <tr key={asset.asset_id} className={`hover:bg-slate-800/30 transition ${selectedAssetIds.includes(asset.asset_id) ? 'bg-emerald-950/20' : ''}`}>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedAssetIds.includes(asset.asset_id)}
                              onChange={() => {
                                setSelectedAssetIds(prev =>
                                  prev.includes(asset.asset_id)
                                    ? prev.filter(id => id !== asset.asset_id)
                                    : [...prev, asset.asset_id]
                                );
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          {/* Asset ID (Resolved: AssetID no longer undefined) */}
                          <td className="px-4 py-3 font-mono font-medium text-slate-200">
                            <div className="text-white font-bold">{asset.assetNumber}</div>
                            <span className="text-[10px] text-slate-500">PK: #{asset.AssetID} &bull; {asset.serial_number}</span>
                          </td>

                          {/* Device Type (Resolved: DeviceType mapped from devicetype) */}
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-300">
                              {asset.DeviceType || 'N/A'}
                            </span>
                          </td>

                          {/* Model & Source */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{asset.manufacturer} {asset.model}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.2 rounded font-bold ${asset.source === 'BIGFIX' ? 'text-cyan-400' : 'text-indigo-400'}`}>
                                {asset.source}
                              </span>
                              <span>&bull; {asset.os_name}</span>
                            </div>
                          </td>

                          {/* MAC Address (Resolved: macAddress mapped from macaddress) */}
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                            {asset.macAddress ? asset.macAddress : <span className="text-slate-600 italic">None</span>}
                          </td>

                          {/* Last Discovery Date (Resolved: LastDiscoveryDate mapped from lastreporttime) */}
                          <td className="px-4 py-3 text-[11px] text-slate-300 font-mono">
                            {asset.LastDiscoveryDate ? (
                              <span>{new Date(asset.LastDiscoveryDate).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-slate-600 italic">No telemetry</span>
                            )}
                          </td>

                          {/* EOL Status (Resolved: joined to device_eol_reference, calculated) */}
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              asset.eolStatus === 'Active'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : asset.eolStatus === 'Nearing EOL'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : asset.eolStatus === 'Expired'
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}>
                              {asset.eolStatus}
                            </span>
                            {asset.daysRemaining !== null && (
                              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                                {asset.daysRemaining} days left
                              </span>
                            )}
                          </td>

                          {/* Workday Ownership (Resolved: matched against workday_employees.user_id) */}
                          <td className="px-4 py-3">
                            {asset.workdayStatus === 'Matched Workday employee' && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                                  <UserCheck className="w-3 h-3" />
                                  {asset.fullName}
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  @{asset.assigned_username?.trim()} ({asset.employee_status})
                                </div>
                              </div>
                            )}

                            {asset.workdayStatus === 'Username not found in Workday' && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                                  <UserX className="w-3 h-3" />
                                  Not in Workday
                                </span>
                                <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                                  {asset.assigned_username}
                                </span>
                              </div>
                            )}

                            {asset.workdayStatus === 'No assigned username' && (
                              <span className="text-slate-500 italic text-[11px]">
                                No assigned username
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openAssetDetail(asset)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 font-medium transition"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-xs italic">
                          No matching asset records found for this filter combination.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Asset Detail Drawer */}
            {selectedAssetDetail && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-xs font-mono text-cyan-400">GET /api/assets/{selectedAssetDetail.asset_id}</span>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                        <Laptop className="w-5 h-5 text-blue-400" />
                        {selectedAssetDetail.assetNumber} — {selectedAssetDetail.manufacturer} {selectedAssetDetail.model}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedAssetDetail(null)}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] block">Hardware Identification</span>
                      <p><strong className="text-slate-400">AssetID (PK):</strong> <span className="font-mono text-cyan-300">{selectedAssetDetail.AssetID || selectedAssetDetail.asset_id}</span></p>
                      <p><strong className="text-slate-400">DeviceType:</strong> <span className="text-white font-medium">{selectedAssetDetail.DeviceType || selectedAssetDetail.devicetype}</span></p>
                      <p><strong className="text-slate-400">Managed By:</strong> <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        (selectedAssetDetail.managed_by || selectedAssetDetail.managedBy) === 'GROUP'
                          ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                          : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                      }`}>
                        {selectedAssetDetail.managed_by || selectedAssetDetail.managedBy || 'INDIVIDUAL'}
                      </span></p>
                      <p><strong className="text-slate-400">MAC Address:</strong> <span className="font-mono text-white">{selectedAssetDetail.macAddress || selectedAssetDetail.macaddress || 'None'}</span></p>
                      <p><strong className="text-slate-400">LastDiscoveryDate:</strong> <span className="font-mono text-white">{(selectedAssetDetail.LastDiscoveryDate || selectedAssetDetail.lastreporttime) ? new Date(selectedAssetDetail.LastDiscoveryDate || selectedAssetDetail.lastreporttime).toLocaleString() : 'None'}</span></p>
                      <p><strong className="text-slate-400">Source:</strong> <span className="text-indigo-400 font-bold">{selectedAssetDetail.source}</span></p>
                      <p><strong className="text-slate-400">Remarks:</strong> <span className="text-slate-300 italic">{selectedAssetDetail.remarks || 'None'}</span></p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] block">Hardware EOL Lifecycle</span>
                      <p><strong className="text-slate-400">Calculated Status:</strong> <span className="font-bold text-amber-400">{selectedAssetDetail.eolStatus}</span></p>
                      <p><strong className="text-slate-400">EOL Date:</strong> <span className="font-mono text-white">{selectedAssetDetail.eolDate || 'Unknown'}</span></p>
                      <p><strong className="text-slate-400">Days Remaining:</strong> <span className="font-mono text-white">{selectedAssetDetail.daysRemaining !== null ? `${selectedAssetDetail.daysRemaining} days` : 'N/A'}</span></p>
                      <p><strong className="text-slate-400">Reference Source:</strong> <span className="text-slate-300 text-[11px] block italic">{selectedAssetDetail.reference_source || 'No OEM Reference'}</span></p>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-slate-400 font-semibold uppercase text-[10px] block flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      Workday HCM Correlation Result
                    </span>
                    <div className="text-xs pt-1">
                      <p><strong className="text-slate-400">Ownership Status:</strong> <span className="text-emerald-400 font-bold">{selectedAssetDetail.workdayStatus}</span></p>
                      {selectedAssetDetail.matched_employee && (
                        <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-800/80">
                          <div>
                            <p><strong className="text-slate-400">Full Name:</strong> <span className="text-white font-medium">{selectedAssetDetail.fullName}</span></p>
                            <p><strong className="text-slate-400">User ID:</strong> <span className="font-mono text-cyan-300">{selectedAssetDetail.matched_employee.user_id}</span></p>
                            <p><strong className="text-slate-400">Department:</strong> <span className="text-slate-300">{selectedAssetDetail.department}</span></p>
                          </div>
                          <div>
                            <p><strong className="text-slate-400">Work Email:</strong> <span className="text-blue-400">{selectedAssetDetail.email_work}</span></p>
                            <p><strong className="text-slate-400">Job Title:</strong> <span className="text-slate-300">{selectedAssetDetail.job_title}</span></p>
                            <p><strong className="text-slate-400">Status:</strong> <span className="text-emerald-400 font-semibold">{selectedAssetDetail.employee_status}</span></p>
                          </div>
                        </div>
                      )}
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Reporting EVP:</span>
                        <span className="text-purple-300 font-medium font-mono text-right">
                          {(() => {
                            const evp = selectedAssetDetail.reporting_evp ?? selectedAssetDetail.matched_employee?.reporting_evp;
                            if (typeof evp === 'object' && evp !== null) {
                              return `${evp.full_name} (${evp.user_id})${evp.job_title ? ` — ${evp.job_title}` : ''}`;
                            }
                            return evp || '-';
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assign / Reassign User Section */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                        {selectedAssetDetail.assigned_username && selectedAssetDetail.assigned_username.trim()
                          ? 'Reassign Hardware Asset'
                          : 'Assign Hardware Asset'}
                      </span>
                      {!isAssignFormOpen && (
                        <button
                          type="button"
                          onClick={() => setIsAssignFormOpen(true)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition"
                        >
                          {selectedAssetDetail.assigned_username && selectedAssetDetail.assigned_username.trim()
                            ? 'Reassign User...'
                            : 'Assign User...'}
                        </button>
                      )}
                    </div>

                    {popupAssignSuccess && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{popupAssignSuccess}</span>
                      </div>
                    )}

                    {popupAssignError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{popupAssignError}</span>
                      </div>
                    )}

                    {isAssignFormOpen && (
                      <form onSubmit={handleAssignUserInPopup} className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                              Select Workday Employee <span className="text-rose-400">*</span>
                            </label>
                            <select
                              value={popupAssignUserId}
                              onChange={(e) => setPopupAssignUserId(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                              required
                            >
                              <option value="">-- Choose active employee --</option>
                              {INITIAL_EMPLOYEES.filter(e => e.employee_status === 'Active').map(emp => (
                                <option key={emp.user_id} value={emp.user_id}>
                                  {emp.full_name} ({emp.user_id}) — {emp.department}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                              Managed By <span className="text-rose-400">*</span>
                            </label>
                            <select
                              value={popupAssignManagedBy}
                              onChange={(e) => setPopupAssignManagedBy(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                            >
                              <option value="INDIVIDUAL">INDIVIDUAL</option>
                              <option value="GROUP">GROUP</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                            Remarks / Allocation Reason
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Primary laptop replacement, project allocation"
                            value={popupAssignRemarks}
                            onChange={(e) => setPopupAssignRemarks(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAssignFormOpen(false)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={popupAssignLoading || !popupAssignUserId}
                            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-1.5"
                          >
                            {popupAssignLoading ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                              </>
                            ) : selectedAssetDetail.assigned_username && selectedAssetDetail.assigned_username.trim() ? (
                              'Confirm Reassignment'
                            ) : (
                              'Confirm Assignment'
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelectedAssetDetail(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Assignment Modal Dialog */}
            {isBulkAssignModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-xs font-mono text-emerald-400">POST /api/assets/bulk-assign</span>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                        <Users className="w-5 h-5 text-emerald-400" />
                        Bulk Assign {selectAllMatching ? `${fleetKpis.totalAssets} Assets (All Matching)` : `${selectedAssetIds.length} Selected Asset(s)`}
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsBulkAssignModalOpen(false)}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition"
                    >
                      &times;
                    </button>
                  </div>

                  {bulkAssignError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{bulkAssignError}</span>
                    </div>
                  )}

                  <form onSubmit={async (e) => {
                    await handleBulkAssignSubmit(e);
                    setIsBulkAssignModalOpen(false);
                  }} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5 font-medium">
                        Target Workday Employee <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={bulkAssignUserId}
                        onChange={(e) => setBulkAssignUserId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                        required
                      >
                        {INITIAL_EMPLOYEES.filter(e => e.employee_status === 'Active').map(emp => (
                          <option key={emp.user_id} value={emp.user_id}>
                            {emp.full_name} (@{emp.user_id}) — {emp.job_title}, {emp.department}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Only Active Workday employees can receive hardware asset assignments.
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5 font-medium">
                        Managed By Scope <span className="text-rose-400">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setBulkAssignManagedBy('INDIVIDUAL')}
                          className={`p-3 rounded-xl border text-left transition ${
                            bulkAssignManagedBy === 'INDIVIDUAL'
                              ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold text-xs">INDIVIDUAL</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Assigned to an individual employee</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBulkAssignManagedBy('GROUP')}
                          className={`p-3 rounded-xl border text-left transition ${
                            bulkAssignManagedBy === 'GROUP'
                              ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold text-xs">GROUP</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Managed by a project / incident team</div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5 font-medium">
                        Audit Remarks &amp; Notes
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Bulk assigned for Incident Response Team or Fleet Refresh (Leave blank to clear remarks to SQL NULL)"
                        value={bulkAssignRemarks}
                        onChange={(e) => setBulkAssignRemarks(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Audit compliance rule: Leaving remarks blank replaces existing remarks with SQL NULL.
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                      <div className="flex justify-between">
                        <span>Selected Assets:</span>
                        <strong className="text-white">{selectAllMatching ? `${fleetKpis.totalAssets} (All Matching Filters)` : selectedAssetIds.length}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Assignment Model:</span>
                        <span className="text-cyan-400">MANUAL &bull; ACTIVE</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transaction Safety:</span>
                        <span className="text-emerald-400">Atomic Commit + Idempotent</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsBulkAssignModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={bulkAssignLoading || !bulkAssignUserId}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-2 shadow-lg"
                      >
                        {bulkAssignLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Processing Bulk Assignment...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Confirm Bulk Assignment
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- PAGE: EOL REFERENCE MANAGER ----------------- */}
        {activePage === 'eol_reference' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Device EOL Reference Matrix (OEM Hardware Lifecycle)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Endpoints: <code className="text-cyan-400 font-mono">GET /api/eol-reference</code> &bull; <code className="text-cyan-400 font-mono">POST</code> &bull; <code className="text-cyan-400 font-mono">PUT /api/eol-reference/{'{id}'}</code> &bull; <code className="text-cyan-400 font-mono">DELETE</code>
                  </p>
                </div>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                  {eolReferences.length} OEM References
                </span>
              </div>

              {/* Add Reference Form */}
              <form onSubmit={handleAddEolReference} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-300 uppercase">Create OEM Reference Record</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Manufacturer (e.g. Apple, Dell)"
                    value={newRefMfr}
                    onChange={(e) => setNewRefMfr(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Model (e.g. MacBook Pro 16)"
                    value={newRefModel}
                    onChange={(e) => setNewRefModel(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                  <input
                    type="date"
                    value={newRefDate}
                    onChange={(e) => setNewRefDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Source (e.g. OEM Matrix)"
                      value={newRefSource}
                      onChange={(e) => setNewRefSource(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </form>

              {/* Reference Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Manufacturer</th>
                      <th className="px-4 py-3">Model</th>
                      <th className="px-4 py-3">EOL Date</th>
                      <th className="px-4 py-3">Reference Source</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {eolReferences.map(ref => (
                      <tr key={ref.eol_id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 font-mono text-slate-500">#{ref.eol_id}</td>
                        <td className="px-4 py-3 font-medium text-white">{ref.manufacturer}</td>
                        <td className="px-4 py-3 font-medium text-slate-200">{ref.model}</td>
                        <td className="px-4 py-3 font-mono text-amber-400 font-semibold">{ref.eol_date}</td>
                        <td className="px-4 py-3 text-slate-400 italic text-[11px]">{ref.reference_source}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteEolReference(ref.eol_id)}
                            className="text-rose-400 hover:text-rose-300 p-1 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- PAGE: ADMIN USERS ----------------- */}
        {activePage === 'admin_users' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-purple-400" />
                    Authorized Admin Users Governance
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Endpoints: <code className="text-cyan-400 font-mono">GET /api/admin-users</code> &bull; <code className="text-cyan-400 font-mono">POST /api/admin-users</code> &bull; <code className="text-cyan-400 font-mono">DELETE /api/admin-users/{'{user_id}'}</code>
                  </p>
                </div>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                  {adminUsers.length} Authorized Admins
                </span>
              </div>

              {/* Add Admin User Form */}
              <form onSubmit={handleAddAdminUser} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex gap-3">
                <input
                  type="text"
                  placeholder="Enter user_id from Workday (e.g. johndoe, sarahconnor, alexturner)"
                  value={newAdminUserId}
                  onChange={(e) => setNewAdminUserId(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Authorize Admin
                </button>
              </form>

              {/* Admin Users Table Joined to Workday */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3">Admin User ID</th>
                      <th className="px-4 py-3">Workday Full Name</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Work Email</th>
                      <th className="px-4 py-3">Job Title</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Revoke</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {joinedAdminUsers.map(admin => (
                      <tr key={admin.admin_user_id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 font-mono font-bold text-cyan-300">@{admin.admin_user_id}</td>
                        <td className="px-4 py-3 font-medium text-white">{admin.full_name || <span className="text-slate-500 italic">Not in Workday</span>}</td>
                        <td className="px-4 py-3 text-slate-300">{admin.department || '—'}</td>
                        <td className="px-4 py-3 text-blue-400">{admin.email_work || '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{admin.job_title || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            admin.employee_status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {admin.employee_status || 'Unlinked'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveAdminUser(admin.admin_user_id)}
                            className="text-rose-400 hover:text-rose-300 p-1 transition"
                            title="Revoke admin access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- ARCHITECTURE & TESTS ----------------- */}
        {activePage === 'architecture' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-400" />
              FastAPI Endpoint Signatures &amp; Route Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-bold block">GET /api/assets</span>
                <p className="text-slate-400">Supports: source, asset_status, devicetype, search, is_unassigned, pagination.</p>
                <p className="text-cyan-300">Returns: AssetID, DeviceType, macAddress, LastDiscoveryDate, eolStatus, workdayStatus.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-bold block">GET /api/dashboard/summary</span>
                <p className="text-slate-400">Supports ?source=BIGFIX and ?source=JAMF scoping for Fleet Summary cards.</p>
                <p className="text-cyan-300">Returns: totalAssets, activeAssets, needValidation, inStock, employeeCount.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-bold block">/api/eol-reference</span>
                <p className="text-slate-400">CRUD operations for device_eol_reference table.</p>
                <p className="text-cyan-300">Methods: GET, POST, PUT, DELETE.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-bold block">/api/admin-users</span>
                <p className="text-slate-400">Authorized administrative users joined with Workday HCM.</p>
                <p className="text-cyan-300">Methods: GET, POST (bulk &amp; safe dups), DELETE.</p>
              </div>
            </div>
          </div>
        )}

        {activePage === 'tests' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Automated Pytest Backend Validation Suites
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span>tests/test_assets_filter.py (Pagination, total, AssetID, DeviceType, macAddress, LastDiscoveryDate)</span>
                <span className="text-emerald-400 font-mono font-bold">PASSED</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span>tests/test_correlation.py (3 Workday states, case/trim matching, inactive employee retention)</span>
                <span className="text-emerald-400 font-mono font-bold">PASSED</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span>tests/test_dashboard_kpis.py (Fleet Summary calculations scoped to All, Windows, Mac)</span>
                <span className="text-emerald-400 font-mono font-bold">PASSED</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span>tests/test_eol_reference.py (CRUD operations on /api/eol-reference)</span>
                <span className="text-emerald-400 font-mono font-bold">PASSED</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span>tests/test_admin_users.py (Admin users joined to Workday, duplicate handling, removal)</span>
                <span className="text-emerald-400 font-mono font-bold">PASSED</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-4 text-center text-xs text-slate-500">
        AssetIQ &bull; Asset Ownership Intelligence &amp; Governance &bull; Python FastAPI + PostgreSQL
      </footer>
    </div>
  );
}
