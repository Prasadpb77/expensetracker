import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { expenseService } from '@/services/expense.service';
import { useStableToast } from '@/hooks/useStableToast';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, PAYMENT_METHOD_LABELS } from '@/types';
import type { PaymentMethod } from '@/types';
import type { SmsTransactionEvent } from '@/hooks/useSmsNotifications';
import {
  X, ChevronDown, Check, ArrowRight, Loader2, Bell,
  Building2, CreditCard, Banknote
} from 'lucide-react';

// ============================================================
// SmsApprovalModal — Shows a real-time notification card when
// a bank SMS is detected, with pre-filled amount, category &
// payment method selectors to approve/ignore the expense
// ============================================================

interface SmsApprovalModalProps {
  transaction: SmsTransactionEvent;
  notificationId?: string;
  onDismiss: () => void;
  onMarkRead?: (id: string) => void;
}

export function SmsApprovalModal({
  transaction,
  notificationId,
  onDismiss,
  onMarkRead,
}: SmsApprovalModalProps) {
  const { profile } = useAppStore();
  const { user } = useAuth();
  const addToast = useStableToast();

  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('personal');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

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

  const categoryOptions = EXPENSE_CATEGORIES.filter(c => c !== 'Investment' && c !== 'RD / Goals');

  const paymentOptions: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: 'personal', label: '💵 Personal', icon: <Banknote className="h-4 w-4" /> },
    { value: 'joint_account', label: '🏦 Joint Account', icon: <Building2 className="h-4 w-4" /> },
    { value: 'credit_card', label: '💳 Credit Card', icon: <CreditCard className="h-4 w-4" /> },
  ];

  const handleApprove = useCallback(async () => {
    if (!selectedCategory) {
      addToast({ type: 'error', title: 'Please select a category' });
      return;
    }
    if (!profile?.family_id || !user) return;

    setSubmitting(true);
    try {
      // Create the expense
      const expense = await expenseService.create(profile.family_id, user.id, {
        amount: transaction.amount,
        category: selectedCategory,
        description: `SMS: ${transaction.payee} (${transaction.bank})${transaction.upi_ref ? ` Ref: ${transaction.upi_ref}` : ''}`,
        date: new Date().toISOString().split('T')[0],
        paid_by: user.id,
        payment_method: paymentMethod,
        is_shared: false,
        split_ratio: 0.5,
        notes: transaction.raw || undefined,
      });

      // Update the SMS transaction status to approved
      await supabase
        .from('sms_transactions')
        .update({
          status: 'approved',
          category: selectedCategory,
          payment_method: paymentMethod,
          expense_id: expense.id,
        })
        .eq('id', transaction.id);

      addToast({
        type: 'success',
        title: `Expense added: ${formatCurrency(transaction.amount)}`,
        message: `Paid to ${transaction.payee} via ${PAYMENT_METHOD_LABELS[paymentMethod]}`,
      });

      // Mark notification as read
      if (notificationId && onMarkRead) {
        onMarkRead(notificationId);
      }

      onDismiss();
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Failed to add expense',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }, [transaction, selectedCategory, paymentMethod, profile, user, addToast, notificationId, onMarkRead, onDismiss]);

  const handleReject = useCallback(async () => {
    setRejecting(true);
    try {
      // Mark as rejected in DB
      await supabase
        .from('sms_transactions')
        .update({ status: 'rejected' })
        .eq('id', transaction.id);

      // Mark notification as read
      if (notificationId && onMarkRead) {
        onMarkRead(notificationId);
      }

      addToast({ type: 'info', title: 'Transaction ignored' });
      onDismiss();
    } catch {
      // Even if DB update fails, dismiss
      onDismiss();
    } finally {
      setRejecting(false);
    }
  }, [transaction.id, notificationId, onMarkRead, onDismiss, addToast]);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9995]" />

      {/* Notification Card */}
      <div className="fixed bottom-4 left-4 right-4 z-[9997] max-w-md mx-auto animate-slide-up">
        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-100 dark:border-surface-700 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center animate-pulse">
                <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                  Bank SMS Detected
                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    Live
                  </span>
                </p>
                <p className="text-xs text-surface-400">Add this transaction as an expense?</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                <X className="h-4 w-4 text-surface-400" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Transaction Details Card */}
            <div className="bg-gradient-to-br from-surface-50 to-blue-50 dark:from-surface-700/50 dark:to-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">Amount</span>
                <span className="text-2xl font-black text-red-600 dark:text-red-400">
                  -{formatCurrency(transaction.amount)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-400">Paid to</span>
                  <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                    {transaction.payee}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-400">Bank</span>
                  <span className="text-sm font-medium text-surface-600 dark:text-surface-300">
                    {transaction.bank}
                  </span>
                </div>
                {transaction.upi_ref && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-400">UPI Ref</span>
                    <span className="text-xs font-mono text-surface-500 bg-surface-100 dark:bg-surface-600 px-2 py-0.5 rounded">
                      {transaction.upi_ref}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-400">Detected</span>
                  <span className="text-xs text-surface-500">
                    {new Date(transaction.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Category Picker */}
            <div ref={categoryRef} className="relative">
              <label className="block text-xs font-medium text-surface-500 mb-1.5">
                Category <span className="text-red-400">*</span>
              </label>
              <button
                onClick={() => setShowCategoryPicker(p => !p)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-sm text-surface-900 dark:text-surface-100 hover:border-blue-400 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {selectedCategory ? (
                    <><span className="text-base">{CATEGORY_ICONS[selectedCategory] || '📦'}</span><span className="font-medium">{selectedCategory}</span></>
                  ) : (
                    <span className="text-surface-400">— Select category —</span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 text-surface-400" />
              </button>
              {showCategoryPicker && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                  {categoryOptions.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setShowCategoryPicker(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-600 transition-colors text-left"
                    >
                      <span className="text-base">{CATEGORY_ICONS[cat] || '📦'}</span>
                      <span className="text-surface-700 dark:text-surface-200">{cat}</span>
                      {selectedCategory === cat && (
                        <Check className="h-4 w-4 text-blue-500 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method Picker */}
            <div ref={paymentRef} className="relative">
              <label className="block text-xs font-medium text-surface-500 mb-1.5">
                Payment Method
              </label>
              <button
                onClick={() => setShowPaymentPicker(p => !p)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-sm hover:border-blue-400 transition-colors"
              >
                <span className="font-medium">{PAYMENT_METHOD_LABELS[paymentMethod]}</span>
                <ChevronDown className="h-4 w-4 text-surface-400" />
              </button>
              {showPaymentPicker && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-xl shadow-lg overflow-hidden">
                  {paymentOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setPaymentMethod(opt.value); setShowPaymentPicker(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-600 transition-colors text-left"
                    >
                      <span>{opt.label}</span>
                      {paymentMethod === opt.value && <Check className="h-4 w-4 text-blue-500 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 py-3.5 border-t border-surface-100 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/50 flex items-center gap-2.5">
            <button
              onClick={handleReject}
              disabled={submitting || rejecting}
              className="flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl border-2 border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Ignore'}
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting || !selectedCategory}
              className="flex-[2] flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
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
    </>
  );
}