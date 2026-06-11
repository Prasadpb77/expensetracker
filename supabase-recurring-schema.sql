-- ============================================================
-- Recurring Transactions Schema
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  -- Income fields
  source TEXT,
  -- Expense fields
  category TEXT,
  payment_method TEXT DEFAULT 'personal',
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_shared BOOLEAN DEFAULT false,
  split_ratio DECIMAL(3,2) DEFAULT 0.5,
  -- Common
  description TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_add BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  last_added_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_family ON public.recurring_transactions(family_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_due ON public.recurring_transactions(next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON public.recurring_transactions(is_active);

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_select" ON public.recurring_transactions
  FOR SELECT TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "recurring_insert" ON public.recurring_transactions
  FOR INSERT TO authenticated WITH CHECK (family_id = public.get_my_family_id() AND user_id = auth.uid());
CREATE POLICY "recurring_update" ON public.recurring_transactions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "recurring_delete" ON public.recurring_transactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER set_updated_at_recurring
  BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

SELECT 'Recurring transactions table created' AS result;
