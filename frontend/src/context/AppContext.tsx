import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, getApiBaseUrl, getInitialMockMode, setStoredApiBaseUrl, setStoredMockMode } from '../services/api';
import { HealthResponse } from '../types';

interface HealthState {
  status: 'checking' | 'connected' | 'disconnected' | 'mock';
  data: HealthResponse | null;
  error: string | null;
  latencyMs: number | null;
  lastChecked: Date | null;
}

interface AppContextType {
  mockMode: boolean;
  setMockMode: (val: boolean) => void;
  apiBaseUrl: string;
  updateApiBaseUrl: (url: string) => void;
  health: HealthState;
  refreshHealth: () => Promise<void>;
  dataRefreshKey: number;
  triggerDataRefresh: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mockMode, setMockModeState] = useState<boolean>(getInitialMockMode);
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(getApiBaseUrl);
  const [dataRefreshKey, setDataRefreshKey] = useState<number>(0);
  const [health, setHealth] = useState<HealthState>({
    status: 'checking',
    data: null,
    error: null,
    latencyMs: null,
    lastChecked: null,
  });

  const setMockMode = (val: boolean) => {
    setMockModeState(val);
    setStoredMockMode(val);
    api.setMock(val);
    setDataRefreshKey(prev => prev + 1);
  };

  const updateApiBaseUrl = (url: string) => {
    setStoredApiBaseUrl(url);
    const resolved = getApiBaseUrl();
    setApiBaseUrlState(resolved);
    setDataRefreshKey(prev => prev + 1);
  };

  const triggerDataRefresh = () => {
    setDataRefreshKey(prev => prev + 1);
  };

  const refreshHealth = useCallback(async () => {
    if (mockMode) {
      setHealth({
        status: 'mock',
        data: {
          status: 'mock_active',
          version: '2.4.1 (Mock Preview)',
          last_sync: new Date().toISOString(),
          bigfix_status: 'Mock Connected',
          jamf_status: 'Mock Connected',
          workday_status: 'Mock Directory Active',
          eol_warning_threshold_days: 90,
        },
        error: null,
        latencyMs: 12,
        lastChecked: new Date(),
      });
      return;
    }

    setHealth(prev => ({ ...prev, status: 'checking', error: null }));
    const startTime = performance.now();
    try {
      const data = await api.getHealth();
      const endTime = performance.now();
      setHealth({
        status: 'connected',
        data,
        error: null,
        latencyMs: Math.round(endTime - startTime),
        lastChecked: new Date(),
      });
    } catch (err: any) {
      const endTime = performance.now();
      const message = err?.response?.data?.detail || err?.message || 'Failed to connect to FastAPI backend at ' + apiBaseUrl;
      setHealth({
        status: 'disconnected',
        data: null,
        error: message,
        latencyMs: Math.round(endTime - startTime),
        lastChecked: new Date(),
      });
    }
  }, [mockMode, apiBaseUrl]);

  useEffect(() => {
    api.setMock(mockMode);
    refreshHealth();
  }, [mockMode, apiBaseUrl, refreshHealth]);

  return (
    <AppContext.Provider
      value={{
        mockMode,
        setMockMode,
        apiBaseUrl,
        updateApiBaseUrl,
        health,
        refreshHealth,
        dataRefreshKey,
        triggerDataRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
