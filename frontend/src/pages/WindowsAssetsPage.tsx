import React from 'react';
import { AssetTable } from '../components/assets/AssetTable';

export const WindowsAssetsPage: React.FC = () => {
  return (
    <div className="space-y-4 w-full min-w-0">
      <AssetTable
        initialSourceFilter="BIGFIX"
        hideSourceFilter={true}
        showKPICards={true}
        exportFilenamePrefix="AssetIQ_Windows_Assets"
      />
    </div>
  );
};
