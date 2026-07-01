import { useStableToast } from '@/hooks/useStableToast';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, TrendingDown, Users, Filter, CreditCard, Building2, Volume2 } from 'lucide-react';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { expenseService } from '@/services/expense.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { ExpenseForm } from '@/components/forms/ExpenseForm';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate, getCurrentMonth, exportToCSV, getDateRangeForPeriod } from '@/utils';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS, PAYMENT_METHOD_LABELS } from '@/types';
import type { Expense, ExpenseFormData } from '@/types';

export function ExpensesPage() {
  const { profile, familyMembers } = useAppStore();
  const addToast = useStableToast();
  const { user } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterShared, setFilterShared] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [timePeriod, setTimePeriod] = useState('current_month');

  const loadExpenses = useCallback(async () => {
    if (!profile?.family_id) return;
    try {
      const dateRange = getDateRangeForPeriod(timePeriod);
      const data = await expenseService.getAll(profile.family_id, {
        category: filterCategory || undefined,
        userId: filterUser || undefined,
        isShared: filterShared === '' ? undefined : filterShared === 'true',
        dateRange,
      });
      setExpenses(data);
    } catch {
      addToast({ type: 'error', title: 'Failed to load expenses' });
    } finally {
      setLoading(false);
    }
  }, [profile?.family_id, filterCategory, filterUser, filterShared, timePeriod]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const handleAdd = async (data: ExpenseFormData) => {
    if (!profile?.family_id || !user) return;
    setSubmitting(true);
    try {
      await expenseService.create(profile.family_id, user.id, data);
      addToast({ type: 'success', title: 'Expense added successfully' });
      setShowAddModal(false);
      loadExpenses();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to add expense', message: e instanceof Error ? e.message : String(e) });
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (data: ExpenseFormData) => {
    if (!editingExpense) return;
    setSubmitting(true);
    try {
      await expenseService.update(editingExpense.id, data);
      addToast({ type: 'success', title: 'Expense updated' });
      setEditingExpense(null);
      loadExpenses();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to update expense', message: e instanceof Error ? e.message : String(e) });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await expenseService.delete(deletingId);
      addToast({ type: 'success', title: 'Expense deleted' });
      setDeletingId(null);
      loadExpenses();
    } catch { addToast({ type: 'error', title: 'Failed to delete expense' }); }
    finally { setDeleting(false); }
  };

  const handleExport = () => {
    const data = filtered.map(e => ({
      Date: e.date,
      Description: e.description,
      Category: e.category,
      Amount: e.amount,
      'Paid By': familyMembers.find(m => m.id === e.paid_by)?.display_name ?? e.paid_by,
      'Payment Method': PAYMENT_METHOD_LABELS[e.payment_method] ?? 'Personal',
      Shared: e.is_shared ? 'Yes' : 'No',
      Notes: e.notes ?? '',
    }));
    exportToCSV(data, `expenses-${new Date().toISOString().slice(0, 10)}`);
    addToast({ type: 'success', title: 'Expenses exported to CSV' });
  };

  // Filter client-side for search + payment method (not in DB query)
  const filtered = expenses.filter(e => {
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) &&
        !e.category.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPayment && e.payment_method !== filterPayment) return false;
    return true;
  });

  // Summary stats
  const dateRange = getDateRangeForPeriod(timePeriod);
  const filteredByDate = expenses.filter(e => e.date >= dateRange.from && e.date <= dateRange.to);
  const periodTotal = filteredByDate.reduce((s, e) => s + Number(e.amount), 0);
  const myTotal = expenses.filter(e => e.paid_by === user?.id).reduce((s, e) => s + Number(e.amount), 0);
  const sharedTotal = expenses.filter(e => e.is_shared).reduce((s, e) => s + Number(e.amount), 0);
  const jointTotal = expenses.filter(e => e.payment_method === 'joint_account').reduce((s, e) => s + Number(e.amount), 0);
  const creditTotal = expenses.filter(e => e.payment_method === 'credit_card').reduce((s, e) => s + Number(e.amount), 0);

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c })),
  ];
  const memberOptions = [
    { value: '', label: 'All Members' },
    ...familyMembers.map(m => ({ value: m.id, label: m.display_name })),
  ];
  const sharedOptions = [
    { value: '', label: 'All' },
    { value: 'true', label: 'Shared Only' },
    { value: 'false', label: 'Personal Only' },
  ];
  const paymentOptions = [
    { value: '', label: 'All Methods' },
    { value: 'personal', label: '💵 Personal' },
    { value: 'joint_account', label: '🏦 Joint Account' },
    { value: 'credit_card', label: '💳 Credit Card' },
  ];
  const timePeriodOptions = [
    { value: 'current_month', label: 'Current Month' },
    { value: '3_months', label: 'Last 3 Months' },
    { value: '6_months', label: 'Last 6 Months' },
    { value: '12_months', label: 'Last 12 Months' },
    { value: 'lifetime', label: 'Lifetime' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">Expenses</h2>
          <p className="text-sm text-surface-500 mt-0.5">Track all your family spending</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>Export CSV</Button>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>Add Expense</Button>
        </div>
      </div>

      {/* Stats Row 1 - personal */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: timePeriodOptions.find(t => t.value === timePeriod)?.label || 'Period Total', amount: periodTotal, icon: <TrendingDown className="h-4 w-4" />, color: '#dc2626', bg: '#fef2f2' },
          { label: 'My Expenses', amount: myTotal, icon: <TrendingDown className="h-4 w-4" />, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Shared Expenses', amount: sharedTotal, icon: <Users className="h-4 w-4" />, color: '#7c3aed', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, border: '1px solid #e2e8f0', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{s.label}</p>
              <div style={{ color: s.color }}>{s.icon}</div>
            </div>
            <p style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: s.color }}>{formatCurrency(s.amount)}</p>
          </div>
        ))}
      </div>

      {/* Stats Row 2 - payment method widgets */}
      <div className="grid grid-cols-2 gap-4">
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: 14, border: '1px solid #bfdbfe', padding: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 style={{ width: 18, height: 18, color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600, margin: 0 }}>JOINT ACCOUNT</p>
              <p style={{ fontSize: '0.68rem', color: '#64748b', margin: 0 }}>
                {expenses.filter(e => e.payment_method === 'joint_account').length} transactions
              </p>
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8', margin: 0 }}>
            {formatCurrency(jointTotal)}
          </p>
          <button
            onClick={() => setFilterPayment(filterPayment === 'joint_account' ? '' : 'joint_account')}
            style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            {filterPayment === 'joint_account' ? '✕ Clear filter' : 'Filter these →'}
          </button>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)', borderRadius: 14, border: '1px solid #fecdd3', padding: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard style={{ width: 18, height: 18, color: 'white' }} />
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: '#be123c', fontWeight: 600, margin: 0 }}>CREDIT CARD</p>
              <p style={{ fontSize: '0.68rem', color: '#64748b', margin: 0 }}>
                {expenses.filter(e => e.payment_method === 'credit_card').length} transactions
              </p>
            </div>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#be123c', margin: 0 }}>
            {formatCurrency(creditTotal)}
          </p>
          <button
            onClick={() => setFilterPayment(filterPayment === 'credit_card' ? '' : 'credit_card')}
            style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#e11d48', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            {filterPayment === 'credit_card' ? '✕ Clear filter' : 'Filter these →'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <Input placeholder="Search expenses..." leftIcon={<Search className="h-4 w-4" />}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select options={timePeriodOptions} value={timePeriod} onChange={e => setTimePeriod(e.target.value)} className="sm:w-40" />
          <Select options={categoryOptions} value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="sm:w-44" />
          {familyMembers.length > 1 && (
            <Select options={memberOptions} value={filterUser} onChange={e => setFilterUser(e.target.value)} className="sm:w-36" />
          )}
          <Select options={paymentOptions} value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="sm:w-44" />
          <Select options={sharedOptions} value={filterShared} onChange={e => setFilterShared(e.target.value)} className="sm:w-36" />
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100">
            All Expenses <span className="text-surface-400 font-normal text-sm ml-1">({filtered.length})</span>
          </h3>
          <Filter className="h-4 w-4 text-surface-400" />
        </div>

        {loading ? (
          <div className="p-5"><TableSkeleton rows={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <TrendingDown className="h-8 w-8 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500 font-medium">No expenses found</p>
            <p className="text-surface-400 text-sm mt-1">Add your first expense to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {filtered.map(expense => {
              const paidByMember = familyMembers.find(m => m.id === expense.paid_by);
              const isOwn = expense.user_id === user?.id;
              const icon = CATEGORY_ICONS[expense.category] ?? '📦';
              const color = CATEGORY_COLORS[expense.category] ?? '#64748b';
              const pmLabel = expense.payment_method === 'joint_account' ? '🏦' : expense.payment_method === 'credit_card' ? '💳' : null;

              return (
                <div key={expense.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${color}20` }}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                        {expense.description}
                      </p>
                      <Badge variant="default" size="sm" style={{ borderColor: color, color }}>
                        {expense.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-surface-400">{formatDate(expense.date)}</span>
                      {paidByMember && (
                        <span className="text-xs text-surface-400">
                          Paid by <span className="font-medium">{paidByMember.display_name}</span>
                        </span>
                      )}
                      {pmLabel && (
                        <Badge variant={expense.payment_method === 'joint_account' ? 'info' : 'error'} size="sm">
                          {pmLabel} {expense.payment_method === 'joint_account' ? 'Joint' : 'Credit Card'}
                        </Badge>
                      )}
                      {expense.is_shared && <Badge variant="warning" size="sm">Shared</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">
                      -{formatCurrency(Number(expense.amount))}
                    </p>
                    {isOwn && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => setEditingExpense(expense)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(expense.id)}
                          className="hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Expense" size="lg">
        <ExpenseForm onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={submitting} />
      </Modal>
      <Modal isOpen={!!editingExpense} onClose={() => setEditingExpense(null)} title="Edit Expense" size="lg">
        {editingExpense && (
          <ExpenseForm defaultValues={editingExpense} onSubmit={handleEdit} onCancel={() => setEditingExpense(null)} loading={submitting} />
        )}
      </Modal>
      <ConfirmDialog isOpen={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={handleDelete}
        title="Delete Expense" description="Are you sure you want to delete this expense? This cannot be undone." loading={deleting} />
    </div>
  );
}
