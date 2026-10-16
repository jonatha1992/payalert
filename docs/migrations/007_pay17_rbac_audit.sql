-- PAY-17: scoped audit events. Apply manually; never run during tests.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NULL REFERENCES public.businesses(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  new_data jsonb NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON public.audit_logs (business_id, created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pay17_audit_insert_actor ON public.audit_logs;
CREATE POLICY pay17_audit_insert_actor ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (business_id IS NULL OR u.business_id = business_id OR u.role = 'admin')));
DROP POLICY IF EXISTS pay17_audit_read_tenant_admin ON public.audit_logs;
CREATE POLICY pay17_audit_read_tenant_admin ON public.audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'admin' OR (u.role = 'owner' AND u.business_id = audit_logs.business_id))));
