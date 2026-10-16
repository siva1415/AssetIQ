import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
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

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useApp();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const RoleRoute: React.FC<{ path: string; children: React.ReactElement }> = ({ path, children }) => {
  const { canAccessRoute } = useApp();

  if (!canAccessRoute(path)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            {/* 1. Overview — Accessible to all roles */}
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* 2. Hardware Inventory — Accessible to all roles (Super Admin, Admin, Viewer) */}
            <Route path="assets" element={<AllAssetsPage />} />
            <Route path="assets/windows" element={<WindowsAssetsPage />} />
            <Route path="assets/mac" element={<MacAssetsPage />} />

            {/* 3. Ownership & Identity — Hidden/Blocked for Viewers */}
            <Route
              path="ownership"
              element={
                <RoleRoute path="/ownership">
                  <OwnershipPage />
                </RoleRoute>
              }
            />
            <Route
              path="eol-management"
              element={
                <RoleRoute path="/eol-management">
                  <EOLPage />
                </RoleRoute>
              }
            />
            <Route path="eol" element={<Navigate to="/eol-management" replace />} />
            <Route
              path="admin-users"
              element={
                <RoleRoute path="/admin-users">
                  <AdminUsersPage />
                </RoleRoute>
              }
            />

            {/* 4. Reports — Accessible to all roles (Super Admin, Admin, Viewer) */}
            <Route path="reports" element={<ReportsPage />} />

            {/* 5. Users Management — Hidden/Blocked for Viewers */}
            <Route
              path="users"
              element={
                <RoleRoute path="/users">
                  <EmployeesPage />
                </RoleRoute>
              }
            />
            <Route path="employees" element={<Navigate to="/users" replace />} />

            {/* 6. Job Scheduler — Hidden/Blocked for Admins and Viewers (Super Admin Only) */}
            <Route
              path="job-scheduler"
              element={
                <RoleRoute path="/job-scheduler">
                  <JobSchedulerPage />
                </RoleRoute>
              }
            />

            {/* 7. Audit Reports — Hidden/Blocked for Viewers */}
            <Route
              path="audit-reports"
              element={
                <RoleRoute path="/audit-reports">
                  <AuditReportsPage />
                </RoleRoute>
              }
            />

            {/* 8. Settings — Hidden/Blocked for Admins and Viewers (Super Admin Only) */}
            <Route
              path="settings"
              element={
                <RoleRoute path="/settings">
                  <AdminPage />
                </RoleRoute>
              }
            />
            <Route path="admin" element={<Navigate to="/settings" replace />} />

            {/* Additional governance views — Super Admin / Admin only */}
            <Route
              path="unassigned"
              element={
                <RoleRoute path="/assets">
                  <UnassignedAssetsPage />
                </RoleRoute>
              }
            />
            <Route
              path="exceptions"
              element={
                <RoleRoute path="/assets">
                  <ExceptionsPage />
                </RoleRoute>
              }
            />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
