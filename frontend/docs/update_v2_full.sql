-- PayAlert V2 Full Update & Fix
-- Includes:
-- 1. New Columns for Stores/Employees
-- 2. Fix for RLS Infinite Recursion
-- 3. Preparation for Expenses

-- =============================================
-- 1. SCHEMA UPDATES (Safe to run multiple times)
-- =============================================

-- Add 'assigned_store_id' to users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='assigned_store_id') THEN
        ALTER TABLE public.users ADD COLUMN assigned_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add 'store_id' to payment_tokens table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_tokens' AND column_name='store_id') THEN
        ALTER TABLE public.payment_tokens ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_users_assigned_store ON public.users(assigned_store_id);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_store ON public.payment_tokens(store_id);


-- =============================================
-- 2. RLS RECURSION FIX
-- =============================================

-- Drop the potentially problematic policy if it exists (or the old one)
DROP POLICY IF EXISTS "employees_read_coworkers" ON public.users;
DROP POLICY IF EXISTS "employees_read_coworkers_v2" ON public.users;

-- Create/Replace helper functions for safer access
CREATE OR REPLACE FUNCTION get_my_assigned_store_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_store_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_business_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- Create the Safe Policy (Employee)
CREATE POLICY "employees_read_coworkers_v2" ON public.users
    FOR SELECT USING (
        assigned_store_id IS NOT NULL 
        AND assigned_store_id = get_my_assigned_store_id()
    );

-- Allow Users to Read their OWN profile (Always required)
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
    FOR SELECT USING (
        auth.uid() = id
    );

-- Allow Owners to read ALL users in their business (FIXED RECURSION)
DROP POLICY IF EXISTS "owners_read_business_users" ON public.users;
CREATE POLICY "owners_read_business_users" ON public.users
    FOR ALL USING (
        get_my_role() = 'owner'
        AND business_id = get_my_business_id()
    );


-- =============================================
-- 3. PAYMENT TOKENS POLICIES
-- =============================================

-- Allow Owners to manage tokens
DROP POLICY IF EXISTS "owners_manage_tokens" ON public.payment_tokens;
CREATE POLICY "owners_manage_tokens" ON public.payment_tokens
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM users WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- Allow Stores (via server/webhook) or Employees to Read Tokens? 
-- Usually only Backend needs this, or Owner. 
-- Employees typically don't need to see Token Secrets.

