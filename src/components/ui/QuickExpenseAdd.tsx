import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { expenseService } from '@/services/expense.service';
import { useStableToast } from '@/hooks/useStableToast';
import { formatCurrency } from '@/utils';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, PAYMENT_METHOD_LABELS } from '@/types';
import type { PaymentMethod } from '@/types';
import {
  Plus, X, Wallet, ChevronDown, Check, ArrowRight, Loader2, Receipt
} from 'lucide-react';

// ============================================================
// QuickExpenseAdd — Floating "+" button that opens a mini form
// to quickly add an expense (amount, payee, category, payment)
// Perfect for logging bank SMS payments in seconds
// ============================================================

export function QuickExpenseAdd() {
  const { profile, familyMembers } = useAppStore();
  const { user } = useAuth();
  const addToast = useStableToast();

  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('personal');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().split('T')[0];

  // Focus amount field when opened
  useEffect(() => {
    if (isOpen && amountRef.current) {
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close pickers on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryPicker(false);
      }
      if (paymentRef.current && !paymentRef.current.contains(e.target as Node)) {
        setShowPaymentPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const reset = useCallback(() => {
    setAmount('');
    setPayee('');
    setSelectedCategory('');
    setPaymentMethod('personal');
    setShowCategoryPicker(false);
    setShowPaymentPicker(false);
  }, []);

  const handleOpen = useCallback(() => {
    reset();
    setIsOpen(true);
  }, [reset]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    reset();
  }, [reset]);

  const handleAddExpense = useCallback(async () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      addToast({ type: 'error', title: 'Please enter a valid amount' });
      return;
    }
    if (!selectedCategory) {
      addToast({ type: 'error', title: 'Please select a category' });
      return;
    }
    if (!profile?.family_id || !user) return;

    setSubmitting(true);
    try {
      await expenseService.create(profile.family_id, user.id, {
        amount: amountNum,
        category: selectedCategory,
        description: payee.trim() || 'Quick expense',
        date: today,
        paid_by: user.id,
        payment_method: paymentMethod,
        is_shared: false,
        split_ratio: 0.5,
      });
      addToast({
        type: 'success',
        title: `Expense added: ${formatCurrency(amountNum)}`,
        message: payee ? `Paid to ${payee} via ${PAYMENT_METHOD_LABELS[paymentMethod]}` : undefined,
      });
      handleClose();
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Failed to add expense',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }, [amount, payee, selectedCategory, paymentMethod, profile, user, today, addToast, handleClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && amount && selectedCategory) {
      handleAddExpense();
    }
  }, [amount, selectedCategory, handleAddExpense]);

  const categoryOptions = EXPENSE_CATEGORIES.filter(c => c !== 'Investment' && c !== 'RD / Goals');

  const paymentOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'personal', label: '💵 Personal' },
    { value: 'joint_account', label: '🏦 Joint Account' },
    { value: 'credit_card', label: '💳 Credit Card' },
  ];

  return (
    <>
      {/* Floating "+" button — always visible */}
      <button
        onClick={handleOpen}
        title="Quick add expense"
        className="fixed bottom-20 left-4 z-[9996] flex items-center justify-center w-12 h-12 rounded-full shadow-lg bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(220,38,38,0.4))' }}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9995]" onClick={handleClose} />
      )}

      {/* Mini form popup */}
      {isOpen && (
        <div className="fixed bottom-28 left-4 right-4 z-[9997] max-w-md mx-auto animate-slide-up">
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                    Quick Add Expense
                  </p>
                  <p className="text-xs text-surface-400">
                    Log your payment in seconds
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                <X className="h-4 w-4 text-surface-400" />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-3" onKeyDown={handleKeyDown}>
              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">
                  Amount (₹) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-surface-400">₹</span>
                  <input
                    ref={amountRef}
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 text-sm font-semibold border border-surface-200 dark:border-surface-600 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-surface-100 placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Payee / Description */}
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">
                  Paid to (from SMS)
                </label>
                <input
                  type="text"
                  value={payee}
                  onChange={e => setPayee(e.target.value)}
                  placeholder="e.g. Rahul Kumar, Grocery Store..."
                  className="w-full px-3 py-2.5 text-sm border border-surface-200 dark:border-surface-600 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Category picker */}
              <div ref={categoryRef} className="relative">
                <label className="block text-xs font-medium text-surface-500 mb-1.5">
                  Category <span className="text-red-400">*</span>
                </label>
                <button
                  onClick={() => setShowCategoryPicker(p => !p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-sm text-surface-900 dark:text-surface-100 hover:border-red-300 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {selectedCategory ? (
                      <><span>{CATEGORY_ICONS[selectedCategory] || '📦'}</span>{selectedCategory}</>
                    ) : (
                      <span className="text-surface-400">Select category...</span>
                    )}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
                </button>
                {showCategoryPicker && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {categoryOptions.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setShowCategoryPicker(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-50 dark:hover:bg-surface-600 transition-colors text-left"
                      >
                        <span>{CATEGORY_ICONS[cat] || '📦'}</span>
                        <span>{cat}</span>
                        {selectedCategory === cat && <Check className="h-3.5 w-3.5 text-red-500 ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment method */}
              <div ref={paymentRef} className="relative">
                <label className="block text-xs font-medium text-surface-500 mb-1.5">
                  Payment Method
                </label>
                <button
                  onClick={() => setShowPaymentPicker(p => !p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-sm hover:border-red-300 transition-colors"
                >
                  <span>{PAYMENT_METHOD_LABELS[paymentMethod]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
                </button>
                {showPaymentPicker && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {paymentOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setPaymentMethod(opt.value); setShowPaymentPicker(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-50 dark:hover:bg-surface-600 transition-colors text-left"
                      >
                        <span>{opt.label}</span>
                        {paymentMethod === opt.value && <Check className="h-3.5 w-3.5 text-red-500 ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-700 flex items-center gap-2">
              <button
                onClick={handleClose}
                className="flex-1 px-3 py-2.5 text-sm font-medium rounded-xl border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExpense}
                disabled={submitting || !amount || !selectedCategory}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><ArrowRight className="h-4 w-4" /> Add Expense</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}