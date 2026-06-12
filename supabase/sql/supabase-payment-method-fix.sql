-- ============================================================
-- Add payment_method column + new categories
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add payment_method column to expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'personal'
  CHECK (payment_method IN ('personal', 'joint_account', 'credit_card'));

-- 2. Add index for filtering
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON public.expenses(payment_method);

-- 3. Insert new default categories
INSERT INTO public.categories (name, icon, color, type, is_default)
VALUES
  ('Family Contribution', '👨‍👩‍👧', '#f43f5e', 'expense', true),
  ('Fruits & Dry Fruits',  '🍎', '#84cc16', 'expense', true),
  ('Vegetables',           '🥦', '#22c55e', 'expense', true),
  ('RD / Goals',           '🏦', '#6366f1', 'expense', true),
  ('Gifts',                '🎁', '#ec4899', 'expense', true)
ON CONFLICT DO NOTHING;

SELECT 'payment_method column and new categories added' AS result;
