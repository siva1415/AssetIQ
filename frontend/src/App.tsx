import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { DashboardPage } from './pages/DashboardPage';
import { AllAssetsPage } from './pages/AllAssetsPage';
import { WindowsAssetsPage } from './pages/WindowsAssetsPage';
import { MacAssetsPage } from './pages/MacAssetsPage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { OwnershipPage } from './pages/OwnershipPage';
import { UnassignedAssetsPage } from './pages/UnassignedAssetsPage';
import { ExceptionsPage } from './pages/ExceptionsPage';
import { EOLPage } from './pages/EOLPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { JobSchedulerPage } from './pages/JobSchedulerPage';
import { AuditReportsPage } from './pages/AuditReportsPage';
import { isRouteAllowedForRole } from './config/menuConfig';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, currentUser } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Mandatory first-login password reset enforcement
  if (currentUser.must_reset_password) {
    return <Navigate to="/reset-password" replace />;
  }

  // RBAC route protection: check if current route is authorized for user's role
  const isAllowed = isRouteAllowedForRole(location.pathname, currentUser.role);
  if (!isAllowed) {
    return <AccessDeniedPage attemptedPath={location.pathname} />;
  }

  return children;
};

const ResetPasswordRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, currentUser } = useApp();

  if (isAuthenticated) {
    if (currentUser.must_reset_password) {
      return <Navigate to="/reset-password" replace />;
    }
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

          {/* Mandatory / Dedicated Password Reset Route */}
          <Route
            path="/reset-password"
            element={
              <ResetPasswordRoute>
                <ResetPasswordPage />
              </ResetPasswordRoute>
            }
          />
          <Route path="/force-password-reset" element={<Navigate to="/reset-password" replace />} />

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
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

            {/* 5. User Management (replaces old static/workday view) */}
            <Route path="users" element={<UsersManagementPage />} />
            <Route path="employees" element={<Navigate to="/users" replace />} />

            {/* 6. Job Scheduler */}
            <Route path="job-scheduler" element={<JobSchedulerPage />} />

            {/* 7. Audit Logs */}
            <Route path="audit-reports" element={<AuditReportsPage />} />
            <Route path="audit-logs" element={<Navigate to="/audit-reports" replace />} />

            {/* 8. Settings */}
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
