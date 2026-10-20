import React from 'react';

interface LoadingStateProps {
  message?: string;
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  rows = 5,
}) => {
  return (
    <div className="w-full p-6 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-slate-700">{message}</span>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-9 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
};
