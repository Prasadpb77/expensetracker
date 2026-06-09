import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { EXPENSE_CATEGORIES } from '@/types';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import type { Expense, ExpenseFormData, PaymentMethod } from '@/types';

const expenseSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Enter a valid amount greater than 0'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().min(1, 'Date is required'),
  paid_by: z.string().min(1, 'Please select who paid'),
  payment_method: z.enum(['personal', 'joint_account', 'credit_card']),
  is_shared: z.boolean(),
  split_ratio: z.string(),
  notes: z.string().optional(),
});

type ExpenseFormRaw = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  defaultValues?: Expense;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const errorInputCls = 'w-full rounded-lg border border-red-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const errorMsgCls = 'text-xs text-red-600 mt-1';
const selectCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const errorSelectCls = 'w-full rounded-lg border border-red-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent';

export function ExpenseForm({ defaultValues, onSubmit, onCancel, loading }: ExpenseFormProps) {
  const { user } = useAuth();
  const { familyMembers } = useAppStore();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormRaw>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: defaultValues?.amount ? String(defaultValues.amount) : '',
      category: defaultValues?.category ?? 'Food',
      description: defaultValues?.description ?? '',
      date: defaultValues?.date ?? format(new Date(), 'yyyy-MM-dd'),
      paid_by: defaultValues?.paid_by ?? user?.id ?? '',
      payment_method: defaultValues?.payment_method ?? 'personal',
      is_shared: defaultValues?.is_shared ?? false,
      split_ratio: defaultValues?.split_ratio ? String(defaultValues.split_ratio) : '0.5',
      notes: defaultValues?.notes ?? '',
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset({
        amount: String(defaultValues.amount),
        category: defaultValues.category,
        description: defaultValues.description,
        date: defaultValues.date,
        paid_by: defaultValues.paid_by,
        payment_method: defaultValues.payment_method ?? 'personal',
        is_shared: defaultValues.is_shared,
        split_ratio: String(defaultValues.split_ratio),
        notes: defaultValues.notes ?? '',
      });
    }
  }, [defaultValues, reset]);

  const isShared = watch('is_shared');

  const handleFormSubmit = async (raw: ExpenseFormRaw) => {
    await onSubmit({
      amount: parseFloat(raw.amount),
      category: raw.category,
      description: raw.description,
      date: raw.date,
      paid_by: raw.paid_by,
      payment_method: raw.payment_method as PaymentMethod,
      is_shared: raw.is_shared,
      split_ratio: parseFloat(raw.split_ratio),
      notes: raw.notes,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-4">

      {/* Amount + Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label className={labelCls}>Amount (₹)</label>
          <input type="text" inputMode="decimal" placeholder="500"
            className={errors.amount ? errorInputCls : inputCls}
            {...register('amount')} />
          {errors.amount && <p className={errorMsgCls}>{errors.amount.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select className={errors.category ? errorSelectCls : selectCls} {...register('category')}>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <p className={errorMsgCls}>{errors.category.message}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <input type="text" placeholder="e.g. Dinner at restaurant"
          className={errors.description ? errorInputCls : inputCls}
          {...register('description')} />
        {errors.description && <p className={errorMsgCls}>{errors.description.message}</p>}
      </div>

      {/* Date */}
      <div>
        <label className={labelCls}>Date</label>
        <input type="date"
          className={errors.date ? errorInputCls : inputCls}
          {...register('date')} />
        {errors.date && <p className={errorMsgCls}>{errors.date.message}</p>}
      </div>

      {/* Paid By + Payment Method */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label className={labelCls}>Paid By (Person)</label>
          <select className={errors.paid_by ? errorSelectCls : selectCls} {...register('paid_by')}>
            {familyMembers.length > 0
              ? familyMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}{m.id === user?.id ? ' (You)' : ''}
                  </option>
                ))
              : <option value={user?.id ?? ''}>{user?.email ?? 'You'}</option>
            }
          </select>
          {errors.paid_by && <p className={errorMsgCls}>{errors.paid_by.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Payment Method</label>
          <select className={selectCls} {...register('payment_method')}>
            <option value="personal">💵 Personal Cash / UPI</option>
            <option value="joint_account">🏦 Joint Account</option>
            <option value="credit_card">💳 Credit Card</option>
          </select>
        </div>
      </div>

      {/* Shared toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <input type="checkbox" id="is_shared"
          style={{ width: 16, height: 16, accentColor: '#0284c7', cursor: 'pointer' }}
          {...register('is_shared')} />
        <label htmlFor="is_shared" style={{ fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
          className="text-gray-700 dark:text-gray-300">
          Shared expense (split between both)
        </label>
      </div>

      {/* Split ratio */}
      {isShared && (
        <div>
          <label className={labelCls}>Your share ratio (0 to 1)</label>
          <input type="range" min="0" max="1" step="0.1"
            style={{ width: '100%', accentColor: '#0284c7' }}
            {...register('split_ratio')} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
            <span>0% (Spouse pays all)</span>
            <span>50/50</span>
            <span>100% (You pay all)</span>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea rows={2} placeholder="Any additional notes..."
          className={inputCls} style={{ resize: 'none' }}
          {...register('notes')} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {defaultValues ? 'Update Expense' : 'Add Expense'}
        </Button>
      </div>
    </form>
  );
}
