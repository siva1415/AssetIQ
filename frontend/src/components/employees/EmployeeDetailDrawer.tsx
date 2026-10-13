import React from 'react';
import { X, User, Mail, Briefcase, MapPin, Calendar, Laptop, Monitor, AlertCircle } from 'lucide-react';
import { Employee, Asset } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { DeviceTypeIcon } from '../common/DeviceTypeIcon';

interface EmployeeDetailDrawerProps {
  employee: Employee | null;
  onClose: () => void;
  onSelectAsset?: (asset: Asset) => void;
}

export const EmployeeDetailDrawer: React.FC<EmployeeDetailDrawerProps> = ({
  employee,
  onClose,
  onSelectAsset,
}) => {
  if (!employee) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                {employee.full_name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{employee.full_name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>{employee.user_id}</span>
                  <span>·</span>
                  <span>{employee.employee_id}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status & Department banner */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block">Workday Employment Status</span>
                <StatusBadge status={employee.employee_status} />
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Department / Division</span>
                <span className="font-semibold text-slate-900">
                  {employee.department} · {employee.division}
                </span>
              </div>
            </div>

            {/* Profile Fields */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Corporate Directory Record
              </h3>
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" /> Job Title
                  </span>
                  <span className="text-slate-900 font-medium">{employee.job_title}</span>
                </div>

                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Work Email
                  </span>
                  <span className="text-slate-900 font-mono">{employee.work_email}</span>
                </div>

                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Reporting Manager
                  </span>
                  <span className="text-slate-900 font-medium">
                    {employee.manager_name ? `${employee.manager_name} (${employee.manager_username})` : 'Executive / None'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Primary Location
                  </span>
                  <span className="text-slate-900">{employee.location}</span>
                </div>

                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Hire Date
                  </span>
                  <span className="text-slate-900 font-mono">{employee.hire_date}</span>
                </div>
              </div>
            </div>

            {/* Assigned Devices (Asset-to-Employee Match) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Attributed Devices ({employee.assigned_assets?.length || 0})
                </h3>
                <span className="text-[11px] text-slate-500">Based on telemetry match</span>
              </div>

              {!employee.assigned_assets || employee.assigned_assets.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs text-slate-500">
                  No active devices are currently associated with user ID <span className="font-mono font-bold text-slate-700">{employee.user_id}</span>.
                </div>
              ) : (
                <div className="space-y-3">
                  {employee.assigned_assets.map(asset => (
                    <div
                      key={asset.id}
                      onClick={() => onSelectAsset && onSelectAsset(asset)}
                      className={`p-3.5 bg-white rounded-lg border border-slate-200 hover:border-blue-400 transition-colors shadow-2xs ${
                        onSelectAsset ? 'cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <DeviceTypeIcon type={asset.devicetype || asset.device_type} className="w-4 h-4 shrink-0" />
                          <div>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {asset.asset_number}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-2 font-mono">
                              SN: {asset.serial_number}
                            </span>
                          </div>
                        </div>

                        <StatusBadge status={asset.asset_status} type="asset_status" />
                      </div>

                      <div className="text-xs text-slate-700 font-medium mb-1">
                        {asset.manufacturer} · {asset.model}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span>Source: <strong className="text-slate-700">{asset.source}</strong></span>
                        <span>·</span>
                        <span>OS: <span className="text-slate-700">{asset.os_name}</span></span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <span>EOL:</span>
                          <StatusBadge status={asset.eol_status || 'UNKNOWN'} type="eol_status" />
                        </span>
                      </div>

                      {employee.employee_status === 'Terminated' && (
                        <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Device assigned to a terminated employee. Pending IT reclamation.</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
