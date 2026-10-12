import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { AllAssetsPage } from './pages/AllAssetsPage';
import { WindowsAssetsPage } from './pages/WindowsAssetsPage';
import { MacAssetsPage } from './pages/MacAssetsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { OwnershipPage } from './pages/OwnershipPage';
import { UnassignedAssetsPage } from './pages/UnassignedAssetsPage';
import { ExceptionsPage } from './pages/ExceptionsPage';
import { EOLPage } from './pages/EOLPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { JobSchedulerPage } from './pages/JobSchedulerPage';
import { AuditReportsPage } from './pages/AuditReportsPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            {/* 1. Overview */}
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* 2. Hardware Inventory */}
            <Route path="assets" element={<AllAssetsPage />} />
            <Route path="assets/windows" element={<WindowsAssetsPage />} />
            <Route path="assets/mac" element={<MacAssetsPage />} />

            {/* 3. Ownership & Identity */}
            <Route path="ownership" element={<OwnershipPage />} />
            <Route path="eol-management" element={<EOLPage />} />
            <Route path="eol" element={<Navigate to="/eol-management" replace />} />
            <Route path="admin-users" element={<AdminUsersPage />} />

            {/* 4. Reports */}
            <Route path="reports" element={<ReportsPage />} />

            {/* 5. Users Management */}
            <Route path="users" element={<EmployeesPage />} />
            <Route path="employees" element={<Navigate to="/users" replace />} />

            {/* 6. Job Scheduler */}
            <Route path="job-scheduler" element={<JobSchedulerPage />} />

            {/* 7. Audit Reports */}
            <Route path="audit-reports" element={<AuditReportsPage />} />

            {/* 8. Administration/Settings */}
            <Route path="settings" element={<AdminPage />} />
            <Route path="admin" element={<Navigate to="/settings" replace />} />

            {/* Additional governance views */}
            <Route path="unassigned" element={<UnassignedAssetsPage />} />
            <Route path="exceptions" element={<ExceptionsPage />} />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
