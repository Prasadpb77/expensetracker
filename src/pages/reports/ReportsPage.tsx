import React, { useState, useCallback, useEffect } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useAppStore } from '@/contexts/store';
import { incomeService } from '@/services/income.service';
import { expenseService } from '@/services/expense.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { IncomeExpenseChart } from '@/components/charts/IncomeExpenseChart';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';
import { formatCurrency, calculateSavingsRate, exportToCSV } from '@/utils';
import { EXPENSE_CATEGORIES } from '@/types';
import type { MonthlyData, CategoryData } from '@/types';
import type { Income, Expense } from '@/types';

type ReportPeriod = '1m' | '3m' | '6m' | '12m' | 'custom';

export function ReportsPage() {
  const { profile, familyMembers, addToast } = useAppStore();

  const [period, setPeriod] = useState<ReportPeriod>('3m');
  const [customFrom, setCustomFrom] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUser, setFilterUser] = useState('');

  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (period === 'custom') return { from: customFrom, to: customTo };
    const months = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;
    return {
      from: format(startOfMonth(subMonths(now, months - 1)), 'yyyy-MM-dd'),
      to: format(endOfMonth(now), 'yyyy-MM-dd'),
    };
  }, [period, customFrom, customTo]);

  const loadData = useCallback(async () => {
    if (!profile?.family_id) return;
    setLoading(true);
    const { from, to } = getDateRange();
    const familyId = profile.family_id;

    try {
      const [allIncomes, allExpenses, incomeTotals, expenseTotals, categories] = await Promise.all([
        incomeService.getAll(familyId, {
          dateRange: { from, to },
          userId: filterUser || undefined,
        }),
        expenseService.getAll(familyId, {
          dateRange: { from, to },
          category: filterCategory || undefined,
          userId: filterUser || undefined,
        }),
        incomeService.getMonthlyTotals(familyId, 12),
        expenseService.getMonthlyTotals(familyId, 12),
        expenseService.getCategoryBreakdown(familyId, from, to),
      ]);

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

      setMonthlyData(Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)));
      setCategoryData(categories);
      setIncomes(allIncomes);
      setExpenses(allExpenses);
    } catch {
      addToast({ type: 'error', title: 'Failed to load report data' });
    } finally {
      setLoading(false);
    }
  }, [profile?.family_id, getDateRange, filterCategory, filterUser, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalSavings = totalIncome - totalExpenses;
  const savingsRate = calculateSavingsRate(totalIncome, totalExpenses);

  const handleExportExpenses = () => {
    const data = expenses.map(e => ({
      Date: e.date,
      Description: e.description,
      Category: e.category,
      Amount: e.amount,
      'Paid By': familyMembers.find(m => m.id === e.paid_by)?.display_name ?? '',
      Shared: e.is_shared ? 'Yes' : 'No',
      Notes: e.notes ?? '',
    }));
    exportToCSV(data, `expenses-report-${format(new Date(), 'yyyy-MM-dd')}`);
    addToast({ type: 'success', title: 'Expenses exported!' });
  };

  const handleExportIncome = () => {
    const data = incomes.map(i => ({
      Date: i.date,
      Source: i.source,
      Description: i.description ?? '',
      Amount: i.amount,
      Notes: i.notes ?? '',
    }));
    exportToCSV(data, `income-report-${format(new Date(), 'yyyy-MM-dd')}`);
    addToast({ type: 'success', title: 'Income exported!' });
  };

  const periodOptions = [
    { value: '1m', label: 'Last 1 Month' },
    { value: '3m', label: 'Last 3 Months' },
    { value: '6m', label: 'Last 6 Months' },
    { value: '12m', label: 'Last 12 Months' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c })),
  ];

  const memberOptions = [
    { value: '', label: 'All Members' },
    ...familyMembers.map(m => ({ value: m.id, label: m.display_name })),
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">Reports</h2>
          <p className="text-sm text-surface-500 mt-0.5">Analyse your financial patterns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportIncome} leftIcon={<Download className="h-3.5 w-3.5" />}>
            Export Income
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExpenses} leftIcon={<Download className="h-3.5 w-3.5" />}>
            Export Expenses
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select options={periodOptions} value={period} onChange={e => setPeriod(e.target.value as ReportPeriod)} className="sm:w-44" />
          {period === 'custom' && (
            <>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </>
          )}
          <Select options={categoryOptions} value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="sm:w-44" />
          {familyMembers.length > 1 && (
            <Select options={memberOptions} value={filterUser} onChange={e => setFilterUser(e.target.value)} className="sm:w-40" />
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', amount: totalIncome, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'Total Expenses', amount: totalExpenses, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
          { label: 'Net Savings', amount: totalSavings, color: totalSavings >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { label: 'Savings Rate', amount: null, rate: savingsRate, color: savingsRate >= 20 ? 'text-emerald-600' : savingsRate >= 10 ? 'text-amber-600' : 'text-red-600', bg: 'bg-surface-50 dark:bg-surface-800' },
        ].map(item => (
          <div key={item.label} className={`rounded-xl border border-surface-100 dark:border-surface-700 p-4 ${item.bg}`}>
            <p className="text-xs text-surface-500 mb-1">{item.label}</p>
            <p className={`font-display font-bold text-xl ${item.color}`}>
              {item.amount !== null ? formatCurrency(item.amount) : `${item.rate?.toFixed(1)}%`}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Income vs Expenses</CardTitle>
            <Badge variant="default" size="sm">Monthly</Badge>
          </CardHeader>
          <div className="px-2 pb-4">
            {loading ? (
              <div className="h-64 flex items-center justify-center text-surface-400 text-sm">Loading...</div>
            ) : (
              <IncomeExpenseChart data={monthlyData} />
            )}
          </div>
        </Card>

        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            {loading ? (
              <div className="h-64 flex items-center justify-center text-surface-400 text-sm">Loading...</div>
            ) : (
              <CategoryPieChart data={categoryData} />
            )}
          </div>
        </Card>
      </div>

      {/* Top Expense Categories Table */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Category Breakdown</CardTitle>
          <BarChart3 className="h-4 w-4 text-surface-400" />
        </CardHeader>
        {loading ? (
          <div className="p-5 text-center text-surface-400 text-sm">Loading...</div>
        ) : categoryData.length === 0 ? (
          <div className="p-8 text-center text-surface-400 text-sm">No expense data for this period</div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {categoryData.map(cat => (
              <div key={cat.category} className="flex items-center gap-4 px-5 py-3">
                <span className="text-lg">{cat.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{cat.category}</span>
                    <span className="text-sm font-bold text-surface-900 dark:text-surface-100">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
                <Badge variant="default" size="sm">{cat.percentage}%</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
