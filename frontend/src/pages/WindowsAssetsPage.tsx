import React from 'react';
import { AssetTable } from '../components/assets/AssetTable';

export const WindowsAssetsPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <AssetTable
        initialSourceFilter="BIGFIX"
        hideSourceFilter={true}
        showKPICards={true}
      />
    </div>
  );
};
