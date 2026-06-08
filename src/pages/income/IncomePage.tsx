import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Filter, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { incomeService } from '@/services/income.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { IncomeForm } from '@/components/forms/IncomeForm';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { formatCurrency, formatDate, getCurrentMonth } from '@/utils';
import { INCOME_SOURCES } from '@/types';
import type { Income, IncomeFormData } from '@/types';

export function IncomePage() {
  const { profile, familyMembers, addToast } = useAppStore();
  const { user } = useAuth();

  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterUser, setFilterUser] = useState('');

  const loadIncomes = useCallback(async () => {
    if (!profile?.family_id) return;
    try {
      const data = await incomeService.getAll(profile.family_id, {
        source: filterSource || undefined,
        userId: filterUser || undefined,
      });
      setIncomes(data);
    } catch {
      addToast({ type: 'error', title: 'Failed to load income' });
    } finally {
      setLoading(false);
    }
  }, [profile?.family_id, filterSource, filterUser, addToast]);

  useEffect(() => {
    loadIncomes();
  }, [loadIncomes]);

  const handleAdd = async (data: IncomeFormData) => {
    if (!profile?.family_id || !user) return;
    setSubmitting(true);
    try {
      await incomeService.create(profile.family_id, user.id, data);
      addToast({ type: 'success', title: 'Income added successfully' });
      setShowAddModal(false);
      loadIncomes();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to add income', message: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: IncomeFormData) => {
    if (!editingIncome) return;
    setSubmitting(true);
    try {
      await incomeService.update(editingIncome.id, data);
      addToast({ type: 'success', title: 'Income updated' });
      setEditingIncome(null);
      loadIncomes();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to update income', message: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await incomeService.delete(deletingId);
      addToast({ type: 'success', title: 'Income deleted' });
      setDeletingId(null);
      loadIncomes();
    } catch {
      addToast({ type: 'error', title: 'Failed to delete income' });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = incomes.filter(i => {
    if (!search) return true;
    return (
      i.source.toLowerCase().includes(search.toLowerCase()) ||
      (i.description ?? '').toLowerCase().includes(search.toLowerCase())
    );
  });

  const currentMonth = getCurrentMonth();
  const currentMonthTotal = incomes
    .filter(i => i.date >= currentMonth.from && i.date <= currentMonth.to)
    .reduce((s, i) => s + Number(i.amount), 0);
  const totalAll = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const avgMonthly = incomes.length > 0 ? totalAll / Math.max(1, new Set(incomes.map(i => i.date.slice(0, 7))).size) : 0;

  const sourceOptions = [
    { value: '', label: 'All Sources' },
    ...INCOME_SOURCES.map(s => ({ value: s, label: s })),
  ];

  const memberOptions = [
    { value: '', label: 'All Members' },
    ...familyMembers.map(m => ({ value: m.id, label: m.display_name })),
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">Income</h2>
          <p className="text-sm text-surface-500 mt-0.5">Track all your family earnings</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
          Add Income
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="This Month" amount={currentMonthTotal} icon={<TrendingUp />} variant="income" compact />
        <StatCard title="Total (All Time)" amount={totalAll} icon={<TrendingUp />} variant="income" compact />
        <StatCard title="Monthly Average" amount={avgMonthly} icon={<TrendingUp />} variant="income" compact />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search income..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select
            options={sourceOptions}
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="sm:w-40"
          />
          {familyMembers.length > 1 && (
            <Select
              options={memberOptions}
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="sm:w-40"
            />
          )}
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100">
            All Income <span className="text-surface-400 font-normal text-sm ml-1">({filtered.length})</span>
          </h3>
          <Filter className="h-4 w-4 text-surface-400" />
        </div>

        {loading ? (
          <div className="p-5"><TableSkeleton rows={5} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="h-8 w-8 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500 font-medium">No income records found</p>
            <p className="text-surface-400 text-sm mt-1">Add your first income entry to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {filtered.map(income => {
              const member = familyMembers.find(m => m.id === income.user_id);
              const isOwn = income.user_id === user?.id;
              return (
                <div key={income.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                        {income.source}
                      </p>
                      {income.description && (
                        <span className="text-sm text-surface-500 truncate">— {income.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-surface-400">{formatDate(income.date)}</span>
                      {member && (
                        <Badge variant={isOwn ? 'info' : 'default'} size="sm">
                          {member.display_name}{isOwn ? ' (You)' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(Number(income.amount))}
                    </p>
                    {isOwn && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingIncome(income)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(income.id)}
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
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Income" size="md">
        <IncomeForm onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={submitting} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingIncome} onClose={() => setEditingIncome(null)} title="Edit Income" size="md">
        {editingIncome && (
          <IncomeForm
            defaultValues={editingIncome}
            onSubmit={handleEdit}
            onCancel={() => setEditingIncome(null)}
            loading={submitting}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Income"
        description="Are you sure you want to delete this income record? This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
