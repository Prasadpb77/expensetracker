
import { Navigate, Outlet } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center animate-pulse-soft">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-surface-400 font-medium">Loading FamilyFinance...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center animate-pulse-soft">
          <Wallet className="h-6 w-6 text-white" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
