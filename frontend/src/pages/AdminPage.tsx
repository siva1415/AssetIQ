import React, { useState } from 'react';
import {
  Settings,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  Clock,
  Terminal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AdminPage: React.FC = () => {
  const {
    mockMode,
    setMockMode,
    apiBaseUrl,
    updateApiBaseUrl,
    health,
    refreshHealth,
  } = useApp();

  const [inputUrl, setInputUrl] = useState(apiBaseUrl);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSaveUrl = () => {
    updateApiBaseUrl(inputUrl);
    setSaveMessage('Backend URL updated. Testing connectivity...');
    setTimeout(() => {
      refreshHealth();
      setSaveMessage(null);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="p-4 bg-white rounded-lg border border-slate-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0 mt-0.5">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Administration &amp; Platform Settings
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              API connectivity diagnostics, telemetry synchronizers, and runtime environment settings
            </p>
          </div>
        </div>
      </div>

      {/* Backend Mode & Mock Preview Switch */}
      <div className="p-5 bg-white rounded-lg border border-slate-200 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Operating Mode</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  mockMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {mockMode ? 'Mock Data Mode' : 'Live API Mode'}
              </span>
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-xl">
              Switch between offline simulated dataset preview and real FastAPI server calls. When Live mode is enabled, the UI communicates directly with your Python backend via REST endpoints.
            </p>
          </div>

          <button
            onClick={() => setMockMode(!mockMode)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs transition-all shrink-0 ${
              mockMode
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-2xs'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
            }`}
          >
            {mockMode ? (
              <>
                <ToggleRight className="w-4 h-4" />
                <span>Switch to Live FastAPI</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4" />
                <span>Switch to Mock Data</span>
              </>
            )}
          </button>
        </div>

        {mockMode && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Mock mode is active. Comprehensive sample data is generated dynamically in memory. No network requests are sent to FastAPI.
            </span>
          </div>
        )}
      </div>

      {/* API Connectivity & Health Check */}
      <div className="p-5 bg-white rounded-lg border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            <span>FastAPI Backend Connection</span>
          </h3>

          <button
            onClick={() => refreshHealth()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Test Connection (/health)</span>
          </button>
        </div>

        {/* URL Configuration Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">API Base URL</label>
            {inputUrl && inputUrl !== import.meta.env.VITE_API_BASE_URL && (
              <button
                type="button"
                onClick={() => {
                  const defaultUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
                  setInputUrl(defaultUrl);
                  updateApiBaseUrl(defaultUrl);
                }}
                className="text-[11px] text-blue-600 hover:text-blue-800 underline"
              >
                Reset to VITE_API_BASE_URL default
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder={
                import.meta.env.VITE_API_BASE_URL ||
                (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                  ? 'http://localhost:8000'
                  : 'https://your-fastapi-backend.run.app')
              }
              className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveUrl}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors"
            >
              Apply URL
            </button>
          </div>
          {saveMessage && <p className="text-xs text-blue-600">{saveMessage}</p>}
        </div>

        {/* Health status block */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Connection Status:</span>
            <div className="flex items-center gap-1.5 font-semibold">
              {health.status === 'connected' || health.status === 'mock' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">
                    {health.status === 'mock' ? 'Mock Simulation Online' : 'Connected to FastAPI'}
                  </span>
                </>
              ) : health.status === 'checking' ? (
                <span className="text-blue-600">Pinging backend...</span>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span className="text-rose-700">Offline / Unreachable</span>
                </>
              )}
            </div>
          </div>

          {health.latencyMs !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Round-trip Latency:</span>
              <span className="font-mono text-slate-800 font-bold tabular-nums">
                {health.latencyMs} ms
              </span>
            </div>
          )}

          {health.data?.last_sync && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Last Telemetry Synchronization:</span>
              <span className="font-mono text-slate-800">
                {new Date(health.data.last_sync).toLocaleString()}
              </span>
            </div>
          )}

          {health.data?.eol_warning_threshold_days !== undefined && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">EOL Warning Threshold (Configured):</span>
              <span className="font-mono text-slate-800 font-semibold">
                {health.data.eol_warning_threshold_days} days
              </span>
            </div>
          )}

          {health.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-mono break-all">
              {health.error}
            </div>
          )}
        </div>
      </div>

      {/* Collector Integrations Status */}
      <div className="p-5 bg-white rounded-lg border border-slate-200 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Synchronizer Feeds &amp; Connectors</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-1">BigFix Connector</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{health.data?.bigfix_status || 'Sync Active (14m ago)'}</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Windows &amp; Linux Discovery</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-1">Jamf Pro Cloud</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{health.data?.jamf_status || 'Sync Active (18m ago)'}</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">macOS Mobile Device Mgmt</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-1">Workday HCM Directory</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{health.data?.workday_status || 'Daily Delta Active'}</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Personnel &amp; Cost Centers</span>
          </div>
        </div>
      </div>

      {/* Application Specs */}
      <div className="p-5 bg-white rounded-lg border border-slate-200 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Application Information</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Application</span>
            <span className="font-semibold text-slate-900">AssetIQ Enterprise</span>
          </div>
          <div>
            <span className="text-slate-500 block">Version</span>
            <span className="font-mono text-slate-900">{health.data?.version || '2.4.1'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Environment</span>
            <span className="font-medium text-slate-900">React 19 + TypeScript + Vite</span>
          </div>
          <div>
            <span className="text-slate-500 block">Styling System</span>
            <span className="font-medium text-slate-900">Tailwind CSS</span>
          </div>
        </div>
      </div>

      {/* Troubleshooting guide */}
      <div className="p-5 bg-slate-50 rounded-lg border border-slate-200 space-y-3 text-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-600" />
          <span>FastAPI &amp; CORS Troubleshooting Guide</span>
        </h3>
        <p className="text-slate-600 leading-relaxed">
          If live API requests fail while your FastAPI backend is running:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 text-slate-700">
          <li>
            Verify that your FastAPI service is running and reachable at the target API base URL (for local development: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">uvicorn main:app --reload --port 8000</code>).
          </li>
          <li>
            Ensure FastAPI enables <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">CORSMiddleware</code> with <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">allow_origins=["*"]</code> or your frontend origin.
          </li>
          <li>
            Check that the endpoints match the contract: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">/health</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">/api/dashboard/summary</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">/api/assets</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">/api/employees</code>, and <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">/api/eol</code>.
          </li>
        </ol>
      </div>
    </div>
  );
};
