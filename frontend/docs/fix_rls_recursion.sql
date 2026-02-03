-- FIX RLS Recursion Issue
-- The previous policy caused infinite recursion by querying users table within users table policy.

-- 1. Drop the problematic policy
DROP POLICY IF EXISTS "employees_read_coworkers" ON public.users;

-- 2. Create a specific helper function to get current user's store safely
-- SECURITY DEFINER ensures it runs with owner privileges, bypassing RLS
CREATE OR REPLACE FUNCTION get_my_assigned_store_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_store_id FROM users WHERE id = auth.uid();
$$;

-- 3. Re-create the policy using the safe function
CREATE POLICY "employees_read_coworkers_v2" ON public.users
    FOR SELECT USING (
        assigned_store_id IS NOT NULL 
        AND assigned_store_id = get_my_assigned_store_id()
    );

-- 4. Ensure other policies are correct (Owners)
-- (Existing policies usually handled by 'users_read_own' or similar)
