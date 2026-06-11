import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute, PublicRoute } from '@/components/layout/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { IncomePage } from '@/pages/income/IncomePage';
import { ExpensesPage } from '@/pages/expenses/ExpensesPage';
import { BudgetPage } from '@/pages/budget/BudgetPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { InvestmentsPage } from '@/pages/investments/InvestmentsPage';
import { GoalsPage } from '@/pages/goals/GoalsPage';
import { RecurringPage } from '@/pages/recurring/RecurringPage';

export function App() {
  return (
    <BrowserRouter basename="/expensetracker">
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard"   element={<DashboardPage />} />
              <Route path="/income"      element={<IncomePage />} />
              <Route path="/expenses"    element={<ExpensesPage />} />
              <Route path="/investments" element={<InvestmentsPage />} />
              <Route path="/goals"       element={<GoalsPage />} />
              <Route path="/budget"      element={<BudgetPage />} />
              <Route path="/recurring"   element={<RecurringPage />} />
              <Route path="/reports"     element={<ReportsPage />} />
              <Route path="/settings"    element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
