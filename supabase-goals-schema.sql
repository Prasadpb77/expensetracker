-- ============================================================
-- Goals & Contributions Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🌟',
  target_amount DECIMAL(14, 2) NOT NULL CHECK (target_amount > 0),
  saved_amount DECIMAL(14, 2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  deadline DATE,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Goal contributions (each deposit toward a goal)
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(14, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_family_id ON public.goals(family_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id ON public.goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_family_id ON public.goal_contributions(family_id);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

-- RLS Policies using the helper function
CREATE POLICY "goals_select" ON public.goals FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "goals_insert" ON public.goals FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "goals_update" ON public.goals FOR UPDATE TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "goals_delete" ON public.goals FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "contributions_select" ON public.goal_contributions FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "contributions_insert" ON public.goal_contributions FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "contributions_delete" ON public.goal_contributions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Auto-update updated_at on goals
CREATE TRIGGER set_updated_at_goals
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update saved_amount on goals when contribution added
CREATE OR REPLACE FUNCTION public.update_goal_saved_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.goals
    SET saved_amount = saved_amount + NEW.amount,
        is_completed = (saved_amount + NEW.amount >= target_amount)
    WHERE id = NEW.goal_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.goals
    SET saved_amount = GREATEST(0, saved_amount - OLD.amount),
        is_completed = (GREATEST(0, saved_amount - OLD.amount) >= target_amount)
    WHERE id = OLD.goal_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_contribution_change ON public.goal_contributions;
CREATE TRIGGER on_contribution_change
  AFTER INSERT OR DELETE ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_goal_saved_amount();

SELECT 'Goals schema created successfully' AS result;
