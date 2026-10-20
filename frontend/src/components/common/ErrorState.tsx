import React from 'react';
import { AlertCircle, RefreshCw, ToggleLeft, WifiOff, ServerCrash, FileQuestion } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ErrorStateProps {
  error: string | Error;
  onRetry?: () => void;
  title?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  title = 'API Request Failed',
}) => {
  const { mockMode, setMockMode, apiBaseUrl } = useApp();
  const errorMessage = error instanceof Error ? error.message : String(error);

  const isNetworkFailure = errorMessage.includes('[Network Failure]');
  const isHttpError = errorMessage.includes('[HTTP');
  const isInvalidData = errorMessage.includes('[Invalid Response Data]');

  return (
    <div className="p-6 bg-white rounded-lg border border-rose-200">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-rose-50 text-rose-600 shrink-0 mt-0.5">
          {isNetworkFailure ? (
            <WifiOff className="w-5 h-5 text-rose-600" />
          ) : isHttpError ? (
            <ServerCrash className="w-5 h-5 text-rose-600" />
          ) : isInvalidData ? (
            <FileQuestion className="w-5 h-5 text-amber-600" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-rose-950">{title}</h3>
            {isNetworkFailure && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-800 rounded">
                Network Failure
              </span>
            )}
            {isHttpError && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 rounded">
                HTTP Error
              </span>
            )}
            {isInvalidData && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-800 rounded">
                Invalid Data Schema
              </span>
            )}
          </div>

          <p className="text-sm text-slate-800 font-mono text-xs bg-rose-50/60 p-2.5 rounded border border-rose-100 mb-3 break-all leading-relaxed">
            {errorMessage}
          </p>

          <div className="text-xs text-slate-600 mb-4 space-y-1.5 bg-slate-50 p-3 rounded border border-slate-200">
            <p>
              <span className="font-semibold text-slate-700">Target API Base URL: </span>
              <span className="font-mono text-blue-700 font-semibold">
                {apiBaseUrl || '(None configured — set VITE_API_BASE_URL)'}
              </span>
            </p>
            {isNetworkFailure && (
              <div className="text-slate-500 space-y-0.5 text-[11px] pt-1 border-t border-slate-200">
                <p>• Verify the FastAPI service is running and accessible at the URL above.</p>
                <p>• In HTTPS environments (e.g. Cloud preview), use an HTTPS backend URL to avoid browser Mixed Content blocking.</p>
                <p>• Ensure CORS allows requests from this origin in FastAPI <code className="font-mono bg-slate-100 px-1 rounded">CORSMiddleware</code>.</p>
              </div>
            )}
            {isHttpError && (
              <div className="text-slate-500 space-y-0.5 text-[11px] pt-1 border-t border-slate-200">
                <p>• The backend was reached but returned an HTTP status error code.</p>
                <p>• Check FastAPI server logs for route handling or authorization exceptions.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Request</span>
              </button>
            )}

            {!mockMode && (
              <button
                onClick={() => setMockMode(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors"
              >
                <ToggleLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Switch to Mock Data Mode (Preview)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
