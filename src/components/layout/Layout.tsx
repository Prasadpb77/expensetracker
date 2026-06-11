import { Outlet } from 'react-router-dom';
import { cn } from '@/utils';
import { Sidebar, TopBar } from './Sidebar';
import { ToastContainer } from '@/components/ui/Toast';
import { useAppStore } from '@/contexts/store';

export function Layout() {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 font-sans">
      <Sidebar />

      {/* Main content — offset for sidebar on desktop, safe areas on iOS */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        )}
        style={{ paddingRight: 'env(safe-area-inset-right)' }}
      >
        <TopBar />
        <main
          className="flex-1 p-4 sm:p-6 animate-fade-in"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
