import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  Calendar,
  RefreshCw,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { incomeService } from '@/services/income.service';
import { expenseService } from '@/services/expense.service';
import { StatCard, RateCard } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { IncomeExpenseChart } from '@/components/charts/IncomeExpenseChart';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';
import { SavingsTrendChart } from '@/components/charts/SavingsTrendChart';
import { StatCardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, getCurrentMonth, getLastNMonths, calculateSavingsRate, formatDate } from '@/utils';
import type { MonthlyData, CategoryData, DashboardStats, Income, Expense } from '@/types';

type Transaction =
  | (Income & { txType: 'income' })
  | (Expense & { txType: 'expense' });

const MONTHS = 6;

export function DashboardPage() {
  const { profile, familyMembers } = useAppStore();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    savingsRate: 0,
    currentMonthIncome: 0,
    currentMonthExpenses: 0,
    currentMonthSavings: 0,
  });

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [userExpenses, setUserExpenses] = useState<{ userId: string; displayName: string; amount: number }[]>([]);

  const loadData = useCallback(async () => {
    if (!profile?.family_id || !user) return;

    const familyId = profile.family_id;
    const currentMonth = getCurrentMonth();
    const lastNMonths = getLastNMonths(MONTHS);

    try {
      const [
        currentMonthIncome,
        currentMonthExpenses,
        incomeTotals,
        expenseTotals,
        categories,
        recentIncomes,
        recentExpenses,
        userExpenseData,
      ] = await Promise.all([
        incomeService.getTotalByDateRange(familyId, currentMonth.from, currentMonth.to),
        expenseService.getTotalByDateRange(familyId, currentMonth.from, currentMonth.to),
        incomeService.getMonthlyTotals(familyId, MONTHS),
        expenseService.getMonthlyTotals(familyId, MONTHS),
        expenseService.getCategoryBreakdown(familyId, currentMonth.from, currentMonth.to),
        incomeService.getAll(familyId, { dateRange: currentMonth }),
        expenseService.getAll(familyId, { dateRange: currentMonth }),
        expenseService.getByUser(familyId, currentMonth.from, currentMonth.to),
      ]);

      // Build monthly chart data
      const monthMap: Record<string, MonthlyData> = {};
      incomeTotals.forEach(({ month, total }) => {
        if (!monthMap[month]) monthMap[month] = { month, income: 0, expenses: 0, savings: 0 };
        monthMap[month].income = total;
      });
      expenseTotals.forEach(({ month, total }) => {
        if (!monthMap[month]) monthMap[month] = { month, income: 0, expenses: 0, savings: 0 };
        monthMap[month].expenses = total;
      });
      Object.values(monthMap).forEach(d => { d.savings = d.income - d.expenses; });
      const sortedMonthlyData = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

      // Recent transactions — typed correctly
      const taggedIncomes: Transaction[] = recentIncomes.slice(0, 3).map(i => ({ ...i, txType: 'income' as const }));
      const taggedExpenses: Transaction[] = recentExpenses.slice(0, 3).map(e => ({ ...e, txType: 'expense' as const }));
      const allRecent = [...taggedIncomes, ...taggedExpenses]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6);

      // User expense breakdown
      const memberMap = Object.fromEntries(familyMembers.map(m => [m.id, m.display_name]));
      const processedUserExpenses = userExpenseData.map(({ userId, total }) => ({
        userId,
        displayName: memberMap[userId] || 'Unknown',
        amount: total,
      }));

      setStats({
        totalIncome: incomeTotals.reduce((s, d) => s + d.total, 0),
        totalExpenses: expenseTotals.reduce((s, d) => s + d.total, 0),
        totalSavings: incomeTotals.reduce((s, d) => s + d.total, 0) - expenseTotals.reduce((s, d) => s + d.total, 0),
        savingsRate: calculateSavingsRate(currentMonthIncome, currentMonthExpenses),
        currentMonthIncome,
        currentMonthExpenses,
        currentMonthSavings: currentMonthIncome - currentMonthExpenses,
      });

      setMonthlyData(sortedMonthlyData);
      setCategoryData(categories);
      setRecentTransactions(allRecent);
      setUserExpenses(processedUserExpenses);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }, [profile?.family_id, user, familyMembers]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const currentMonthLabel = format(new Date(), 'MMMM yyyy');

  if (!profile?.family_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-20 h-20 bg-brand-50 dark:bg-brand-950/30 rounded-full flex items-center justify-center mb-4">
          <Users className="h-10 w-10 text-brand-500" />
        </div>
        <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Set up your family
        </h2>
        <p className="text-surface-500 mb-6 max-w-md">
          Create a family group or join your spouse's family to start tracking expenses together.
        </p>
        <Button onClick={() => window.location.href = '/settings'}>
          Go to Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">
            Good {getGreeting()}, {profile.display_name}! 👋
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-3.5 w-3.5 text-surface-400" />
            <span className="text-sm text-surface-500">{currentMonthLabel}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          loading={refreshing}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Current Month Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">This Month</h3>
          <Badge variant="info" size="sm">{currentMonthLabel}</Badge>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Month Income" amount={stats.currentMonthIncome} icon={<TrendingUp />} variant="income" subtitle="This month's earnings" />
            <StatCard title="Month Expenses" amount={stats.currentMonthExpenses} icon={<TrendingDown />} variant="expense" subtitle="This month's spending" />
            <StatCard title="Month Savings" amount={stats.currentMonthSavings} icon={<PiggyBank />} variant="savings" subtitle={stats.currentMonthSavings >= 0 ? 'Saved this month' : 'Over budget'} />
            <RateCard title="Savings Rate" rate={stats.savingsRate} subtitle={stats.savingsRate >= 20 ? 'Excellent!' : stats.savingsRate >= 10 ? 'Good' : 'Needs attention'} icon={<Percent />} />
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Income vs Expenses</CardTitle>
            <Badge variant="default" size="sm">Last {MONTHS} months</Badge>
          </CardHeader>
          <div className="px-2 pb-4">
            {loading ? <ChartSkeleton /> : <IncomeExpenseChart data={monthlyData} />}
          </div>
        </Card>

        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-pulse w-32 h-32 rounded-full bg-surface-200 dark:bg-surface-700" />
              </div>
            ) : (
              <CategoryPieChart data={categoryData} />
            )}
          </div>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Savings Trend</CardTitle>
            <Badge variant="info" size="sm">Monthly</Badge>
          </CardHeader>
          <div className="px-2 pb-4">
            {loading ? <ChartSkeleton /> : <SavingsTrendChart data={monthlyData} />}
          </div>
        </Card>

        {/* Who Spent What */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Expenses by Person</CardTitle>
            <Users className="h-4 w-4 text-surface-400" />
          </CardHeader>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="animate-pulse w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-700" />
                  <div className="flex-1 space-y-1">
                    <div className="animate-pulse h-3 w-20 bg-surface-200 dark:bg-surface-700 rounded" />
                    <div className="animate-pulse h-2 w-full bg-surface-200 dark:bg-surface-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : userExpenses.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-4">No expenses this month</p>
          ) : (
            <div className="space-y-4">
              {userExpenses.map(({ userId, displayName, amount }) => {
                const total = userExpenses.reduce((s, e) => s + e.amount, 0);
                const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
                const isCurrentUser = userId === user?.id;
                return (
                  <div key={userId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${isCurrentUser ? 'bg-brand-600' : 'bg-purple-500'}`}>
                          {displayName[0]}
                        </div>
                        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                          {displayName} {isCurrentUser && <span className="text-xs text-surface-400">(you)</span>}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                    <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${isCurrentUser ? 'bg-brand-500' : 'bg-purple-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5">{pct}% of total</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Recent Transactions</CardTitle>
          <Badge variant="default" size="sm">This month</Badge>
        </CardHeader>
        <div className="divide-y divide-surface-100 dark:divide-surface-700">
          {loading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="animate-pulse w-9 h-9 rounded-full bg-surface-200 dark:bg-surface-700" />
                  <div className="flex-1 space-y-1.5">
                    <div className="animate-pulse h-3 w-40 bg-surface-200 dark:bg-surface-700 rounded" />
                    <div className="animate-pulse h-2.5 w-24 bg-surface-200 dark:bg-surface-700 rounded" />
                  </div>
                  <div className="animate-pulse h-4 w-20 bg-surface-200 dark:bg-surface-700 rounded" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-8">No transactions this month</p>
          ) : (
            recentTransactions.map((tx) => {
              const isIncome = tx.txType === 'income';

              return (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {isIncome
                      ? <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      : <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                      {isIncome
                        ? ((tx as Income & { txType: 'income' }).source || tx.description)
                        : (tx as Expense & { txType: 'expense' }).description
                      }
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-surface-400">{formatDate(tx.date)}</span>
                      {!isIncome && (
                        <Badge variant="default" size="sm">
                          {(tx as Expense & { txType: 'expense' }).category}
                        </Badge>
                      )}
                      {!isIncome && (tx as Expense & { txType: 'expense' }).is_shared && (
                        <Badge variant="info" size="sm">Shared</Badge>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm font-semibold flex-shrink-0 ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
