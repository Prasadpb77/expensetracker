-- ============================================================
-- COMPLETE FIX v3 — Run entire script in Supabase SQL Editor
-- Fixes: infinite recursion, join invite code, schema cache
-- ============================================================

-- ── STEP 1: Drop ALL existing policies ──────────────────────
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view family member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_family" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "Family members can view their family" ON public.families;
DROP POLICY IF EXISTS "Authenticated users can create family" ON public.families;
DROP POLICY IF EXISTS "Family creator can update family" ON public.families;
DROP POLICY IF EXISTS "families_insert" ON public.families;
DROP POLICY IF EXISTS "families_select" ON public.families;
DROP POLICY IF EXISTS "families_update" ON public.families;

DROP POLICY IF EXISTS "Family members can view all family income" ON public.income;
DROP POLICY IF EXISTS "Users can insert own income" ON public.income;
DROP POLICY IF EXISTS "Users can update own income" ON public.income;
DROP POLICY IF EXISTS "Users can delete own income" ON public.income;
DROP POLICY IF EXISTS "income_select_family" ON public.income;
DROP POLICY IF EXISTS "income_insert_own" ON public.income;
DROP POLICY IF EXISTS "income_update_own" ON public.income;
DROP POLICY IF EXISTS "income_delete_own" ON public.income;

DROP POLICY IF EXISTS "Family members can view all family expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_family" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_own" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_own" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_own" ON public.expenses;

DROP POLICY IF EXISTS "Family members can view budgets" ON public.budgets;
DROP POLICY IF EXISTS "Family members can create budgets" ON public.budgets;
DROP POLICY IF EXISTS "Budget creator can update/delete" ON public.budgets;
DROP POLICY IF EXISTS "budgets_select_family" ON public.budgets;
DROP POLICY IF EXISTS "budgets_insert_family" ON public.budgets;
DROP POLICY IF EXISTS "budgets_update_own" ON public.budgets;
DROP POLICY IF EXISTS "budgets_delete_own" ON public.budgets;

DROP POLICY IF EXISTS "Anyone can view default categories" ON public.categories;
DROP POLICY IF EXISTS "Family members can view family categories" ON public.categories;
DROP POLICY IF EXISTS "Family members can create categories" ON public.categories;
DROP POLICY IF EXISTS "Category creator can update/delete" ON public.categories;
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_modify" ON public.categories;

-- ── STEP 2: SECURITY DEFINER helper (breaks recursion) ──────
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── STEP 3: PROFILES policies (no self-referencing subquery) ─
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_select_family"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    family_id IS NOT NULL
    AND family_id = public.get_my_family_id()
  );

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── STEP 4: FAMILIES policies ────────────────────────────────
-- Anyone authenticated can create
CREATE POLICY "families_insert"
  ON public.families FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Can see own family OR families you created
-- ALSO allow seeing a family by invite_code lookup (needed for joinFamily)
-- We use a permissive select so the invite code lookup works
CREATE POLICY "families_select"
  ON public.families FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id = public.get_my_family_id()
  );

-- Separate policy: allow lookup by invite_code for joining
-- (authenticated users can read any family to look up by invite code)
CREATE POLICY "families_select_for_join"
  ON public.families FOR SELECT TO authenticated
  USING (true);  -- any authenticated user can read families table for invite lookup

-- Only creator can update
CREATE POLICY "families_update"
  ON public.families FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- ── STEP 5: INCOME policies ──────────────────────────────────
CREATE POLICY "income_select_family"
  ON public.income FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "income_insert_own"
  ON public.income FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND family_id = public.get_my_family_id()
  );

CREATE POLICY "income_update_own"
  ON public.income FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "income_delete_own"
  ON public.income FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── STEP 6: EXPENSES policies ────────────────────────────────
CREATE POLICY "expenses_select_family"
  ON public.expenses FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "expenses_insert_own"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND family_id = public.get_my_family_id()
  );

CREATE POLICY "expenses_update_own"
  ON public.expenses FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "expenses_delete_own"
  ON public.expenses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── STEP 7: BUDGETS policies ─────────────────────────────────
CREATE POLICY "budgets_select_family"
  ON public.budgets FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "budgets_insert_family"
  ON public.budgets FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "budgets_update_own"
  ON public.budgets FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "budgets_delete_own"
  ON public.budgets FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ── STEP 8: CATEGORIES policies ──────────────────────────────
CREATE POLICY "categories_select"
  ON public.categories FOR SELECT TO authenticated
  USING (
    is_default = true
    OR family_id = public.get_my_family_id()
  );

CREATE POLICY "categories_insert"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "categories_modify"
  ON public.categories FOR ALL TO authenticated
  USING (created_by = auth.uid());

-- ── STEP 9: Ensure invite_code auto-generated ────────────────
CREATE OR REPLACE FUNCTION public.ensure_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := encode(gen_random_bytes(6), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_invite_code_trigger ON public.families;
CREATE TRIGGER ensure_invite_code_trigger
  BEFORE INSERT ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.ensure_invite_code();

SELECT 'v3 complete — all policies fixed' AS result;
