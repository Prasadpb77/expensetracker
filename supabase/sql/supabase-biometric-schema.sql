-- ============================================================
-- Biometric / WebAuthn credentials storage
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.biometric_credentials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'My Device',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_biometric_user_id ON public.biometric_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credential_id ON public.biometric_credentials(credential_id);

ALTER TABLE public.biometric_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biometric_select_own" ON public.biometric_credentials
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "biometric_insert_own" ON public.biometric_credentials
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "biometric_delete_own" ON public.biometric_credentials
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "biometric_update_own" ON public.biometric_credentials
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

SELECT 'Biometric credentials table created' AS result;
