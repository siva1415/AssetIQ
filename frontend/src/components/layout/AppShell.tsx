import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { useApp } from '../../context/AppContext';
import { FirstLoginPasswordModal } from '../auth/FirstLoginPasswordModal';

export const AppShell: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex relative">
      {/* Dark Navy Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navigation */}
        <TopNav onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)} />

        {/* Viewport Content */}
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-4 xl:p-6 2xl:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mandatory First-Time Login OTP Reset Modal (Self-intercepts if mustChangePassword is true) */}
      <FirstLoginPasswordModal />
    </div>
  );
};

