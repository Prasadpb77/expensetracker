import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { INCOME_SOURCES } from '@/types';
import type { Income, IncomeFormData } from '@/types';

const incomeSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Enter a valid amount greater than 0'),
  source: z.enum(['Salary', 'Bonus', 'Freelance', 'Interest', 'Rental', 'Other']),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
});

type IncomeFormRaw = z.infer<typeof incomeSchema>;

interface IncomeFormProps {
  defaultValues?: Income;
  onSubmit: (data: IncomeFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const errorInputCls = 'w-full rounded-lg border border-red-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const errorMsgCls = 'text-xs text-red-600 mt-1';
const selectCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export function IncomeForm({ defaultValues, onSubmit, onCancel, loading }: IncomeFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IncomeFormRaw>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      amount: defaultValues?.amount ? String(defaultValues.amount) : '',
      source: defaultValues?.source ?? 'Salary',
      description: defaultValues?.description ?? '',
      date: defaultValues?.date ?? format(new Date(), 'yyyy-MM-dd'),
      notes: defaultValues?.notes ?? '',
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset({
        amount: String(defaultValues.amount),
        source: defaultValues.source,
        description: defaultValues.description ?? '',
        date: defaultValues.date,
        notes: defaultValues.notes ?? '',
      });
    }
  }, [defaultValues, reset]);

  const handleFormSubmit = async (raw: IncomeFormRaw) => {
    await onSubmit({
      amount: parseFloat(raw.amount),
      source: raw.source,
      description: raw.description,
      date: raw.date,
      notes: raw.notes,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-4">

      {/* Amount + Source */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label className={labelCls}>Amount (₹)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="50000"
            className={errors.amount ? errorInputCls : inputCls}
            {...register('amount')}
          />
          {errors.amount && <p className={errorMsgCls}>{errors.amount.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Source</label>
          <select className={selectCls} {...register('source')}>
            {INCOME_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.source && <p className={errorMsgCls}>{errors.source.message}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <input
          type="text"
          placeholder="e.g. Monthly salary from TCS"
          className={errors.description ? errorInputCls : inputCls}
          {...register('description')}
        />
        {errors.description && <p className={errorMsgCls}>{errors.description.message}</p>}
      </div>

      {/* Date */}
      <div>
        <label className={labelCls}>Date</label>
        <input
          type="date"
          className={errors.date ? errorInputCls : inputCls}
          {...register('date')}
        />
        {errors.date && <p className={errorMsgCls}>{errors.date.message}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea
          rows={3}
          placeholder="Any additional notes..."
          className={inputCls}
          style={{ resize: 'none' }}
          {...register('notes')}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {defaultValues ? 'Update Income' : 'Add Income'}
        </Button>
      </div>
    </form>
  );
}
