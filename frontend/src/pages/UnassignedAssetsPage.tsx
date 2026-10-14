import React from 'react';
import { PackageMinus, Warehouse, CheckCircle2 } from 'lucide-react';
import { AssetTable } from '../components/assets/AssetTable';

export const UnassignedAssetsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-4 bg-white rounded-lg border border-slate-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0 mt-0.5">
            <PackageMinus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Unassigned Endpoints &amp; Inventory Spares
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Discovered hardware not currently bound to any active employee identity. Includes shelf stock, pending re-imaging pools, loaner laptops, and unallocated datacenter hosts.
            </p>
          </div>
        </div>
      </div>

      <AssetTable
        initialAssignmentFilter="Unassigned"
        title="Unassigned Endpoints"
        subtitle="Assets without an active employee assignment in the governance directory"
      />
    </div>
  );
};
