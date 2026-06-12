-- ============================================================
-- FamilyFinance - Complete Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  currency_symbol TEXT NOT NULL DEFAULT '₹',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('primary', 'spouse', 'member')),
  family_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FAMILY TABLE (links husband and wife)
-- ============================================================
CREATE TABLE public.families (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Family',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key from profiles to families
ALTER TABLE public.profiles ADD CONSTRAINT profiles_family_id_fkey 
  FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE SET NULL;

-- ============================================================
-- CATEGORIES TABLE
-- ============================================================
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '💰',
  color TEXT NOT NULL DEFAULT '#64748b',
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'both')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INCOME TABLE
-- ============================================================
CREATE TABLE public.income (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL DEFAULT 'Salary' CHECK (source IN ('Salary', 'Bonus', 'Freelance', 'Interest', 'Rental', 'Other')),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXPENSES TABLE
-- ============================================================
CREATE TABLE public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL DEFAULT 'Miscellaneous',
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  split_ratio DECIMAL(3, 2) DEFAULT 0.50 CHECK (split_ratio BETWEEN 0 AND 1),
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUDGETS TABLE
-- ============================================================
CREATE TABLE public.budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  monthly_limit DECIMAL(12, 2) NOT NULL CHECK (monthly_limit > 0),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(family_id, category, month, year)
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_income_user_id ON public.income(user_id);
CREATE INDEX idx_income_family_id ON public.income(family_id);
CREATE INDEX idx_income_date ON public.income(date DESC);
CREATE INDEX idx_income_source ON public.income(source);

CREATE INDEX idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX idx_expenses_family_id ON public.expenses(family_id);
CREATE INDEX idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX idx_expenses_category ON public.expenses(category);
CREATE INDEX idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX idx_expenses_is_shared ON public.expenses(is_shared);

CREATE INDEX idx_budgets_family_id ON public.budgets(family_id);
CREATE INDEX idx_budgets_month_year ON public.budgets(year, month);

CREATE INDEX idx_profiles_family_id ON public.profiles(family_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES - PROFILES
-- ============================================================
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view family member profiles" ON public.profiles
  FOR SELECT USING (
    family_id IS NOT NULL AND
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- RLS POLICIES - FAMILIES
-- ============================================================
CREATE POLICY "Family members can view their family" ON public.families
  FOR SELECT USING (
    id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create family" ON public.families
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Family creator can update family" ON public.families
  FOR UPDATE USING (created_by = auth.uid());

-- ============================================================
-- RLS POLICIES - CATEGORIES
-- ============================================================
CREATE POLICY "Anyone can view default categories" ON public.categories
  FOR SELECT USING (is_default = true);

CREATE POLICY "Family members can view family categories" ON public.categories
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can create categories" ON public.categories
  FOR INSERT WITH CHECK (
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Category creator can update/delete" ON public.categories
  FOR ALL USING (created_by = auth.uid());

-- ============================================================
-- RLS POLICIES - INCOME
-- ============================================================
CREATE POLICY "Family members can view all family income" ON public.income
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own income" ON public.income
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own income" ON public.income
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own income" ON public.income
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- RLS POLICIES - EXPENSES
-- ============================================================
CREATE POLICY "Family members can view all family expenses" ON public.expenses
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert expenses" ON public.expenses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own expenses" ON public.expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON public.expenses
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- RLS POLICIES - BUDGETS
-- ============================================================
CREATE POLICY "Family members can view budgets" ON public.budgets
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Family members can create budgets" ON public.budgets
  FOR INSERT WITH CHECK (
    family_id IN (
      SELECT family_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Budget creator can update/delete" ON public.budgets
  FOR ALL USING (created_by = auth.uid());

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_families
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_income
  BEFORE UPDATE ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_expenses
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_budgets
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DEFAULT CATEGORIES
-- ============================================================
INSERT INTO public.categories (name, icon, color, type, is_default) VALUES
  ('Food', '🍔', '#f97316', 'expense', true),
  ('Groceries', '🛒', '#84cc16', 'expense', true),
  ('Transport', '🚗', '#06b6d4', 'expense', true),
  ('Fuel', '⛽', '#f59e0b', 'expense', true),
  ('Shopping', '🛍️', '#ec4899', 'expense', true),
  ('Utilities', '💡', '#8b5cf6', 'expense', true),
  ('Mobile', '📱', '#6366f1', 'expense', true),
  ('Internet', '🌐', '#3b82f6', 'expense', true),
  ('Rent', '🏠', '#ef4444', 'expense', true),
  ('EMI', '🏦', '#dc2626', 'expense', true),
  ('Healthcare', '🏥', '#10b981', 'expense', true),
  ('Entertainment', '🎬', '#f43f5e', 'expense', true),
  ('Travel', '✈️', '#0ea5e9', 'expense', true),
  ('Investment', '📈', '#16a34a', 'expense', true),
  ('Education', '📚', '#7c3aed', 'expense', true),
  ('Miscellaneous', '📦', '#64748b', 'expense', true),
  ('Salary', '💼', '#16a34a', 'income', true),
  ('Bonus', '🎁', '#f59e0b', 'income', true),
  ('Freelance', '💻', '#6366f1', 'income', true),
  ('Interest', '💹', '#0ea5e9', 'income', true),
  ('Rental', '🏘️', '#84cc16', 'income', true),
  ('Other Income', '💰', '#64748b', 'income', true);

-- ============================================================
-- VIEWS FOR ANALYTICS
-- ============================================================

-- Monthly summary view
CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT
  family_id,
  DATE_TRUNC('month', date) AS month,
  SUM(amount) AS total_income,
  0 AS total_expenses
FROM public.income
GROUP BY family_id, DATE_TRUNC('month', date)
UNION ALL
SELECT
  family_id,
  DATE_TRUNC('month', date) AS month,
  0 AS total_income,
  SUM(amount) AS total_expenses
FROM public.expenses
GROUP BY family_id, DATE_TRUNC('month', date);

-- ============================================================
-- DONE! Your schema is ready.
-- ============================================================
