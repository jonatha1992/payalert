-- PayAlert Schema Update V2
-- Feature: Store-specific Integrations, Employee Assignments, Expenses

-- 1. Add 'assigned_store_id' to users table
-- This allows linking an employee to a specific store for filtering and notifications.
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS assigned_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- 2. Add 'store_id' to payment_tokens table
-- This allows linking a Mercado Pago/Uala credential to a specific store.
ALTER TABLE public.payment_tokens 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

-- Update constraint to ensure at least one link exists (Business or Store), preferably Store for V2.
-- We won't enforce a hard check now to avoid breaking existing data, but logic should prefer store_id.

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_assigned_store ON public.users(assigned_store_id);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_store ON public.payment_tokens(store_id);

-- 4. Verify 'transactions' table supports 'expense' type
-- (Already exists in V1: type IN ('income', 'expense'))

-- 5. Add RLS Policies for new relationships

-- Users: Employees can see other users assigned to the SAME store (e.g. co-workers)
CREATE POLICY "employees_read_coworkers" ON public.users
    FOR SELECT USING (
        assigned_store_id IS NOT NULL AND
        assigned_store_id = (SELECT assigned_store_id FROM public.users WHERE id = auth.uid())
    );

-- Tokens: Owners can see tokens for their stores
CREATE POLICY "owners_access_store_tokens" ON public.payment_tokens
    FOR ALL USING (
        store_id IN (
            SELECT s.id FROM public.stores s
            JOIN public.users u ON s.business_id = u.business_id
            WHERE u.id = auth.uid() AND u.role = 'owner'
        )
    );

-- 6. Add 'notifications' column to stores settings (optional, but good for granularity)
-- We will use the existing JSONB 'settings' column in 'stores' and 'businesses'.
-- No DDL needed, just application logic update.
