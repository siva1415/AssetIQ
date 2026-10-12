import React from 'react';
import { AssetTable } from '../components/assets/AssetTable';

export const MacAssetsPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <AssetTable
        initialSourceFilter="JAMF"
        hideSourceFilter={true}
        showKPICards={true}
      />
    </div>
  );
};
