BEGIN;

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  expo_push_token text NOT NULL UNIQUE,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_business_idx
  ON public.device_push_tokens (user_id, business_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS device_push_tokens_business_idx
  ON public.device_push_tokens (business_id) WHERE revoked_at IS NULL;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device_push_tokens_read_own" ON public.device_push_tokens;
CREATE POLICY "device_push_tokens_read_own" ON public.device_push_tokens
  FOR SELECT USING (user_id = auth.uid() AND business_id IN (
    SELECT business_id FROM public.users WHERE id = auth.uid()
  ));
DROP POLICY IF EXISTS "device_push_tokens_insert_own" ON public.device_push_tokens;
CREATE POLICY "device_push_tokens_insert_own" ON public.device_push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid() AND business_id IN (
    SELECT business_id FROM public.users WHERE id = auth.uid()
  ));
DROP POLICY IF EXISTS "device_push_tokens_update_own" ON public.device_push_tokens;
CREATE POLICY "device_push_tokens_update_own" ON public.device_push_tokens
  FOR UPDATE USING (user_id = auth.uid() AND business_id IN (
    SELECT business_id FROM public.users WHERE id = auth.uid()
  )) WITH CHECK (user_id = auth.uid() AND business_id IN (
    SELECT business_id FROM public.users WHERE id = auth.uid()
  ));
DROP POLICY IF EXISTS "device_push_tokens_delete_own" ON public.device_push_tokens;
CREATE POLICY "device_push_tokens_delete_own" ON public.device_push_tokens
  FOR DELETE USING (user_id = auth.uid() AND business_id IN (
    SELECT business_id FROM public.users WHERE id = auth.uid()
  ));

REVOKE ALL ON TABLE public.device_push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_push_tokens TO authenticated;
GRANT ALL ON TABLE public.device_push_tokens TO service_role;

COMMIT;
