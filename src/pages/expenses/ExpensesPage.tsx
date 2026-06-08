import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, TrendingDown, Users, Filter } from 'lucide-react';
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
import { StatCard } from '@/components/ui/StatCard';
import { formatCurrency, formatDate, getCurrentMonth, exportToCSV } from '@/utils';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '@/types';
import type { Expense, ExpenseFormData } from '@/types';

export function ExpensesPage() {
  const { profile, familyMembers, addToast } = useAppStore();
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

  const loadExpenses = useCallback(async () => {
    if (!profile?.family_id) return;
    try {
      const data = await expenseService.getAll(profile.family_id, {
        category: filterCategory || undefined,
        userId: filterUser || undefined,
        isShared: filterShared === '' ? undefined : filterShared === 'true',
      });
      setExpenses(data);
    } catch {
      addToast({ type: 'error', title: 'Failed to load expenses' });
    } finally {
      setLoading(false);
    }
  }, [profile?.family_id, filterCategory, filterUser, filterShared, addToast]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleAdd = async (data: ExpenseFormData) => {
    if (!profile?.family_id || !user) return;
    setSubmitting(true);
    try {
      await expenseService.create(profile.family_id, user.id, data);
      addToast({ type: 'success', title: 'Expense added successfully' });
      setShowAddModal(false);
      loadExpenses();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to add expense', message: String(e) });
    } finally {
      setSubmitting(false);
    }
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
      addToast({ type: 'error', title: 'Failed to update expense', message: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await expenseService.delete(deletingId);
      addToast({ type: 'success', title: 'Expense deleted' });
      setDeletingId(null);
      loadExpenses();
    } catch {
      addToast({ type: 'error', title: 'Failed to delete expense' });
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const exportData = filtered.map(e => ({
      Date: e.date,
      Description: e.description,
      Category: e.category,
      Amount: e.amount,
      'Paid By': familyMembers.find(m => m.id === e.paid_by)?.display_name ?? 'Unknown',
      'Shared': e.is_shared ? 'Yes' : 'No',
      Notes: e.notes ?? '',
    }));
    exportToCSV(exportData, `expenses-${new Date().toISOString().slice(0, 10)}`);
    addToast({ type: 'success', title: 'Expenses exported to CSV' });
  };

  const filtered = expenses.filter(e => {
    if (!search) return true;
    return (
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
    );
  });

  const currentMonth = getCurrentMonth();
  const currentMonthTotal = expenses
    .filter(e => e.date >= currentMonth.from && e.date <= currentMonth.to)
    .reduce((s, e) => s + Number(e.amount), 0);
  const myTotal = expenses
    .filter(e => e.paid_by === user?.id)
    .reduce((s, e) => s + Number(e.amount), 0);
  const sharedTotal = expenses
    .filter(e => e.is_shared)
    .reduce((s, e) => s + Number(e.amount), 0);

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">Expenses</h2>
          <p className="text-sm text-surface-500 mt-0.5">Track all your family spending</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export CSV
          </Button>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Add Expense
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="This Month" amount={currentMonthTotal} icon={<TrendingDown />} variant="expense" compact />
        <StatCard title="My Expenses" amount={myTotal} icon={<TrendingDown />} variant="expense" compact />
        <StatCard title="Shared Expenses" amount={sharedTotal} icon={<Users />} variant="expense" compact />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search expenses..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select options={categoryOptions} value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="sm:w-44" />
          {familyMembers.length > 1 && (
            <Select options={memberOptions} value={filterUser} onChange={e => setFilterUser(e.target.value)} className="sm:w-40" />
          )}
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

              return (
                <div key={expense.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors group">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${color}20` }}
                  >
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
                      {expense.is_shared && (
                        <Badge variant="info" size="sm">Shared</Badge>
                      )}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(expense.id)}
                          className="hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
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

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Expense" size="lg">
        <ExpenseForm onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={submitting} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingExpense} onClose={() => setEditingExpense(null)} title="Edit Expense" size="lg">
        {editingExpense && (
          <ExpenseForm
            defaultValues={editingExpense}
            onSubmit={handleEdit}
            onCancel={() => setEditingExpense(null)}
            loading={submitting}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
