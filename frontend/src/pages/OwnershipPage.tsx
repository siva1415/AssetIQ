import React from 'react';
import { AssetTable } from '../components/assets/AssetTable';

export const OwnershipPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <AssetTable showKPICards={true} />
    </div>
  );
};
