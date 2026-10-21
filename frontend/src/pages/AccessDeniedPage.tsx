import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft, Home, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AccessDeniedPage: React.FC<{ attemptedPath?: string }> = ({ attemptedPath }) => {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-7 h-7" />
        </div>

        <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold tracking-wider uppercase mb-2">
          403 Forbidden
        </span>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Access Denied
        </h1>

        <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed max-w-md mx-auto">
          You do not have permission to access {attemptedPath ? <code className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{attemptedPath}</code> : 'this page'}. Your current portal role is <span className="font-semibold text-slate-800 underline decoration-blue-500 decoration-2">{currentUser.role}</span>.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
