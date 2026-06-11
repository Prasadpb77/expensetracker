import { useStableToast } from '@/hooks/useStableToast';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Play, Pause, RefreshCw, TrendingUp, TrendingDown, Calendar, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { recurringService, type RecurringTransaction, type RecurringFormData } from '@/services/recurring.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils';
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from '@/types';
import { cn } from '@/utils';

const FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const FREQ_ICONS = { daily: '📆', weekly: '📅', monthly: '🗓️', yearly: '📊' };

// ── Form ─────────────────────────────────────────────────────
function RecurringForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
}: {
  defaultValues?: RecurringTransaction;
  onSubmit: (d: RecurringFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}) {
  const { user } = useAuth();
  const { familyMembers } = useAppStore();
  const addToast = useStableToast();

  const [type, setType] = useState<'income' | 'expense'>(defaultValues?.type ?? 'expense');
  const [amountStr, setAmountStr] = useState(defaultValues?.amount ? String(defaultValues.amount) : '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [source, setSource] = useState(defaultValues?.source ?? 'Salary');
  const [category, setCategory] = useState(defaultValues?.category ?? 'Food');
  const [paymentMethod, setPaymentMethod] = useState(defaultValues?.payment_method ?? 'personal');
  const [paidBy, setPaidBy] = useState(defaultValues?.paid_by ?? user?.id ?? '');
  const [isShared, setIsShared] = useState(defaultValues?.is_shared ?? false);
  const [frequency, setFrequency] = useState<RecurringFormData['frequency']>(defaultValues?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(defaultValues?.start_date ?? format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(defaultValues?.end_date ?? '');
  const [autoAdd, setAutoAdd] = useState(defaultValues?.auto_add ?? false);
  const [notes, setNotes] = useState(defaultValues?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const selectCls = inputCls;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) errs.amount = 'Enter a valid amount';
    if (!description.trim()) errs.description = 'Description is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    await onSubmit({
      type, amount: parseFloat(amountStr), description: description.trim(),
      source: type === 'income' ? source : undefined,
      category: type === 'expense' ? category : undefined,
      payment_method: type === 'expense' ? paymentMethod : undefined,
      paid_by: type === 'expense' ? paidBy : undefined,
      is_shared: isShared, split_ratio: 0.5,
      frequency, start_date: startDate,
      end_date: endDate || undefined,
      auto_add: autoAdd,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Type toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '4px', borderRadius: 10 }}>
        {(['income', 'expense'] as const).map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s',
              background: type === t ? 'white' : 'transparent',
              color: type === t ? (t === 'income' ? '#16a34a' : '#dc2626') : '#64748b',
              boxShadow: type === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            {t === 'income' ? '📈 Income' : '📉 Expense'}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label className={labelCls}>Amount (₹)</label>
        <input type="text" inputMode="decimal" placeholder="50000" value={amountStr}
          onChange={e => { setAmountStr(e.target.value); setErrors(p => ({ ...p, amount: '' })); }}
          className={errors.amount ? inputCls.replace('border-gray-300', 'border-red-400') : inputCls} />
        {errors.amount && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>{errors.amount}</p>}
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <input type="text" placeholder={type === 'income' ? 'e.g. Monthly Salary' : 'e.g. House Rent'} value={description}
          onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })); }}
          className={errors.description ? inputCls.replace('border-gray-300', 'border-red-400') : inputCls} />
        {errors.description && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>{errors.description}</p>}
      </div>

      {/* Type-specific fields */}
      {type === 'income' ? (
        <div>
          <label className={labelCls}>Source</label>
          <select className={selectCls} value={source} onChange={e => setSource(e.target.value)}>
            {INCOME_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className={labelCls}>Category</label>
            <select className={selectCls} value={category} onChange={e => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Payment Method</label>
            <select className={selectCls} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="personal">💵 Personal</option>
              <option value="joint_account">🏦 Joint Account</option>
              <option value="credit_card">💳 Credit Card</option>
            </select>
          </div>
        </div>
      )}

      {/* Frequency + Start Date */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label className={labelCls}>Frequency</label>
          <select className={selectCls} value={frequency} onChange={e => setFrequency(e.target.value as RecurringFormData['frequency'])}>
            <option value="daily">📆 Daily</option>
            <option value="weekly">📅 Weekly</option>
            <option value="monthly">🗓️ Monthly</option>
            <option value="yearly">📊 Yearly</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* End Date (optional) */}
      <div>
        <label className={labelCls}>End Date (optional)</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
        <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>Leave blank to repeat forever</p>
      </div>

      {/* Auto-add toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', borderRadius: 10, background: autoAdd ? '#eff6ff' : '#f8fafc', border: `1px solid ${autoAdd ? '#bfdbfe' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
        <input type="checkbox" id="auto_add" checked={autoAdd} onChange={e => setAutoAdd(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#0284c7', cursor: 'pointer', marginTop: 2, flexShrink: 0 }} />
        <div>
          <label htmlFor="auto_add" style={{ fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: autoAdd ? '#1d4ed8' : '#374151' }}>
            <Zap style={{ width: 14, height: 14, display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
            Auto-add when due
          </label>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
            Automatically adds this transaction on the due date when you open the app.
          </p>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes" className={inputCls} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {defaultValues ? 'Update' : 'Create'} Recurring
        </Button>
      </div>
    </form>
  );
}

// ── Card ──────────────────────────────────────────────────────
function RecurringCard({
  tx,
  onAddNow,
  onEdit,
  onDelete,
  onToggle,
  adding,
}: {
  tx: RecurringTransaction;
  onAddNow: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  adding: boolean;
}) {
  const status = recurringService.getDueStatus(tx.next_due_date);
  const isIncome = tx.type === 'income';

  const statusConfig = {
    overdue: { label: 'Overdue', variant: 'error' as const, dot: '#dc2626' },
    'due-today': { label: 'Due Today', variant: 'warning' as const, dot: '#f59e0b' },
    upcoming: { label: 'Due Soon', variant: 'info' as const, dot: '#0284c7' },
    future: { label: 'Scheduled', variant: 'default' as const, dot: '#94a3b8' },
  };
  const sc = statusConfig[status];

  return (
    <div className={cn(
      'bg-white dark:bg-surface-800 rounded-xl border shadow-card p-4 transition-all',
      !tx.is_active && 'opacity-60',
      status === 'overdue' && tx.is_active && 'border-red-200 dark:border-red-900/50',
      status === 'due-today' && tx.is_active && 'border-amber-200 dark:border-amber-900/50',
    )}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', background: isIncome ? '#dcfce7' : '#fee2e2', flexShrink: 0 }}>
            {isIncome ? '📈' : '📉'}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }} className="text-surface-900 dark:text-surface-100">
              {tx.description}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
              {FREQ_ICONS[tx.frequency]} {FREQ_LABELS[tx.frequency]}
              {isIncome ? ` · ${tx.source}` : ` · ${tx.category}`}
            </p>
          </div>
        </div>
        <p style={{ fontWeight: 800, fontSize: '1rem', color: isIncome ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
          {isIncome ? '+' : '-'}{formatCurrency(Number(tx.amount))}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant={sc.variant} size="sm">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block', marginRight: 4 }} />
            {sc.label}
          </Badge>
          {tx.auto_add && <Badge variant="info" size="sm">⚡ Auto</Badge>}
          {!tx.is_active && <Badge variant="default" size="sm">Paused</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Calendar style={{ width: 12, height: 12, color: '#94a3b8' }} />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Next: {format(parseISO(tx.next_due_date), 'dd MMM yyyy')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <Button size="sm" onClick={onAddNow} loading={adding} className="flex-1"
          leftIcon={<Play style={{ width: 12, height: 12 }} />}>
          Add Now
        </Button>
        <Button size="sm" variant="ghost" onClick={onToggle}
          leftIcon={tx.is_active ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}>
          {tx.is_active ? 'Pause' : 'Resume'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil style={{ width: 12, height: 12 }} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}
          className="hover:text-red-600 hover:bg-red-50">
          <Trash2 style={{ width: 12, height: 12 }} />
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function RecurringPage() {
  const { profile } = useAppStore();
  const addToast = useStableToast();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTx, setEditingTx] = useState<RecurringTransaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.family_id) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await recurringService.getAll(profile.family_id);
      setTransactions(data);
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load recurring transactions', message: String(e) });
    } finally { setLoading(false); }
  }, [profile?.family_id]);

  useEffect(() => {
    load();
    // Auto-process on page load
    if (profile?.family_id) {
      recurringService.processAutoAdd(profile.family_id).then(count => {
        if (count > 0) {
          addToast({ type: 'success', title: `⚡ ${count} recurring transaction${count > 1 ? 's' : ''} auto-added!` });
          load();
        }
      }).catch(() => null);
    }
  }, [load, profile?.family_id]);

  const handleCreate = async (data: RecurringFormData) => {
    if (!profile?.family_id || !user) return;
    setSubmitting(true);
    try {
      await recurringService.create(profile.family_id, user.id, data);
      addToast({ type: 'success', title: '🔁 Recurring transaction created!' });
      setShowAddModal(false);
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to create', message: e instanceof Error ? e.message : String(e) });
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (data: RecurringFormData) => {
    if (!editingTx) return;
    setSubmitting(true);
    try {
      await recurringService.update(editingTx.id, data);
      addToast({ type: 'success', title: 'Updated' });
      setEditingTx(null);
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to update', message: String(e) });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await recurringService.delete(deletingId);
      addToast({ type: 'success', title: 'Deleted' });
      setDeletingId(null);
      await load();
    } catch { addToast({ type: 'error', title: 'Failed to delete' }); }
    finally { setDeleting(false); }
  };

  const handleAddNow = async (tx: RecurringTransaction) => {
    if (!profile?.family_id) return;
    setAddingId(tx.id);
    try {
      await recurringService.addNow(tx, profile.family_id);
      addToast({ type: 'success', title: `✅ ${tx.description} added to ${tx.type === 'income' ? 'income' : 'expenses'}` });
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to add', message: String(e) });
    } finally { setAddingId(null); }
  };

  const handleToggle = async (tx: RecurringTransaction) => {
    try {
      await recurringService.toggleActive(tx.id, !tx.is_active);
      await load();
    } catch { addToast({ type: 'error', title: 'Failed to update' }); }
  };

  const handleProcessAll = async () => {
    if (!profile?.family_id) return;
    setProcessing(true);
    try {
      const count = await recurringService.processAutoAdd(profile.family_id);
      addToast({ type: count > 0 ? 'success' : 'info', title: count > 0 ? `⚡ ${count} transaction${count > 1 ? 's' : ''} added!` : 'No transactions due today' });
      await load();
    } catch { addToast({ type: 'error', title: 'Failed to process' }); }
    finally { setProcessing(false); }
  };

  const active = transactions.filter(t => t.is_active);
  const paused = transactions.filter(t => !t.is_active);
  const overdue = active.filter(t => recurringService.getDueStatus(t.next_due_date) === 'overdue');
  const dueToday = active.filter(t => recurringService.getDueStatus(t.next_due_date) === 'due-today');
  const totalMonthlyIncome = transactions.filter(t => t.is_active && t.type === 'income' && t.frequency === 'monthly').reduce((s, t) => s + Number(t.amount), 0);
  const totalMonthlyExpense = transactions.filter(t => t.is_active && t.type === 'expense' && t.frequency === 'monthly').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">Recurring</h2>
          <p className="text-sm text-surface-500 mt-0.5">Auto-add salary, rent, and regular transactions</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" size="sm" onClick={handleProcessAll} loading={processing}
            leftIcon={<Zap className="h-3.5 w-3.5" />}>
            Process Due
          </Button>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Add Recurring
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active', value: active.length, icon: '🔁', color: '#0284c7', bg: '#eff6ff' },
          { label: 'Overdue / Due Today', value: overdue.length + dueToday.length, icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
          { label: 'Monthly Income', value: formatCurrency(totalMonthlyIncome), icon: '📈', color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Monthly Expenses', value: formatCurrency(totalMonthlyExpense), icon: '📉', color: '#dc2626', bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, border: '1px solid #e2e8f0', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1rem' }}>{s.icon}</span>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>{s.label}</p>
            </div>
            <p style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {(overdue.length > 0 || dueToday.length > 0) && (
        <div style={{ padding: '1rem', borderRadius: 12, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚡</span>
            <div>
              <p style={{ fontWeight: 700, color: '#92400e', margin: 0, fontSize: '0.875rem' }}>
                {overdue.length + dueToday.length} transaction{overdue.length + dueToday.length > 1 ? 's' : ''} need attention
              </p>
              <p style={{ fontSize: '0.75rem', color: '#b45309', margin: 0 }}>
                {overdue.length > 0 && `${overdue.length} overdue`}
                {overdue.length > 0 && dueToday.length > 0 && ', '}
                {dueToday.length > 0 && `${dueToday.length} due today`}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleProcessAll} loading={processing}>Add All Now</Button>
        </div>
      )}

      {/* Active transactions */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-white dark:bg-surface-800 rounded-xl border p-4 h-36" />)}
        </div>
      ) : transactions.length === 0 ? (
        <Card className="text-center py-16">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔁</div>
          <p className="font-display text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">No recurring transactions</p>
          <p className="text-surface-500 text-sm mb-6">Set up salary, rent, EMI — add them once, track forever</p>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>Add First Recurring</Button>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                <RefreshCw className="h-4 w-4 text-surface-400" />
                <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
                  Active ({active.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {active.map(tx => (
                  <RecurringCard key={tx.id} tx={tx} adding={addingId === tx.id}
                    onAddNow={() => handleAddNow(tx)}
                    onEdit={() => setEditingTx(tx)}
                    onDelete={() => setDeletingId(tx.id)}
                    onToggle={() => handleToggle(tx)} />
                ))}
              </div>
            </div>
          )}
          {paused.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                <Pause className="h-4 w-4 text-surface-400" />
                <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">Paused ({paused.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {paused.map(tx => (
                  <RecurringCard key={tx.id} tx={tx} adding={addingId === tx.id}
                    onAddNow={() => handleAddNow(tx)}
                    onEdit={() => setEditingTx(tx)}
                    onDelete={() => setDeletingId(tx.id)}
                    onToggle={() => handleToggle(tx)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Recurring Transaction" size="lg">
        <RecurringForm onSubmit={handleCreate} onCancel={() => setShowAddModal(false)} loading={submitting} />
      </Modal>
      <Modal isOpen={!!editingTx} onClose={() => setEditingTx(null)} title="Edit Recurring Transaction" size="lg">
        {editingTx && (
          <RecurringForm defaultValues={editingTx} onSubmit={handleEdit} onCancel={() => setEditingTx(null)} loading={submitting} />
        )}
      </Modal>
      <ConfirmDialog isOpen={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={handleDelete}
        title="Delete Recurring" description="This will stop future auto-adds. Existing transactions are not affected." loading={deleting} />
    </div>
  );
}
