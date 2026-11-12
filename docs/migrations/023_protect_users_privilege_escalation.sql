-- 023_protect_users_privilege_escalation.sql
-- Fix PA-001: Prevent privilege escalation on public.users via Supabase REST.
-- Drops unconstrained users_self_update policy and recreates with WITH CHECK(id = auth.uid()),
-- and adds a BEFORE UPDATE trigger preventing non-admins from changing role or business_id.

BEGIN;

-- 1. Recreate users_self_update with WITH CHECK
DROP POLICY IF EXISTS "users_self_update" ON public.users;
CREATE POLICY "users_self_update" ON public.users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 2. Trigger function to protect critical columns (role, business_id)
CREATE OR REPLACE FUNCTION public.protect_users_critical_columns()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- If role or business_id hasn't changed, allow the update immediately
    IF (NEW.role IS NOT DISTINCT FROM OLD.role) AND (NEW.business_id IS NOT DISTINCT FROM OLD.business_id) THEN
        RETURN NEW;
    END IF;

    -- Service role (e.g. backend / scripts / migrations) is trusted
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- If session user is postgres / rds_superuser (local scripts or DB admin direct connections)
    IF current_user IN ('postgres', 'supabase_admin') AND current_setting('request.jwt.claim.sub', true) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if the calling authenticated user is an admin
    v_caller_role := public.current_user_role();
    IF v_caller_role = 'admin' THEN
        RETURN NEW;
    END IF;

    -- Any non-admin attempting to change role or business_id is rejected
    RAISE EXCEPTION 'Unauthorized: only administrators can change role or business_id'
        USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Attach trigger BEFORE UPDATE on public.users
DROP TRIGGER IF EXISTS tr_protect_users_critical_columns ON public.users;
CREATE TRIGGER tr_protect_users_critical_columns
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_users_critical_columns();

COMMIT;
