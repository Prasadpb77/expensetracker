-- ============================================================
-- FIX: Security Definer View on public.monthly_summary
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Step 1: Drop the existing view
DROP VIEW IF EXISTS public.monthly_summary;

-- Step 2: Recreate with security_invoker = true (NOT security definer)
-- This means the view runs as the CALLING USER, not the view owner
-- So RLS policies are respected — users only see their own family data
CREATE VIEW public.monthly_summary
WITH (security_invoker = true)
AS
SELECT
  family_id,
  DATE_TRUNC('month', date) AS month,
  SUM(amount)    AS total_income,
  0::numeric     AS total_expenses
FROM public.income
GROUP BY family_id, DATE_TRUNC('month', date)

UNION ALL

SELECT
  family_id,
  DATE_TRUNC('month', date) AS month,
  0::numeric     AS total_income,
  SUM(amount)    AS total_expenses
FROM public.expenses
GROUP BY family_id, DATE_TRUNC('month', date);

-- Step 3: Verify it's fixed (should show security_invoker = true)
SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'monthly_summary';

SELECT 'Security Definer View fixed successfully' AS result;

-- ============================================================
-- CLEANUP FUNCTION: deletes records older than N years
-- Called by the cleanup-old-data Edge Function
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_old_records(years_old integer DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_date   date;
  del_expenses  integer;
  del_income    integer;
  del_contribs  integer;
  deact_recur   integer;
BEGIN
  cutoff_date := CURRENT_DATE - (years_old || ' years')::interval;

  DELETE FROM public.expenses WHERE date < cutoff_date;
  GET DIAGNOSTICS del_expenses = ROW_COUNT;

  DELETE FROM public.income WHERE date < cutoff_date;
  GET DIAGNOSTICS del_income = ROW_COUNT;

  DELETE FROM public.goal_contributions WHERE date < cutoff_date;
  GET DIAGNOSTICS del_contribs = ROW_COUNT;

  UPDATE public.recurring_transactions
    SET is_active = false
    WHERE end_date IS NOT NULL AND end_date < cutoff_date;
  GET DIAGNOSTICS deact_recur = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff_date',             cutoff_date,
    'deleted_expenses',        del_expenses,
    'deleted_income',          del_income,
    'deleted_goal_contributions', del_contribs,
    'deactivated_recurring',   deact_recur,
    'status',                  'success'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_old_records FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_old_records TO authenticated;

SELECT 'Cleanup function created successfully' AS result;
