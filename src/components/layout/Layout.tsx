import React from 'react';
import { Outlet } from 'react-router-dom';
import { cn } from '@/utils';
import { Sidebar, TopBar } from './Sidebar';
import { ToastContainer } from '@/components/ui/Toast';
import { useAppStore } from '@/contexts/store';

interface LayoutProps {
  title?: string;
}

export function Layout({ title }: LayoutProps) {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 font-sans">
      <Sidebar />

      {/* Main content */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        )}
      >
        <TopBar title={title} />
        <main className="p-4 sm:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
