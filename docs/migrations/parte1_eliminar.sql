-- PARTE 1: ELIMINAR TODO
-- Ejecutar primero esto solo

DROP TABLE IF EXISTS public.webhook_logs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.payment_tokens CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;
DROP TABLE IF EXISTS public.businesses CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_logs CASCADE;

SELECT 'Todas las tablas eliminadas' as status;
