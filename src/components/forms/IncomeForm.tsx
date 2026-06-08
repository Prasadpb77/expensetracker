import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { INCOME_SOURCES } from '@/types';
import type { Income, IncomeFormData } from '@/types';

const incomeSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  source: z.enum(['Salary', 'Bonus', 'Freelance', 'Interest', 'Rental', 'Other']),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
});

interface IncomeFormProps {
  defaultValues?: Income;
  onSubmit: (data: IncomeFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function IncomeForm({ defaultValues, onSubmit, onCancel, loading }: IncomeFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IncomeFormData>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      amount: defaultValues?.amount ?? undefined,
      source: defaultValues?.source ?? 'Salary',
      description: defaultValues?.description ?? '',
      date: defaultValues?.date ?? format(new Date(), 'yyyy-MM-dd'),
      notes: defaultValues?.notes ?? '',
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset({
        amount: defaultValues.amount,
        source: defaultValues.source,
        description: defaultValues.description ?? '',
        date: defaultValues.date,
        notes: defaultValues.notes ?? '',
      });
    }
  }, [defaultValues, reset]);

  const sourceOptions = INCOME_SOURCES.map(s => ({ value: s, label: s }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount (₹)"
          type="number"
          step="0.01"
          placeholder="50000"
          error={errors.amount?.message}
          required
          {...register('amount')}
        />
        <Select
          label="Source"
          options={sourceOptions}
          error={errors.source?.message}
          required
          {...register('source')}
        />
      </div>

      <Input
        label="Description"
        type="text"
        placeholder="e.g. Monthly salary from TCS"
        error={errors.description?.message}
        {...register('description')}
      />

      <Input
        label="Date"
        type="date"
        error={errors.date?.message}
        required
        {...register('date')}
      />

      <Textarea
        label="Notes (optional)"
        placeholder="Any additional notes..."
        rows={3}
        error={errors.notes?.message}
        {...register('notes')}
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {defaultValues ? 'Update Income' : 'Add Income'}
        </Button>
      </div>
    </form>
  );
}
