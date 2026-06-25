import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// ============================================================
// useSmsNotifications — Listens for real-time SMS transaction
// notifications via Supabase Realtime & polling
// ============================================================

export interface SmsTransactionEvent {
  id: string;
  amount: number;
  payee: string;
  bank: string;
  upi_ref?: string;
  confidence: 'high' | 'medium' | 'low';
  raw: string;
  timestamp: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  data: {
    transaction_id: string;
    amount: number;
    payee: string;
    bank: string;
    upi_ref?: string;
  };
  is_read: boolean;
  created_at: string;
}

export function useSmsNotifications() {
  const { user } = useAuth();
  const [pendingTransaction, setPendingTransaction] = useState<SmsTransactionEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCountRef = useRef(0);

  // Poll for unread notifications every 5 seconds
  const pollNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('type', 'sms_expense')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      if (data && data.length > 0) {
        setNotifications(data);
        unreadCountRef.current = data.length;
        // Show the latest one
        const latest = data[0];
        if (latest.data) {
          setPendingTransaction({
            id: latest.data.transaction_id,
            amount: latest.data.amount,
            payee: latest.data.payee,
            bank: latest.data.bank,
            upi_ref: latest.data.upi_ref,
            confidence: 'high',
            raw: '',
            timestamp: latest.created_at,
          });
          setShowModal(true);
        }
      }
    } catch (e) {
      console.error('Failed to poll notifications:', e);
    }
  }, [user?.id]);

  // Poll on interval
  useEffect(() => {
    if (!user?.id) return;
    pollNotifications(); // immediate check
    const interval = setInterval(pollNotifications, 5000);
    return () => clearInterval(interval);
  }, [user?.id, pollNotifications]);

  // Listen for realtime broadcast via Supabase Realtime channel
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`sms-transaction-${user.id}`);

    channel.on('broadcast', { event: 'new_transaction' }, (payload) => {
      const event = payload as unknown as { payload: SmsTransactionEvent };
      if (event?.payload) {
        setPendingTransaction(event.payload);
        setShowModal(true);
      }
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // Dismiss without saving
  const dismissTransaction = useCallback(() => {
    setPendingTransaction(null);
    setShowModal(false);
  }, []);

  return {
    pendingTransaction,
    showModal,
    isLoading,
    notifications,
    unreadCount: unreadCountRef.current,
    setShowModal,
    dismissTransaction,
    markAsRead,
    pollNotifications,
  };
}