-- Invitation-based Mercado Pago OAuth for client apps; execute explicitly with admin credentials.
BEGIN;

CREATE TABLE IF NOT EXISTS public.connect_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_app_id uuid NOT NULL REFERENCES public.client_apps(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connect_invites ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service-role server access only.
REVOKE ALL ON public.connect_invites FROM anon, authenticated;

ALTER TABLE public.mp_oauth_states ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.mp_oauth_states
  ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.connect_invites(id) ON DELETE CASCADE;

ALTER TABLE public.client_apps
  ADD COLUMN IF NOT EXISTS connect_return_url text;

COMMIT;
