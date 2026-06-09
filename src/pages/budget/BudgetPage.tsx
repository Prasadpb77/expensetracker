import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, PiggyBank, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { budgetService } from '@/services/budget.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, getBudgetStatus, getMonthName, getCurrentMonthYear } from '@/utils';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS } from '@/types';
import { cn } from '@/utils';
import type { Budget, BudgetFormData } from '@/types';

// ── Inline Budget Form (no RHF, no Zod, plain controlled inputs) ──────────────
function BudgetForm({
  defaultValues,
  month,
  year,
  onSubmit,
  onCancel,
  loading,
}: {
  defaultValues?: Budget;
  month: number;
  year: number;
  onSubmit: (d: BudgetFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [category, setCategory] = useState(defaultValues?.category ?? 'Food');
  const [limitStr, setLimitStr] = useState(defaultValues?.monthly_limit ? String(defaultValues.monthly_limit) : '');
  const [selMonth, setSelMonth] = useState(defaultValues?.month ?? month);
  const [selYear, setSelYear] = useState(defaultValues?.year ?? year);
  const [notes, setNotes] = useState(defaultValues?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!limitStr.trim()) e.limit = 'Monthly limit is required';
    else if (isNaN(parseFloat(limitStr)) || parseFloat(limitStr) <= 0) e.limit = 'Enter a valid amount greater than 0';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    await onSubmit({
      category,
      monthly_limit: parseFloat(limitStr),
      month: selMonth,
      year: selYear,
      notes: notes || undefined,
    });
  };

  const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const errorInputCls = 'w-full rounded-lg border border-red-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const selectCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }));
  const yearOptions = [2024, 2025, 2026, 2027];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className={labelCls}>Category</label>
        <select className={selectCls} value={category} onChange={e => setCategory(e.target.value)}>
          {EXPENSE_CATEGORIES.map(c => (
            <option key={c} value={c}>{CATEGORY_ICONS[c] ?? ''} {c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Monthly Limit (₹)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="10000"
          value={limitStr}
          onChange={e => { setLimitStr(e.target.value); setErrors(p => ({ ...p, limit: '' })); }}
          className={errors.limit ? errorInputCls : inputCls}
        />
        {errors.limit && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>{errors.limit}</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label className={labelCls}>Month</label>
          <select className={selectCls} value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Year</label>
          <select className={selectCls} value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional notes..."
          className={inputCls}
          style={{ resize: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {defaultValues ? 'Update Budget' : 'Set Budget'}
        </Button>
      </div>
    </form>
  );
}

// ── Main BudgetPage ────────────────────────────────────────────────────────────
export function BudgetPage() {
  const { profile, addToast } = useAppStore();
  const { user } = useAuth();
  const { month: curMonth, year: curYear } = getCurrentMonthYear();

  const [month, setMonth] = useState(curMonth);
  const [year, setYear] = useState(curYear);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    setLoading(true);
    try {
      const data = await budgetService.getBudgetsWithSpent(profile.family_id, month, year);
      setBudgets(data);
    } catch {
      addToast({ type: 'error', title: 'Failed to load budgets' });
    } finally {
      setLoading(false);
    }
  }, [profile?.family_id, month, year, addToast]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (data: BudgetFormData) => {
    if (!profile?.family_id || !user) return;
    setSubmitting(true);
    try {
      await budgetService.create(profile.family_id, user.id, data);
      addToast({ type: 'success', title: 'Budget set successfully' });
      setShowAddModal(false);
      load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to set budget', message: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: BudgetFormData) => {
    if (!editingBudget) return;
    setSubmitting(true);
    try {
      await budgetService.update(editingBudget.id, data);
      addToast({ type: 'success', title: 'Budget updated' });
      setEditingBudget(null);
      load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to update budget', message: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await budgetService.delete(deletingId);
      addToast({ type: 'success', title: 'Budget deleted' });
      setDeletingId(null);
      load();
    } catch {
      addToast({ type: 'error', title: 'Failed to delete budget' });
    } finally {
      setDeleting(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const totalLimit = budgets.reduce((s, b) => s + Number(b.monthly_limit), 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const { bgColor } = getBudgetStatus(overallPct);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">Budget</h2>
          <p className="text-sm text-surface-500 mt-0.5">Set and track monthly spending limits</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
          Set Budget
        </Button>
      </div>

      {/* Month Navigator */}
      <Card>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
          <div className="text-center">
            <p className="font-display font-bold text-lg text-surface-900 dark:text-surface-100">
              {getMonthName(month)} {year}
            </p>
            <p className="text-xs text-surface-400 mt-0.5">
              {formatCurrency(totalSpent)} of {formatCurrency(totalLimit)} used
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
        </div>
        {totalLimit > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-surface-400 mb-1">
              <span>Overall Budget</span><span>{overallPct}% used</span>
            </div>
            <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-2">
              <div className={cn('h-2 rounded-full transition-all duration-500', bgColor)} style={{ width: `${Math.min(overallPct, 100)}%` }} />
            </div>
          </div>
        )}
      </Card>

      {/* Budget Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700 p-5 h-32" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card className="text-center py-12">
          <PiggyBank className="h-12 w-12 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-500 font-medium">No budgets set for {getMonthName(month)} {year}</p>
          <p className="text-surface-400 text-sm mt-1">Set monthly limits for each spending category</p>
          <Button className="mt-4" onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Set First Budget
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map(budget => {
            const pct = budget.percentage ?? 0;
            const { status, color, bgColor: barColor } = getBudgetStatus(pct);
            const icon = CATEGORY_ICONS[budget.category] ?? '📦';
            const remaining = budget.remaining ?? 0;
            return (
              <Card key={budget.id} className="group relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className="font-semibold text-surface-900 dark:text-surface-100 text-sm">{budget.category}</p>
                      <p className="text-xs text-surface-400">
                        {formatCurrency(budget.spent ?? 0)} of {formatCurrency(Number(budget.monthly_limit))}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => setEditingBudget(budget)} className="h-7 w-7">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(budget.id)} className="h-7 w-7 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-2 mb-2">
                  <div className={cn('h-2 rounded-full transition-all duration-500', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={status === 'good' ? 'success' : status === 'warning' ? 'warning' : 'error'} size="sm">
                    {pct.toFixed(0)}% used
                  </Badge>
                  <span className={cn('text-xs font-medium', color)}>
                    {remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Set Budget" size="md">
        <BudgetForm month={month} year={year} onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={submitting} />
      </Modal>

      <Modal isOpen={!!editingBudget} onClose={() => setEditingBudget(null)} title="Edit Budget" size="md">
        {editingBudget && (
          <BudgetForm defaultValues={editingBudget} month={month} year={year} onSubmit={handleEdit} onCancel={() => setEditingBudget(null)} loading={submitting} />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Budget"
        description="Are you sure you want to remove this budget limit?"
        loading={deleting}
      />
    </div>
  );
}
