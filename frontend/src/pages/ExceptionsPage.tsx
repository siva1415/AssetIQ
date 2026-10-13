import React, { useState } from 'react';
import { AlertTriangle, UserX, ShieldAlert, FileWarning, CheckCircle } from 'lucide-react';
import { AssetTable } from '../components/assets/AssetTable';
import { ASSET_STATUSES } from '../types';

export const ExceptionsPage: React.FC = () => {
  const [activeExceptionTab, setActiveExceptionTab] = useState<'review' | 'not_in_workday' | 'admin_accounts'>('review');

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="p-4 bg-white rounded-lg border border-amber-200 bg-amber-50/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Governance Exceptions &amp; Audit Flags
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Automated anomaly detection identifies endpoints with policy discrepancies, such as orphan logins not present in Workday, interactive use of root/service accounts, or hardware linked to terminated personnel.
            </p>
          </div>
        </div>
      </div>

      {/* Exception Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/60 rounded-lg max-w-full">
        <button
          onClick={() => setActiveExceptionTab('review')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeExceptionTab === 'review'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileWarning className="w-3.5 h-3.5 text-amber-600" />
          <span>Review (Fleet Flagged)</span>
        </button>

        <button
          onClick={() => setActiveExceptionTab('not_in_workday')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeExceptionTab === 'not_in_workday'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserX className="w-3.5 h-3.5 text-rose-600" />
          <span>User IDs Not in Workday</span>
        </button>

        <button
          onClick={() => setActiveExceptionTab('admin_accounts')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeExceptionTab === 'admin_accounts'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
          <span>Administrator &amp; Service Accounts</span>
        </button>
      </div>

      {/* Tables based on tab */}
      {activeExceptionTab === 'review' && (
        <AssetTable
          initialStatusFilter={ASSET_STATUSES.REVIEW}
          title="Assets Under Governance Review"
          subtitle="Devices flagged due to stale telemetry, terminated employee custodians, or unverified hardware"
        />
      )}

      {activeExceptionTab === 'not_in_workday' && (
        <AssetTable
          title="Discovered Usernames Missing from Corporate HR (Workday)"
          subtitle="Contractor logins, temporary credentials, or mistyped accounts without corresponding employee records"
        />
      )}

      {activeExceptionTab === 'admin_accounts' && (
        <AssetTable
          title="Hardware Discovered with Privileged Accounts"
          subtitle="Servers and workstations reporting service, root, or administrative logins"
        />
      )}
    </div>
  );
};
