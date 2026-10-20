import React, { useState } from 'react';
import {
  Server,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Database,
  Check,
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
  const [isTesting, setIsTesting] = useState(false);

  const handleSaveUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateApiBaseUrl(inputUrl);
    setSaveMessage('Backend URL updated. Re-testing connectivity...');
    setTimeout(() => {
      refreshHealth();
      setSaveMessage(null);
    }, 1200);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    await refreshHealth();
    setTimeout(() => {
      setIsTesting(false);
    }, 400);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 max-w-6xl mx-auto pb-10 items-stretch">
      {/* Panel 1 (Left Column): Operating Mode */}
      <div className="p-5 sm:p-6 bg-white rounded-lg border border-slate-200 shadow-2xs flex flex-col">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Operating Mode
            </h3>
          </div>
          <span
            className={`text-[11px] px-2.5 py-0.5 rounded font-medium ${
              mockMode
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {mockMode ? 'Mock Data Mode Active' : 'Live Backend Mode Active'}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 justify-center">
          <button
            type="button"
            onClick={() => setMockMode(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
              !mockMode
                ? 'bg-white text-emerald-700 font-semibold shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Backend Mode
          </button>

          <button
            id="operating-mode-toggle"
            type="button"
            role="switch"
            aria-checked={mockMode}
            onClick={() => setMockMode(!mockMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
              mockMode ? 'bg-blue-600' : 'bg-slate-300'
            }`}
            title={mockMode ? 'Switch to Live Backend Mode' : 'Switch to Mock Data Mode'}
          >
            <span className="sr-only">Switch Operating Mode</span>
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                mockMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setMockMode(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
              mockMode
                ? 'bg-white text-blue-700 font-semibold shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mock Data Mode
          </button>
        </div>
      </div>

      {/* Panel 2 (Right Column): FastAPI Backend Connection */}
      <div className="p-5 sm:p-6 bg-white rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                FastAPI Backend Connection
              </h3>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isTesting ? 'Testing...' : 'Test Connection (/health)'}</span>
            </button>
          </div>

          {/* URL Configuration Input */}
          <form onSubmit={handleSaveUrl} className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="api-url-input" className="text-xs font-medium text-slate-700">
                API Base URL
              </label>
              {inputUrl && inputUrl !== import.meta.env.VITE_API_BASE_URL && (
                <button
                  type="button"
                  onClick={() => {
                    const defaultUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
                    setInputUrl(defaultUrl);
                    updateApiBaseUrl(defaultUrl);
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Reset to default URL
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="api-url-input"
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                placeholder={
                  import.meta.env.VITE_API_BASE_URL ||
                  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                    ? 'http://localhost:8000'
                    : 'https://your-fastapi-backend.run.app')
                }
                className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                Apply URL
              </button>
            </div>
            {saveMessage && (
              <p className="text-xs text-blue-600 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{saveMessage}</span>
              </p>
            )}
          </form>
        </div>

        {/* Health status block */}
        <div className="p-4 bg-slate-50/80 rounded-lg border border-slate-200/80 space-y-3 mt-auto">
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
                <span className="text-blue-600 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Pinging backend...
                </span>
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
              <span className="text-slate-500">EOL Warning Threshold:</span>
              <span className="font-mono text-slate-800 font-semibold">
                {health.data.eol_warning_threshold_days} days
              </span>
            </div>
          )}

          {health.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 font-mono break-all">
              {health.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
