-- =====================================================
-- PayAlert Database Reset Script
-- =====================================================
-- ADVERTENCIA: Este script BORRA TODOS LOS DATOS
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Desactivar temporalmente las restricciones de FK
SET session_replication_role = replica;

-- 2. Eliminar datos de tablas públicas (en orden)
TRUNCATE TABLE public.payment_tokens CASCADE;
TRUNCATE TABLE public.transactions CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.stores CASCADE;
TRUNCATE TABLE public.users CASCADE;
TRUNCATE TABLE public.businesses CASCADE;

-- 3. Eliminar usuarios de autenticación
DELETE FROM auth.users;

-- 4. Reactivar restricciones
SET session_replication_role = DEFAULT;

-- =====================================================
-- VERIFICACIÓN: Confirmar que las tablas están vacías
-- =====================================================
SELECT 'businesses' as tabla, COUNT(*) as registros FROM public.businesses
UNION ALL SELECT 'users', COUNT(*) FROM public.users
UNION ALL SELECT 'stores', COUNT(*) FROM public.stores
UNION ALL SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL SELECT 'payment_tokens', COUNT(*) FROM public.payment_tokens
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users;
