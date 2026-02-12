-- MIGRACIÓN: Datos de Prueba/Simulados - CORREGIDA
-- =========================================

-- Limpiar datos existentes
TRUNCATE TABLE public.push_subscriptions CASCADE;
TRUNCATE TABLE public.webhook_logs CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.transactions CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.payment_tokens CASCADE;
TRUNCATE TABLE public.users CASCADE;
TRUNCATE TABLE public.stores CASCADE;
TRUNCATE TABLE public.businesses CASCADE;

-- =========================================
-- 1. CREAR NEGOCIO
-- =========================================
INSERT INTO public.businesses (id, name, settings) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
 'Supermercado El Ahorro', 
 '{"currency": "ARS", "theme": "light"}'::jsonb
);

-- =========================================
-- 2. CREAR USUARIOS
-- =========================================
INSERT INTO public.users (id, business_id, email, role, first_name, last_name) VALUES
('11111111-1111-1111-1111-111111111111',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'jonny.correa@gmail.com',
 'owner',
 'Jonatha',
 'Correa'
),
('22222222-2222-2222-2222-222222222222',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'maria.garcia@ejemplo.com',
 'employee',
 'María',
 'García'
),
('33333333-3333-3333-3333-333333333333',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'carlos.lopez@ejemplo.com',
 'employee',
 'Carlos',
 'López'
),
('44444444-4444-4444-4444-444444444444',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'ana.martinez@ejemplo.com',
 'employee',
 'Ana',
 'Martínez'
);

-- =========================================
-- 3. CREAR SUCURSALES (UUIDs válidos)
-- =========================================
INSERT INTO public.stores (id, business_id, name, address, phone, is_active) VALUES
('b1111111-1111-1111-1111-111111111111',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Sucursal Centro',
 'Av. Corrientes 1234, CABA',
 '+54 11 4567-8901',
 true
),
('b2222222-2222-2222-2222-222222222222',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Sucursal Palermo',
 'Av. Santa Fe 3456, Palermo',
 '+54 11 4567-8902',
 true
),
('b3333333-3333-3333-3333-333333333333',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Sucursal Belgrano',
 'Av. Cabildo 5678, Belgrano',
 '+54 11 4567-8903',
 true
),
('b4444444-4444-4444-4444-444444444444',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Sucursal Recoleta',
 'Av. Callao 7890, Recoleta',
 '+54 11 4567-8904',
 false
);

-- Asignar empleados a sucursales
UPDATE public.users SET assigned_store_id = 'b1111111-1111-1111-1111-111111111111' 
WHERE id = '22222222-2222-2222-2222-222222222222';

UPDATE public.users SET assigned_store_id = 'b2222222-2222-2222-2222-222222222222' 
WHERE id = '33333333-3333-3333-3333-333333333333';

UPDATE public.users SET assigned_store_id = 'b3333333-3333-3333-3333-333333333333' 
WHERE id = '44444444-4444-4444-4444-444444444444';

-- =========================================
-- 4. FUNCIÓN AUXILIAR
-- =========================================
CREATE OR REPLACE FUNCTION random_date(start_date date, end_date date)
RETURNS timestamp with time zone AS $$
BEGIN
    RETURN start_date + (random() * (end_date - start_date + 1))::int + 
           (random() * interval '23 hours 59 minutes');
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 5. CREAR INGRESOS (200 transacciones)
-- =========================================
INSERT INTO public.transactions (
    id, business_id, store_id, type, amount, description, category, 
    status, provider, created_at
)
SELECT 
    'txn_' || gen_random_uuid(),
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    CASE 
        WHEN random() < 0.4 THEN 'b1111111-1111-1111-1111-111111111111'::uuid
        WHEN random() < 0.7 THEN 'b2222222-2222-2222-2222-222222222222'::uuid
        ELSE 'b3333333-3333-3333-3333-333333333333'::uuid
    END,
    'income',
    round((random() * 25000 + 1500)::numeric, 2),
    CASE 
        WHEN random() < 0.3 THEN 'Venta de mercadería'
        WHEN random() < 0.6 THEN 'Cobro en caja'
        WHEN random() < 0.8 THEN 'Pago con QR'
        ELSE 'Venta online'
    END,
    'Ventas',
    'completed',
    CASE WHEN random() > 0.5 THEN 'mercado_pago' ELSE 'uala' END,
    random_date(current_date - 60, current_date)
FROM generate_series(1, 200);

-- =========================================
-- 6. CREAR GASTOS (80 transacciones)
-- =========================================
INSERT INTO public.transactions (
    id, business_id, store_id, type, amount, description, category,
    status, created_at
)
SELECT 
    'txn_' || gen_random_uuid(),
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    CASE 
        WHEN random() < 0.4 THEN 'b1111111-1111-1111-1111-111111111111'::uuid
        WHEN random() < 0.7 THEN 'b2222222-2222-2222-2222-222222222222'::uuid
        ELSE 'b3333333-3333-3333-3333-333333333333'::uuid
    END,
    'expense',
    round((random() * 15000 + 500)::numeric, 2),
    CASE (random() * 10)::int
        WHEN 0 THEN 'Compra de mercadería'
        WHEN 1 THEN 'Pago de alquiler'
        WHEN 2 THEN 'Servicios (luz, gas, agua)'
        WHEN 3 THEN 'Sueldos y cargas sociales'
        WHEN 4 THEN 'Mantenimiento equipos'
        WHEN 5 THEN 'Publicidad y marketing'
        WHEN 6 THEN 'Gastos de limpieza'
        WHEN 7 THEN 'Seguridad'
        WHEN 8 THEN 'Impuestos municipales'
        ELSE 'Otros gastos operativos'
    END,
    CASE (random() * 10)::int
        WHEN 0 THEN 'Inventario'
        WHEN 1 THEN 'Alquiler'
        WHEN 2 THEN 'Servicios'
        WHEN 3 THEN 'Personal'
        WHEN 4 THEN 'Mantenimiento'
        WHEN 5 THEN 'Marketing'
        WHEN 6 THEN 'Limpieza'
        WHEN 7 THEN 'Seguridad'
        WHEN 8 THEN 'Impuestos'
        ELSE 'Otros'
    END,
    'completed',
    random_date(current_date - 60, current_date)
FROM generate_series(1, 80);

-- =========================================
-- 7. CREAR PAGOS (50 simulados)
-- =========================================
INSERT INTO public.payments (
    id, business_id, store_id, provider, external_id, amount, 
    currency, status, description, created_at
)
SELECT 
    gen_random_uuid(),
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    CASE 
        WHEN random() < 0.4 THEN 'b1111111-1111-1111-1111-111111111111'::uuid
        WHEN random() < 0.7 THEN 'b2222222-2222-2222-2222-222222222222'::uuid
        ELSE 'b3333333-3333-3333-3333-333333333333'::uuid
    END,
    CASE WHEN random() > 0.5 THEN 'mercado_pago' ELSE 'uala' END,
    'EXT_' || floor(random() * 1000000)::text,
    round((random() * 20000 + 1000)::numeric, 2),
    'ARS',
    'approved',
    'Pago simulado #' || floor(random() * 1000)::text,
    random_date(current_date - 30, current_date)
FROM generate_series(1, 50);

-- =========================================
-- 8. RESUMEN FINAL
-- =========================================
SELECT 
    '✅ DATOS CREADOS EXITOSAMENTE' as estado,
    (SELECT COUNT(*) FROM public.businesses) as negocios,
    (SELECT COUNT(*) FROM public.users) as usuarios,
    (SELECT COUNT(*) FROM public.stores) as sucursales,
    (SELECT COUNT(*) FROM public.transactions WHERE type = 'income') as ingresos,
    (SELECT COUNT(*) FROM public.transactions WHERE type = 'expense') as gastos,
    (SELECT round(sum(amount)::numeric, 2) FROM public.transactions WHERE type = 'income') as total_ingresos,
    (SELECT round(sum(amount)::numeric, 2) FROM public.transactions WHERE type = 'expense') as total_gastos,
    (SELECT round((sum(CASE WHEN type = 'income' THEN amount ELSE -amount END))::numeric, 2) 
     FROM public.transactions) as balance_neto;

-- Limpiar función
DROP FUNCTION IF EXISTS random_date(date, date);
