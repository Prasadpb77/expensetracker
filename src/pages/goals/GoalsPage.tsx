import { useStableToast } from '@/hooks/useStableToast';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Target, TrendingUp, CheckCircle, Calendar, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { goalsService } from '@/services/goals.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils';
import { GOAL_ICONS } from '@/types';
import type { Goal, GoalFormData, ContributionFormData, GoalContribution } from '@/types';
import { cn } from '@/utils';

// ── Goal Form ─────────────────────────────────────────────────────────────────
function GoalForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
}: {
  defaultValues?: Goal;
  onSubmit: (d: GoalFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [icon, setIcon] = useState(defaultValues?.icon ?? '🌟');
  const [targetStr, setTargetStr] = useState(defaultValues?.target_amount ? String(defaultValues.target_amount) : '');
  const [deadline, setDeadline] = useState(defaultValues?.deadline ?? '');
  const [notes, setNotes] = useState(defaultValues?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const errorInputCls = inputCls.replace('border-gray-300 dark:border-gray-600', 'border-red-400');
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Goal name is required';
    if (!targetStr.trim() || isNaN(parseFloat(targetStr)) || parseFloat(targetStr) <= 0)
      errs.target = 'Enter a valid target amount';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    await onSubmit({
      name: name.trim(),
      icon,
      target_amount: parseFloat(targetStr),
      deadline: deadline || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Icon picker */}
      <div>
        <label className={labelCls}>Choose an icon</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {GOAL_ICONS.map(ic => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              style={{
                fontSize: '1.5rem',
                padding: '0.4rem',
                borderRadius: '8px',
                border: `2px solid ${icon === ic ? '#0284c7' : 'transparent'}`,
                background: icon === ic ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className={labelCls}>Goal Name</label>
        <input type="text" placeholder="e.g. New Car" value={name}
          onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
          className={errors.name ? errorInputCls : inputCls} />
        {errors.name && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>{errors.name}</p>}
      </div>

      {/* Target Amount */}
      <div>
        <label className={labelCls}>Target Amount (₹)</label>
        <input type="text" inputMode="decimal" placeholder="100000" value={targetStr}
          onChange={e => { setTargetStr(e.target.value); setErrors(p => ({ ...p, target: '' })); }}
          className={errors.target ? errorInputCls : inputCls} />
        {errors.target && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>{errors.target}</p>}
      </div>

      {/* Deadline */}
      <div>
        <label className={labelCls}>Target Date (optional)</label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="What is this goal for?" className={inputCls} style={{ resize: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {defaultValues ? 'Update Goal' : 'Create Goal'}
        </Button>
      </div>
    </form>
  );
}

// ── Contribution Form ─────────────────────────────────────────────────────────
function ContributionForm({
  goal,
  onSubmit,
  onCancel,
  loading,
}: {
  goal: Goal;
  onSubmit: (d: ContributionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState('');
  const remaining = goal.target_amount - goal.saved_amount;

  const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountStr.trim() || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
      setError('Enter a valid amount'); return;
    }
    setError('');
    await onSubmit({ amount: parseFloat(amountStr), notes: notes || undefined, date });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Goal summary */}
      <div style={{ padding: '1rem', borderRadius: '12px', background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>{goal.icon}</span>
          <div>
            <p style={{ fontWeight: 700, margin: 0 }} className="text-gray-900">{goal.name}</p>
            <p style={{ fontSize: '0.875rem', margin: 0, color: '#64748b' }}>
              {formatCurrency(goal.saved_amount)} saved of {formatCurrency(goal.target_amount)}
            </p>
            <p style={{ fontSize: '0.75rem', margin: 0, color: '#0284c7', fontWeight: 600 }}>
              {formatCurrency(remaining > 0 ? remaining : 0)} remaining
            </p>
          </div>
        </div>
        {/* Mini progress bar */}
        <div style={{ marginTop: '0.75rem', background: '#e0f2fe', borderRadius: '999px', height: 8 }}>
          <div style={{
            width: `${Math.min(100, (goal.saved_amount / goal.target_amount) * 100)}%`,
            background: '#0284c7', borderRadius: '999px', height: 8,
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Amount to add (₹)</label>
        <input type="text" inputMode="decimal" placeholder="20000" value={amountStr}
          onChange={e => { setAmountStr(e.target.value); setError(''); }}
          className={error ? inputCls.replace('border-gray-300 dark:border-gray-600', 'border-red-400') : inputCls}
          autoFocus />
        {error && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>{error}</p>}
      </div>

      <div>
        <label className={labelCls}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Monthly savings transfer" className={inputCls} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1">Add Money</Button>
      </div>
    </form>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────
function GoalCard({
  goal,
  onAddMoney,
  onEdit,
  onDelete,
  onViewHistory,
}: {
  goal: Goal;
  onAddMoney: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewHistory: () => void;
}) {
  const pct = goal.target_amount > 0
    ? Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100 * 10) / 10)
    : 0;
  const remaining = goal.target_amount - goal.saved_amount;
  const isCompleted = goal.is_completed || pct >= 100;

  const barColor = isCompleted ? '#16a34a' : pct >= 75 ? '#0284c7' : pct >= 40 ? '#7c3aed' : '#f59e0b';

  return (
    <div className={cn(
      'bg-white dark:bg-surface-800 rounded-2xl border shadow-card transition-all duration-200 hover:shadow-card-hover p-5',
      isCompleted ? 'border-green-200 dark:border-green-900/50' : 'border-surface-100 dark:border-surface-700'
    )}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '14px', fontSize: '1.75rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isCompleted ? '#dcfce7' : '#eff6ff',
          }}>
            {goal.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}
                className="text-surface-900 dark:text-surface-100">{goal.name}</p>
              {isCompleted && (
                <CheckCircle style={{ width: 16, height: 16, color: '#16a34a' }} />
              )}
            </div>
            {goal.deadline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Calendar style={{ width: 11, height: 11, color: '#94a3b8' }} />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Target: {format(new Date(goal.deadline), 'dd MMM yyyy')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button onClick={onEdit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', borderRadius: 6, color: '#94a3b8' }}
            className="hover:bg-gray-100 dark:hover:bg-gray-700">
            <Pencil style={{ width: 14, height: 14 }} />
          </button>
          <button onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', borderRadius: 6, color: '#94a3b8' }}
            className="hover:bg-red-50 hover:text-red-500">
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Amounts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Saved</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0284c7' }}>
            {formatCurrency(goal.saved_amount)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Target</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}
            className="text-surface-900 dark:text-surface-100">
            {formatCurrency(goal.target_amount)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: '#f1f5f9', borderRadius: 999, height: 10, marginBottom: '0.5rem', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, background: barColor,
          borderRadius: 999, height: 10,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: barColor }}>{pct.toFixed(1)}% complete</span>
        {!isCompleted && remaining > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {formatCurrency(remaining)} to go
          </span>
        )}
        {isCompleted && (
          <Badge variant="success" size="sm">🎉 Goal reached!</Badge>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {!isCompleted && (
          <Button onClick={onAddMoney} size="sm" className="flex-1" leftIcon={<Plus style={{ width: 14, height: 14 }} />}>
            Add Money
          </Button>
        )}
        <Button onClick={onViewHistory} size="sm" variant="outline" className={isCompleted ? 'flex-1' : ''}>
          History
        </Button>
      </div>
    </div>
  );
}

// ── History Modal ─────────────────────────────────────────────────────────────
function HistoryModal({
  goal,
  isOpen,
  onClose,
}: {
  goal: Goal | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!goal || !isOpen) return;
    setLoading(true);
    goalsService.getContributions(goal.id)
      .then(setContributions)
      .finally(() => setLoading(false));
  }, [goal, isOpen]);

  if (!goal) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${goal.icon} ${goal.name} — History`} size="md">
      {loading ? (
        <p className="text-center text-surface-400 py-6">Loading...</p>
      ) : contributions.length === 0 ? (
        <p className="text-center text-surface-400 py-6">No contributions yet</p>
      ) : (
        <div className="space-y-2">
          {contributions.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 10, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet style={{ width: 16, height: 16, color: '#0284c7' }} />
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }} className="text-gray-900 dark:text-gray-100">
                    +{formatCurrency(c.amount)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                    {format(new Date(c.date), 'dd MMM yyyy')}
                    {c.notes && ` · ${c.notes}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── Main GoalsPage ─────────────────────────────────────────────────────────────
export function GoalsPage() {
  const { profile } = useAppStore();
  const addToast = useStableToast();
  const { user } = useAuth();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);
  const [historyGoal, setHistoryGoal] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    setLoading(true);
    try {
      const data = await goalsService.getAll(profile.family_id);
      setGoals(data);
    } catch { addToast({ type: 'error', title: 'Failed to load goals' }); }
    finally { setLoading(false); }
  }, [profile?.family_id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: GoalFormData) => {
    if (!profile?.family_id || !user) return;
    setSubmitting(true);
    try {
      await goalsService.create(profile.family_id, user.id, data);
      addToast({ type: 'success', title: '🎯 Goal created!' });
      setShowAddModal(false);
      load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to create goal', message: String(e) });
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (data: GoalFormData) => {
    if (!editingGoal) return;
    setSubmitting(true);
    try {
      await goalsService.update(editingGoal.id, data);
      addToast({ type: 'success', title: 'Goal updated' });
      setEditingGoal(null);
      load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to update goal', message: String(e) });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await goalsService.delete(deletingId);
      addToast({ type: 'success', title: 'Goal deleted' });
      setDeletingId(null);
      load();
    } catch { addToast({ type: 'error', title: 'Failed to delete goal' }); }
    finally { setDeleting(false); }
  };

  const handleContribute = async (data: ContributionFormData) => {
    if (!contributingGoal || !profile?.family_id || !user) return;
    setSubmitting(true);
    try {
      await goalsService.addContribution(contributingGoal.id, profile.family_id, user.id, data);
      addToast({ type: 'success', title: `💰 ${formatCurrency(data.amount)} added to ${contributingGoal.name}!` });
      setContributingGoal(null);
      load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to add contribution', message: String(e) });
    } finally { setSubmitting(false); }
  };

  // Summary stats
  const activeGoals = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount), 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">
            Savings Goals
          </h2>
          <p className="text-sm text-surface-500 mt-0.5">Track your financial goals together</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
          New Goal
        </Button>
      </div>

      {/* Summary */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Goals', value: goals.length, icon: '🎯', color: '#0284c7' },
            { label: 'Active', value: activeGoals.length, icon: '⏳', color: '#f59e0b' },
            { label: 'Completed', value: completedGoals.length, icon: '✅', color: '#16a34a' },
            { label: 'Overall Progress', value: `${overallPct}%`, icon: '📈', color: '#7c3aed' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700 shadow-card p-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>{s.label}</p>
              </div>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Total savings bar */}
      {goals.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }} className="text-surface-900 dark:text-surface-100">
                Total Saved Across All Goals
              </p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>
                {formatCurrency(totalSaved)} of {formatCurrency(totalTarget)}
              </p>
            </div>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7' }}>{overallPct}%</p>
          </div>
          <div style={{ background: '#f1f5f9', borderRadius: 999, height: 12, overflow: 'hidden' }}>
            <div style={{
              width: `${overallPct}%`,
              background: 'linear-gradient(90deg, #0284c7, #7c3aed)',
              borderRadius: 999, height: 12,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </Card>
      )}

      {/* Goals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 p-5 h-52" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card className="text-center py-16">
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎯</div>
          <p className="font-display text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">
            No goals yet
          </p>
          <p className="text-surface-500 text-sm mb-6">
            Set a savings goal — car, home, vacation, anything!
          </p>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Create First Goal
          </Button>
        </Card>
      ) : (
        <>
          {/* Active goals */}
          {activeGoals.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Target className="h-4 w-4 text-surface-400" />
                <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
                  Active Goals ({activeGoals.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onAddMoney={() => setContributingGoal(goal)}
                    onEdit={() => setEditingGoal(goal)}
                    onDelete={() => setDeletingId(goal.id)}
                    onViewHistory={() => setHistoryGoal(goal)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed goals */}
          {completedGoals.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
                  Completed ({completedGoals.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onAddMoney={() => setContributingGoal(goal)}
                    onEdit={() => setEditingGoal(goal)}
                    onDelete={() => setDeletingId(goal.id)}
                    onViewHistory={() => setHistoryGoal(goal)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Create New Goal" size="md">
        <GoalForm onSubmit={handleCreate} onCancel={() => setShowAddModal(false)} loading={submitting} />
      </Modal>

      <Modal isOpen={!!editingGoal} onClose={() => setEditingGoal(null)} title="Edit Goal" size="md">
        {editingGoal && (
          <GoalForm defaultValues={editingGoal} onSubmit={handleEdit} onCancel={() => setEditingGoal(null)} loading={submitting} />
        )}
      </Modal>

      <Modal
        isOpen={!!contributingGoal}
        onClose={() => setContributingGoal(null)}
        title="Add Money to Goal"
        size="md"
      >
        {contributingGoal && (
          <ContributionForm
            goal={contributingGoal}
            onSubmit={handleContribute}
            onCancel={() => setContributingGoal(null)}
            loading={submitting}
          />
        )}
      </Modal>

      <HistoryModal
        goal={historyGoal}
        isOpen={!!historyGoal}
        onClose={() => setHistoryGoal(null)}
      />

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Goal"
        description="Are you sure? This will delete the goal and all its contribution history."
        loading={deleting}
      />
    </div>
  );
}
