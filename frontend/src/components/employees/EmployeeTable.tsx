import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  Eye,
  Laptop,
} from 'lucide-react';
import { Employee, EmployeeQueryParams, Asset } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer';
import { AssetDetailDrawer } from '../assets/AssetDetailDrawer';

export const EmployeeTable: React.FC = () => {
  const { dataRefreshKey } = useApp();

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [division, setDivision] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState('');
  const [sortBy, setSortBy] = useState('full_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected drawers
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedAssetForInspection, setSelectedAssetForInspection] = useState<Asset | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: EmployeeQueryParams = {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        department: department || undefined,
        division: division || undefined,
        employee_status: employeeStatus || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      const response = await api.getEmployees(params);
      setEmployees(response.items);
      setTotalCount(response.total);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch employee directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [page, search, department, division, employeeStatus, sortBy, sortOrder, dataRefreshKey]);

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
    setDepartment('');
    setDivision('');
    setEmployeeStatus('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || department || division || employeeStatus);

  // Export CSV
  const handleExportCSV = () => {
    if (employees.length === 0) return;

    const headers = [
      'Employee ID',
      'User ID',
      'Full Name',
      'Work Email',
      'Department',
      'Division',
      'Job Title',
      'Employee Status',
      'Manager Username',
      'Manager Name',
      'Location',
      'Hire Date',
      'Assigned Assets Count',
    ];

    const rows = employees.map(e => [
      e.employee_id,
      e.user_id,
      `"${e.full_name}"`,
      `"${e.work_email}"`,
      `"${e.department}"`,
      `"${e.division}"`,
      `"${e.job_title}"`,
      e.employee_status,
      e.manager_username || '',
      `"${e.manager_name || ''}"`,
      `"${e.location}"`,
      e.hire_date,
      e.assigned_assets_count || 0,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AssetIQ_Employee_Directory_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Users Management &amp; Directory</h2>
          <p className="text-xs text-slate-500">
            Authoritative identity records and hardware device ownership mapping
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={employees.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Users CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, user ID, email, title, department..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={department}
              onChange={e => {
                setDepartment(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Finance">Finance</option>
              <option value="Marketing">Marketing</option>
              <option value="Sales">Sales</option>
              <option value="Product">Product</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Security & Compliance">Security & Compliance</option>
              <option value="Executive">Executive</option>
            </select>

            <select
              value={employeeStatus}
              onChange={e => {
                setEmployeeStatus(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="">All Employment Statuses</option>
              <option value="Active">Active</option>
              <option value="Terminated">Terminated</option>
              <option value="On Leave">On Leave</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      {error ? (
        <ErrorState error={error} onRetry={fetchEmployees} />
      ) : loading ? (
        <LoadingState message="Loading directory profiles from Workday connector..." rows={8} />
      ) : employees.length === 0 ? (
        <EmptyState
          title="No employees found"
          description="No employee records match your search query."
          actionLabel={hasActiveFilters ? 'Reset Filters' : undefined}
          onAction={handleClearFilters}
        />
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs w-full">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold select-none">
                <tr>
                  <th
                    onClick={() => handleSort('full_name')}
                    className="w-[15%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Employee / ID</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('user_id')}
                    className="w-[9%] py-2.5 px-2 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>User ID</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>
                  <th className="w-[18%] py-2.5 px-2">Job Title &amp; Dept</th>
                  <th className="w-[16%] py-2.5 px-2">Work Email</th>
                  <th className="w-[9%] py-2.5 px-2">Status</th>
                  <th className="w-[12%] py-2.5 px-2">Manager</th>
                  <th className="w-[11%] py-2.5 px-2">Location</th>
                  <th className="w-[5%] py-2.5 px-2 text-center">Devices</th>
                  <th className="w-[5%] py-2.5 px-2 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {employees.map(emp => (
                  <tr
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-2 align-middle">
                      <div className="font-semibold text-slate-900 break-words leading-tight">{emp.full_name}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">{emp.employee_id}</div>
                    </td>

                    <td className="py-2.5 px-2 font-mono font-medium text-slate-800 break-all align-middle">
                      {emp.user_id}
                    </td>

                    <td className="py-2.5 px-2 align-middle">
                      <div className="font-medium text-slate-900 break-words leading-tight">{emp.job_title}</div>
                      <div className="text-[10px] text-slate-500 break-words leading-tight mt-0.5">{emp.department} · {emp.division}</div>
                    </td>

                    <td className="py-2.5 px-2 font-mono text-slate-700 break-all align-middle text-[11px] leading-tight">
                      {emp.work_email}
                    </td>

                    <td className="py-2.5 px-2 align-middle">
                      <StatusBadge status={emp.employee_status} />
                    </td>

                    <td className="py-2.5 px-2 align-middle">
                      <span className="text-slate-800 break-words leading-tight block">{emp.manager_name || '—'}</span>
                    </td>

                    <td className="py-2.5 px-2 text-slate-600 align-middle">
                      <span className="break-words leading-tight block">{emp.location}</span>
                    </td>

                    <td className="py-2.5 px-2 text-center align-middle">
                      <span
                        className={`inline-flex items-center justify-center font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                          (emp.assigned_assets_count || 0) > 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {emp.assigned_assets_count || 0}
                      </span>
                    </td>

                    <td className="py-2.5 px-2 text-right align-middle">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedEmployee(emp);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 shrink-0"
                        title="View Profile and Assigned Hardware"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
            <div className="text-slate-500">
              Showing <span className="font-semibold text-slate-800">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(page * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-slate-800 font-mono tabular-nums">{totalCount}</span> employees
            </div>

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
                <span className="font-mono tabular-nums">{totalPages}</span>
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                className="p-1.5 border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Detail Drawer */}
      <EmployeeDetailDrawer
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        onSelectAsset={asset => setSelectedAssetForInspection(asset)}
      />

      {/* Asset Inspection Drawer if clicked from inside Employee Drawer */}
      <AssetDetailDrawer
        asset={selectedAssetForInspection}
        onClose={() => setSelectedAssetForInspection(null)}
      />
    </div>
  );
};
