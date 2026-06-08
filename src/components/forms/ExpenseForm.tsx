import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EXPENSE_CATEGORIES } from '@/types';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import type { Expense, ExpenseFormData } from '@/types';

const expenseSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().min(1, 'Date is required'),
  paid_by: z.string().min(1, 'Please select who paid'),
  is_shared: z.boolean(),
  split_ratio: z.coerce.number().min(0).max(1),
  notes: z.string().optional(),
});

interface ExpenseFormProps {
  defaultValues?: Expense;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ExpenseForm({ defaultValues, onSubmit, onCancel, loading }: ExpenseFormProps) {
  const { user } = useAuth();
  const { familyMembers } = useAppStore();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: defaultValues?.amount ?? undefined,
      category: defaultValues?.category ?? 'Food',
      description: defaultValues?.description ?? '',
      date: defaultValues?.date ?? format(new Date(), 'yyyy-MM-dd'),
      paid_by: defaultValues?.paid_by ?? user?.id ?? '',
      is_shared: defaultValues?.is_shared ?? false,
      split_ratio: defaultValues?.split_ratio ?? 0.5,
      notes: defaultValues?.notes ?? '',
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset({
        amount: defaultValues.amount,
        category: defaultValues.category,
        description: defaultValues.description,
        date: defaultValues.date,
        paid_by: defaultValues.paid_by,
        is_shared: defaultValues.is_shared,
        split_ratio: defaultValues.split_ratio,
        notes: defaultValues.notes ?? '',
      });
    }
  }, [defaultValues, reset]);

  const isShared = watch('is_shared');

  const categoryOptions = EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }));
  const memberOptions = familyMembers.map(m => ({
    value: m.id,
    label: m.display_name + (m.id === user?.id ? ' (You)' : ''),
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount (₹)"
          type="number"
          step="0.01"
          placeholder="500"
          error={errors.amount?.message}
          required
          {...register('amount')}
        />
        <Select
          label="Category"
          options={categoryOptions}
          error={errors.category?.message}
          required
          {...register('category')}
        />
      </div>

      <Input
        label="Description"
        type="text"
        placeholder="e.g. Dinner at Taj"
        error={errors.description?.message}
        required
        {...register('description')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Date"
          type="date"
          error={errors.date?.message}
          required
          {...register('date')}
        />
        <Select
          label="Paid By"
          options={memberOptions.length > 0 ? memberOptions : [{ value: user?.id ?? '', label: 'You' }]}
          error={errors.paid_by?.message}
          required
          {...register('paid_by')}
        />
      </div>

      {/* Shared expense toggle */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700">
        <input
          type="checkbox"
          id="is_shared"
          className="w-4 h-4 rounded text-brand-600 border-surface-300 focus:ring-brand-500"
          {...register('is_shared')}
        />
        <label htmlFor="is_shared" className="text-sm font-medium text-surface-700 dark:text-surface-300 cursor-pointer">
          Shared expense (split between both)
        </label>
      </div>

      {isShared && (
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
            Your share ratio (0 to 1)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            className="w-full accent-brand-600"
            {...register('split_ratio')}
          />
          <div className="flex justify-between text-xs text-surface-400 mt-1">
            <span>0% (Spouse pays all)</span>
            <span>50/50</span>
            <span>100% (You pay all)</span>
          </div>
        </div>
      )}

      <Textarea
        label="Notes (optional)"
        placeholder="Any additional notes..."
        rows={2}
        error={errors.notes?.message}
        {...register('notes')}
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {defaultValues ? 'Update Expense' : 'Add Expense'}
        </Button>
      </div>
    </form>
  );
}
