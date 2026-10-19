import React from 'react';
import { AssetTable } from '../components/assets/AssetTable';

export const MacAssetsPage: React.FC = () => {
  return (
    <div className="space-y-4 w-full min-w-0">
      <AssetTable
        initialSourceFilter="JAMF"
        hideSourceFilter={true}
        showKPICards={true}
        exportFilenamePrefix="AssetIQ_Mac_Assets"
      />
    </div>
  );
};
