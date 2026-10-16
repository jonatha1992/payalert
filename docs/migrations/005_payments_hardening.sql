-- 005: payments hardening (KAN-73, KAN-75)
-- Run once in the Supabase SQL editor after parte1-3 + frontend/docs/update_v2_full.sql + setup_ipn_table.sql.
-- Idempotent: safe to re-run.
--
-- What it does
--   1. payment_connections: one row per provider account linked to a business, credentials encrypted
--      by the app (AES-256-GCM, PAYMENTS_ENCRYPTION_KEY). No RLS policies => only the service role reads it.
--   2. transactions: normalized columns + UNIQUE (provider, external_id) for idempotent ingestion.
--   3. expected_payments: "cobro esperado" + matching result.
--   4. webhook_logs: business_id + new statuses (unmatched, ignored), owner policy by business.
--   5. payment_tokens: owners can no longer read secrets from the browser.

BEGIN;

-- 1. PAYMENT CONNECTIONS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'uala', 'mock')),
    provider_account_id TEXT,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'CONNECTED'
        CHECK (status IN ('CONNECTED', 'DEGRADED', 'REAUTH_REQUIRED', 'DISCONNECTED', 'ERROR')),
    credentials_encrypted TEXT NOT NULL CHECK (credentials_encrypted LIKE 'enc:v1:%'),
    webhook_secret_encrypted TEXT CHECK (webhook_secret_encrypted IS NULL OR webhook_secret_encrypted LIKE 'enc:v1:%'),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- A provider account can only belong to one business: this is what routes a webhook to its tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_connections_provider_account
    ON public.payment_connections(provider, provider_account_id)
    WHERE provider_account_id IS NOT NULL AND status <> 'DISCONNECTED';
CREATE INDEX IF NOT EXISTS idx_payment_connections_business ON public.payment_connections(business_id, provider);

ALTER TABLE public.payment_connections ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: browser clients cannot read or write this table.

DROP TRIGGER IF EXISTS update_payment_connections_updated_at ON public.payment_connections;
CREATE TRIGGER update_payment_connections_updated_at BEFORE UPDATE ON public.payment_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. TRANSACTIONS -------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ARS';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS connection_id UUID
    REFERENCES public.payment_connections(id) ON DELETE SET NULL;

-- Pre-check: this must return zero rows before the unique index can be created.
--   SELECT provider, external_id, count(*) FROM public.transactions
--   WHERE external_id IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
-- Full (non-partial) index so PostgREST upserts can target it with on_conflict=provider,external_id.
-- NULLs never collide, so manual expenses without provider are unaffected.
-- Keep the existing unique index on re-run; dropping it creates an unsafe ingestion window.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_provider_external
    ON public.transactions(provider, external_id);

-- 3. EXPECTED PAYMENTS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expected_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'ARS',
    reference TEXT,
    status TEXT NOT NULL DEFAULT 'WAITING'
        CHECK (status IN ('WAITING', 'MATCHED', 'EXPIRED', 'MANUAL_REVIEW', 'CANCELLED')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    provider TEXT CHECK (provider IS NULL OR provider IN ('mercado_pago', 'uala', 'mock')),
    connection_id UUID REFERENCES public.payment_connections(id) ON DELETE SET NULL,
    provider_order_id TEXT,
    checkout_url TEXT,
    matched_transaction_id TEXT REFERENCES public.transactions(id) ON DELETE SET NULL,
    match_score INTEGER,
    match_candidates JSONB DEFAULT '[]'::jsonb,
    matched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expected_payments_open
    ON public.expected_payments(business_id, status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_expected_payments_provider_order
    ON public.expected_payments(provider, provider_order_id);
-- One transaction can settle at most one expected payment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_expected_payments_matched_tx
    ON public.expected_payments(matched_transaction_id)
    WHERE matched_transaction_id IS NOT NULL;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS expected_payment_id UUID
    REFERENCES public.expected_payments(id) ON DELETE SET NULL;

ALTER TABLE public.expected_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expected_payments_owner_all" ON public.expected_payments;
CREATE POLICY "expected_payments_owner_all" ON public.expected_payments
    FOR SELECT USING (
        business_id IN (
            SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner'
        )
    );

DROP POLICY IF EXISTS "expected_payments_employee_store" ON public.expected_payments;
CREATE POLICY "expected_payments_employee_store" ON public.expected_payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.role = 'employee'
              AND u.business_id = expected_payments.business_id
              AND u.assigned_store_id = expected_payments.store_id
        )
    );
-- Writes go through /api/expected-payments (service role, scope resolved from the session).

DROP TRIGGER IF EXISTS update_expected_payments_updated_at ON public.expected_payments;
CREATE TRIGGER update_expected_payments_updated_at BEFORE UPDATE ON public.expected_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. WEBHOOK LOGS -------------------------------------------------------------
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS business_id UUID
    REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.webhook_logs DROP CONSTRAINT IF EXISTS webhook_logs_provider_check;
ALTER TABLE public.webhook_logs ADD CONSTRAINT webhook_logs_provider_check
    CHECK (provider IN ('mercado_pago', 'uala', 'mock'));

ALTER TABLE public.webhook_logs DROP CONSTRAINT IF EXISTS webhook_logs_status_check;
ALTER TABLE public.webhook_logs ADD CONSTRAINT webhook_logs_status_check
    CHECK (status IN ('received', 'processing', 'completed', 'failed', 'invalid', 'unmatched', 'ignored'));

CREATE INDEX IF NOT EXISTS idx_webhook_logs_business ON public.webhook_logs(business_id, created_at DESC);

DROP POLICY IF EXISTS "webhook_logs_owner_access" ON public.webhook_logs;
CREATE POLICY "webhook_logs_owner_access" ON public.webhook_logs
    FOR SELECT USING (
        business_id IN (
            SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- 5. LEGACY PAYMENT TOKENS ----------------------------------------------------
-- Secrets must not be readable from the browser. The dashboard now uses /api/integrations.
DROP POLICY IF EXISTS "payment_tokens_owner_all" ON public.payment_tokens;
DROP POLICY IF EXISTS "owners_manage_tokens" ON public.payment_tokens;
-- After running scripts/migrate-payment-tokens.mjs and checking payment_connections:
--   DROP TABLE public.payment_tokens;

COMMIT;
