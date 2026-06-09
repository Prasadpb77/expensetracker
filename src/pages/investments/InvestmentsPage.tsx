import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Download, BarChart3, PiggyBank, Calendar } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useAppStore } from '@/contexts/store';
import { expenseService } from '@/services/expense.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select, Input } from '@/components/ui/Input';
import { formatCurrency, formatDate, exportToCSV } from '@/utils';
import type { Expense } from '@/types';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

type Period = '3m' | '6m' | '12m' | 'custom';

const INVESTMENT_SUBCATEGORIES = [
  'Mutual Funds', 'Stocks / Equity', 'Fixed Deposit', 'PPF / EPF',
  'SIP', 'Gold', 'Real Estate', 'Crypto', 'NPS', 'Bonds', 'Other',
];

const SUBCAT_COLORS: Record<string, string> = {
  'Mutual Funds': '#0284c7',
  'Stocks / Equity': '#16a34a',
  'Fixed Deposit': '#f59e0b',
  'PPF / EPF': '#7c3aed',
  'SIP': '#0ea5e9',
  'Gold': '#d97706',
  'Real Estate': '#64748b',
  'Crypto': '#f43f5e',
  'NPS': '#8b5cf6',
  'Bonds': '#06b6d4',
  'Other': '#94a3b8',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 shadow-glass">
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
          <span className="text-surface-600 dark:text-surface-400">{entry.name}:</span>
          <span style={{ fontWeight: 700 }} className="text-surface-900 dark:text-surface-100">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function InvestmentsPage() {
  const { profile, familyMembers, addToast } = useAppStore();

  const [period, setPeriod] = useState<Period>('12m');
  const [customFrom, setCustomFrom] = useState(format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterUser, setFilterUser] = useState('');

  const [loading, setLoading] = useState(true);
  const [investments, setInvestments] = useState<Expense[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; amount: number }[]>([]);
  const [subcategoryData, setSubcategoryData] = useState<{ name: string; value: number; color: string }[]>([]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (period === 'custom') return { from: customFrom, to: customTo };
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
    return {
      from: format(startOfMonth(subMonths(now, months - 1)), 'yyyy-MM-dd'),
      to: format(endOfMonth(now), 'yyyy-MM-dd'),
    };
  }, [period, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    setLoading(true);
    const { from, to } = getDateRange();
    try {
      const data = await expenseService.getAll(profile.family_id, {
        category: 'Investment',
        dateRange: { from, to },
        userId: filterUser || undefined,
      });
      setInvestments(data);

      // Monthly totals
      const monthMap: Record<string, number> = {};
      data.forEach(e => {
        const key = e.date.slice(0, 7);
        monthMap[key] = (monthMap[key] || 0) + Number(e.amount);
      });
      const monthly = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({
          month: format(new Date(month + '-01'), 'MMM yy'),
          amount,
        }));
      setMonthlyData(monthly);

      // Subcategory breakdown from description matching
      const subcatMap: Record<string, number> = {};
      data.forEach(e => {
        // Try to match description to a known subcategory
        const matched = INVESTMENT_SUBCATEGORIES.find(s =>
          e.description.toLowerCase().includes(s.toLowerCase().split(' ')[0])
        ) || 'Other';
        subcatMap[matched] = (subcatMap[matched] || 0) + Number(e.amount);
      });
      setSubcategoryData(
        Object.entries(subcatMap)
          .map(([name, value]) => ({ name, value, color: SUBCAT_COLORS[name] || '#94a3b8' }))
          .sort((a, b) => b.value - a.value)
      );
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load investment data', message: String(e) });
    } finally {
      setLoading(false);
    }
  }, [profile?.family_id, getDateRange, filterUser, addToast]);

  useEffect(() => { load(); }, [load]);

  const totalInvested = investments.reduce((s, e) => s + Number(e.amount), 0);
  const avgMonthly = monthlyData.length > 0 ? totalInvested / monthlyData.length : 0;
  const maxMonth = monthlyData.reduce((max, m) => m.amount > max.amount ? m : max, { month: '', amount: 0 });
  const thisMonth = format(new Date(), 'MMM yy');
  const thisMonthTotal = monthlyData.find(m => m.month === thisMonth)?.amount ?? 0;

  const handleExport = () => {
    const data = investments.map(e => ({
      Date: e.date,
      Description: e.description,
      Amount: e.amount,
      'Paid By': familyMembers.find(m => m.id === e.paid_by)?.display_name ?? '',
      Notes: e.notes ?? '',
    }));
    exportToCSV(data, `investments-${format(new Date(), 'yyyy-MM-dd')}`);
    addToast({ type: 'success', title: 'Investments exported to CSV' });
  };

  const periodOptions = [
    { value: '3m', label: 'Last 3 Months' },
    { value: '6m', label: 'Last 6 Months' },
    { value: '12m', label: 'Last 12 Months' },
    { value: 'custom', label: 'Custom Range' },
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
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">
            Investments
          </h2>
          <p className="text-sm text-surface-500 mt-0.5">
            Track all your investment transactions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} leftIcon={<Download className="h-3.5 w-3.5" />}>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select options={periodOptions} value={period} onChange={e => setPeriod(e.target.value as Period)} className="sm:w-44" />
          {period === 'custom' && (
            <>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </>
          )}
          {familyMembers.length > 1 && (
            <Select options={memberOptions} value={filterUser} onChange={e => setFilterUser(e.target.value)} className="sm:w-40" />
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Invested', value: formatCurrency(totalInvested), icon: '📈', color: '#0284c7', bg: '#eff6ff' },
          { label: 'This Month', value: formatCurrency(thisMonthTotal), icon: '📅', color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Monthly Average', value: formatCurrency(avgMonthly), icon: '📊', color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Best Month', value: maxMonth.month || '—', icon: '🏆', color: '#f59e0b', bg: '#fffbeb', sub: maxMonth.amount > 0 ? formatCurrency(maxMonth.amount) : '' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, border: '1px solid #e2e8f0', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>{s.label}</p>
            </div>
            <p style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: s.color }}>{s.value}</p>
            {s.sub && <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '2px 0 0' }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend */}
        <Card className="lg:col-span-2" padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Monthly Investment Trend</CardTitle>
            <Badge variant="info" size="sm">₹</Badge>
          </CardHeader>
          <div style={{ paddingBottom: '1rem' }}>
            {loading ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="text-surface-400 text-sm">Loading...</div>
            ) : monthlyData.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="text-surface-400 text-sm">No investment data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="amount" name="Invested" stroke="#0284c7" strokeWidth={2.5}
                    fill="url(#investGrad)" dot={{ fill: '#0284c7', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Subcategory pie */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>By Type</CardTitle>
          </CardHeader>
          <div style={{ padding: '0 1rem 1rem' }}>
            {loading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="text-surface-400 text-sm">Loading...</div>
            ) : subcategoryData.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="text-surface-400 text-sm">No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={subcategoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      paddingAngle={2} dataKey="value">
                      {subcategoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {subcategoryData.slice(0, 5).map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', flex: 1 }} className="text-surface-500">{s.name}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }} className="text-surface-900 dark:text-surface-100">
                        {formatCurrency(s.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Bar chart - per member */}
      {familyMembers.length > 1 && (
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Investment by Month</CardTitle>
            <BarChart3 className="h-4 w-4 text-surface-400" />
          </CardHeader>
          <div style={{ paddingBottom: '1rem' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="Invested" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Transactions Table */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5">
          <CardTitle>All Investment Transactions</CardTitle>
          <Badge variant="default" size="sm">{investments.length} records</Badge>
        </CardHeader>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }} className="text-surface-400 text-sm">
            Loading...
          </div>
        ) : investments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <PiggyBank className="h-10 w-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500 font-medium">No investment transactions found</p>
            <p className="text-surface-400 text-sm mt-1">
              Add expenses with category "Investment" to track them here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {investments.map(exp => {
              const paidByMember = familyMembers.find(m => m.id === exp.paid_by);
              return (
                <div key={exp.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors">
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp style={{ width: 18, height: 18, color: '#0284c7' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      className="text-surface-900 dark:text-surface-100">
                      {exp.description}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatDate(exp.date)}</span>
                      {paidByMember && (
                        <Badge variant="default" size="sm">{paidByMember.display_name}</Badge>
                      )}
                      {exp.is_shared && <Badge variant="info" size="sm">Shared</Badge>}
                      {exp.notes && (
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>· {exp.notes}</span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontWeight: 800, fontSize: '0.875rem', color: '#0284c7', flexShrink: 0 }}>
                    {formatCurrency(Number(exp.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Total footer */}
        {investments.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.25rem', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }} className="text-surface-600">
              Total ({investments.length} transactions)
            </span>
            <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.875rem' }}>
              {formatCurrency(totalInvested)}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
