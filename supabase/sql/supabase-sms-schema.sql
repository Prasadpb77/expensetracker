-- ============================================================
-- SMS Transaction Tracking & Notifications Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. SMS Transactions table — logs every incoming SMS
CREATE TABLE IF NOT EXISTS sms_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text    TEXT NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  payee       TEXT NOT NULL DEFAULT 'Unknown',
  bank        TEXT NOT NULL DEFAULT 'Unknown Bank',
  upi_ref     TEXT,
  confidence  TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'ignored')),
  category    TEXT,
  payment_method TEXT,
  expense_id  UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  device_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_sms_transactions_user_id ON sms_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_transactions_status ON sms_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sms_transactions_created_at ON sms_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE sms_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own transactions
CREATE POLICY "Users can view own sms_transactions"
  ON sms_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own transactions (e.g., approve/reject)
CREATE POLICY "Users can update own sms_transactions"
  ON sms_transactions FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can insert (from edge function)
CREATE POLICY "Service role can insert sms_transactions"
  ON sms_transactions FOR INSERT
  WITH CHECK (true);


-- 2. Notifications table — for poll-based notification delivery
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'sms_expense',
  title       TEXT NOT NULL,
  message     TEXT,
  data        JSONB,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);


-- 3. Enable realtime for the sms_transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE sms_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- 4. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sms_transactions_updated_at
  BEFORE UPDATE ON sms_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();