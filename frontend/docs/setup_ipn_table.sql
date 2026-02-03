-- PayAlert V2: IPN & Webhooks Support for Transactions
-- Run this in your Supabase SQL Editor

-- 1. Ensure transactions table has necessary columns
DO $$
BEGIN
    -- Add provider
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='provider') THEN
        ALTER TABLE public.transactions ADD COLUMN provider TEXT;
    END IF;

    -- Add external_id (from MP/Ualá)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='external_id') THEN
        ALTER TABLE public.transactions ADD COLUMN external_id TEXT;
    END IF;

    -- Add metadata (JSONB for full payload)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='metadata') THEN
        ALTER TABLE public.transactions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add store_id relation if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='store_id') THEN
        ALTER TABLE public.transactions ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON public.transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider ON public.transactions(provider);
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON public.transactions(store_id);

-- 3. RLS - Allow Service Role (Server) full access
-- Note: Service role ignores RLS, so this is just documentation.
-- But if we want to allow employees to READ their store's transactions:
DROP POLICY IF EXISTS "employees_read_store_transactions" ON public.transactions;
CREATE POLICY "employees_read_store_transactions" ON public.transactions
    FOR SELECT USING (
        store_id = get_my_assigned_store_id()
    );

-- Allow Owners to read all business transactions
DROP POLICY IF EXISTS "owners_read_all_transactions" ON public.transactions;
CREATE POLICY "owners_read_all_transactions" ON public.transactions
    FOR ALL USING (
        get_my_role() = 'owner'
    );
