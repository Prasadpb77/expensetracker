import { Outlet } from 'react-router-dom';
import { cn } from '@/utils';
import { Sidebar, TopBar } from './Sidebar';
import { useSmsNotifications } from '@/hooks/useSmsNotifications';
import { SmsApprovalModal } from '@/components/ui/SmsApprovalModal';
import { QuickExpenseAdd } from '@/components/ui/QuickExpenseAdd';
import { ToastContainer } from '@/components/ui/Toast';
import { FinAssistant } from '@/components/ui/FinAssistant';
import { useAppStore } from '@/contexts/store';

export function Layout() {
  const { sidebarOpen } = useAppStore();
  const {
    pendingTransaction,
    showModal,
    notifications,
    dismissTransaction,
    markAsRead,
  } = useSmsNotifications();

  return (
    <>
      {showModal && pendingTransaction && (
        <SmsApprovalModal
          transaction={pendingTransaction}
          notificationId={notifications[0]?.id}
          onDismiss={dismissTransaction}
          onMarkRead={markAsRead}
        />
      )}
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 font-sans">
      <Sidebar />

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
          style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <Outlet />
        </main>
      </div>

      <ToastContainer />

      {/* Quick Expense Add — floating button to log bank SMS payments */}
      <QuickExpenseAdd />

      {/* Floating AI Assistant — visible on all pages */}
      <FinAssistant />
    </div>
    </>
  );
}
