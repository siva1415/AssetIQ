import React from 'react';
import { AssetTable } from '../components/assets/AssetTable';

export const OwnershipPage: React.FC = () => {
  return (
    <div className="space-y-4 w-full min-w-0">
      <AssetTable showKPICards={true} allowAssignment={true} />
    </div>
  );
};
