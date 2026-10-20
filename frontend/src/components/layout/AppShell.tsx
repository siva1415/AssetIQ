import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { useApp } from '../../context/AppContext';
import { FirstLoginPasswordModal } from '../auth/FirstLoginPasswordModal';

export const AppShell: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { sidebarCollapsed } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Dark Navy Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area with responsive transition */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-64'
        }`}
      >
        {/* Top Navigation */}
        <TopNav onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)} />

        {/* Viewport Content */}
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-4 xl:p-6 2xl:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* First-time login: blocks the app until the one-time password is replaced.
          Renders nothing for users who don't need to change their password. */}
      <FirstLoginPasswordModal />
    </div>
  );
};
