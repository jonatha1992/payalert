-- test_pa001_users_privilege_escalation.sql
-- Comprehensive verification for PA-001 (RLS and trigger protection)

BEGIN;

-- Create test businesses
INSERT INTO public.businesses (id, name)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Business One'),
  ('22222222-2222-2222-2222-222222222222', 'Business Two');

-- Create test users:
-- User A: normal staff / employee in Business One
-- User B: normal staff in Business One
-- User Admin: admin user
INSERT INTO public.users (id, email, first_name, last_name, role, business_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user_a@test.com', 'User', 'A', 'employee', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user_b@test.com', 'User', 'B', 'employee', '11111111-1111-1111-1111-111111111111'),
  ('99999999-9999-9999-9999-999999999999', 'admin@test.com', 'Admin', 'User', 'admin', '11111111-1111-1111-1111-111111111111');

COMMIT;

-- Create authenticated role if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
END $$;

--------------------------------------------------------------------------------
-- TEST 1: User A updates own allowed fields (first_name, last_name)
--------------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

UPDATE public.users
SET first_name = 'UpdatedNameA', last_name = 'NewLastName'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT id, first_name, last_name, role, business_id
FROM public.users
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
ROLLBACK;

--------------------------------------------------------------------------------
-- TEST 2: User A attempts privilege escalation (role = 'admin') -> MUST FAIL
--------------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

DO $$ BEGIN
  BEGIN
    UPDATE public.users
    SET role = 'admin'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'TEST FAILED: non-admin user was able to escalate role!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'TEST 2 PASSED: role change correctly blocked (SQLSTATE 42501): %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'TEST 2 FAILED with unexpected error: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END IF;
  END;
END $$;
ROLLBACK;

--------------------------------------------------------------------------------
-- TEST 3: User A attempts business_id change -> MUST FAIL
--------------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

DO $$ BEGIN
  BEGIN
    UPDATE public.users
    SET business_id = '22222222-2222-2222-2222-222222222222'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'TEST FAILED: non-admin user was able to change business_id!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'TEST 3 PASSED: business_id change correctly blocked (SQLSTATE 42501): %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'TEST 3 FAILED with unexpected error: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    END IF;
  END;
END $$;
ROLLBACK;

--------------------------------------------------------------------------------
-- TEST 4: User A attempts to update User B's row -> MUST AFFECT 0 ROWS
--------------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

DO $$ 
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.users
  SET first_name = 'HackedName'
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated = 0 THEN
    RAISE NOTICE 'TEST 4 PASSED: updating another user affected 0 rows';
  ELSE
    RAISE EXCEPTION 'TEST 4 FAILED: updated % rows for other user!', v_updated;
  END IF;
END $$;
ROLLBACK;

--------------------------------------------------------------------------------
-- TEST 5: Admin can change another user's role
--------------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claim.sub" = '99999999-9999-9999-9999-999999999999'; -- Admin ID

UPDATE public.users
SET role = 'owner'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT id, role FROM public.users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
ROLLBACK;

--------------------------------------------------------------------------------
-- TEST 6: Service role can update user role
--------------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.role" = 'service_role';
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000000';

UPDATE public.users
SET role = 'owner'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT id, role FROM public.users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
ROLLBACK;
