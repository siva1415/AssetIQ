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
} from 'lucide-react';
import {
  DashboardSummary,
  AssetsBySourceItem,
  OwnershipSummaryItem,
  EOLSummaryItem,
  OperationalStatusItem,
  DepartmentDistributionItem,
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
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { dataRefreshKey } = useApp();

  // Data states
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sourceData, setSourceData] = useState<AssetsBySourceItem[]>([]);
  const [sourceLoading, setSourceLoading] = useState<boolean>(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [ownershipData, setOwnershipData] = useState<OwnershipSummaryItem[]>([]);
  const [eolData, setEolData] = useState<EOLSummaryItem[]>([]);
  const [statusData, setStatusData] = useState<OperationalStatusItem[]>([]);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deptData, setDeptData] = useState<DepartmentDistributionItem[]>([]);
  const [deptLoading, setDeptLoading] = useState<boolean>(true);
  const [deptError, setDeptError] = useState<string | null>(null);

  // Page state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSourceData = async () => {
    setSourceLoading(true);
    setSourceError(null);
    try {
      const res = await api.getAssetsBySource();
      setSourceData(res);
    } catch (err: any) {
      console.error('[Dashboard] Failed to fetch assets by source summary:', {
        name: err?.name,
        message: err?.message,
        status: err?.status || err?.response?.status,
        url: err?.url,
      });
      setSourceError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load source summary from backend API.'
      );
    } finally {
      setSourceLoading(false);
    }
  };

  const fetchDepartmentData = async () => {
    setDeptLoading(true);
    setDeptError(null);
    try {
      const res = await api.getDepartmentDistribution();
      setDeptData(res);
    } catch (err: any) {
      setDeptError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load department summary from backend API.'
      );
    } finally {
      setDeptLoading(false);
    }
  };

  const fetchOperationalStatusData = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await api.getOperationalStatusSummary();
      setStatusData(res);
    } catch (err: any) {
      console.error('[Dashboard] Failed to fetch operational status summary:', {
        name: err?.name,
        message: err?.message,
        status: err?.status || err?.response?.status,
        url: err?.url,
      });
      setStatusError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load operational status summary from backend API.'
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    // Fetch source, department and operational status summaries independently to prevent failures from crashing the entire Dashboard
    fetchSourceData();
    fetchDepartmentData();
    fetchOperationalStatusData();

    try {
      // Parallel fetch of core dashboard endpoints
      const [sumRes, ownRes, eolRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getOwnershipSummary(),
        api.getEOLSummary(),
      ]);

      setSummary(sumRes);
      setOwnershipData(ownRes);
      setEolData(eolRes);
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
  }, [dataRefreshKey]);

  return (
    <div className="space-y-6">
      {/* Error state if FastAPI fails */}
      {error && <ErrorState error={error} onRetry={fetchDashboardData} />}

      {/* Loading state */}
      {loading && !error && (
        <LoadingState message="Aggregating metrics across BigFix, Jamf, and Workday..." rows={6} />
      )}

      {/* Main Content when loaded */}
      {!loading && !error && summary && (
        <>
          {/* 10 Compact KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
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
              label="Review"
              value={summary.review ?? summary.need_validation}
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

          {/* 5 Enterprise Analytics Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SourceChart
              data={sourceData}
              loading={sourceLoading}
              error={sourceError}
              onRetry={fetchSourceData}
            />
            <OwnershipChart data={ownershipData} />
            <StatusChart
              data={statusData}
              loading={statusLoading}
              error={statusError}
              onRetry={fetchOperationalStatusData}
            />
            <EOLChart data={eolData} />
            <div className="md:col-span-2 lg:col-span-2">
              <DepartmentChart
                data={deptData}
                loading={deptLoading}
                error={deptError}
                onRetry={fetchDepartmentData}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
