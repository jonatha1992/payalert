-- =====================================================
-- PayAlert - Datos de Prueba (Seed Data)
-- =====================================================
-- Ejecutar DESPUÉS de crear usuarios en Authentication
-- =====================================================

-- Variables para los IDs de usuario (obtener de auth.users después de crear)
-- Reemplazar los UUIDs con los reales después de crear usuarios

-- 1. Crear Negocio de Prueba
INSERT INTO public.businesses (id, name, settings) VALUES
('11111111-1111-1111-1111-111111111111', 'PayAlert Demo Business', '{"theme": "dark", "currency": "ARS", "notifications": true}');

-- 2. Crear Usuarios (vincular con auth.users)
-- NOTA: Ejecutar esto DESPUÉS de crear usuarios en Supabase Auth
-- Los IDs deben coincidir con auth.users

-- Admin del sistema (sin business_id - acceso global)
INSERT INTO public.users (id, email, role, first_name, last_name, business_id) VALUES
((SELECT id FROM auth.users WHERE email = 'admin@payalert.com'), 'admin@payalert.com', 'admin', 'System', 'Admin', NULL);

-- Owner del negocio
INSERT INTO public.users (id, email, role, first_name, last_name, business_id) VALUES
((SELECT id FROM auth.users WHERE email = 'owner@payalert.com'), 'owner@payalert.com', 'owner', 'Juan', 'Dueño', '11111111-1111-1111-1111-111111111111');

-- Employee del negocio
INSERT INTO public.users (id, email, role, first_name, last_name, business_id) VALUES
((SELECT id FROM auth.users WHERE email = 'employee@payalert.com'), 'employee@payalert.com', 'employee', 'María', 'Empleada', '11111111-1111-1111-1111-111111111111');

-- 3. Crear Tienda de Prueba
INSERT INTO public.stores (id, business_id, name, address, phone, is_active) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Sucursal Centro', 'Av. Corrientes 1234, CABA', '+54 11 1234-5678', true);

-- 4. Asignar empleado a la tienda
UPDATE public.users 
SET assigned_store_id = '22222222-2222-2222-2222-222222222222'
WHERE email = 'employee@payalert.com';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT 'Usuarios creados:' as info;
SELECT email, role, first_name, last_name FROM public.users;

SELECT 'Negocio creado:' as info;
SELECT name FROM public.businesses;

SELECT 'Tienda creada:' as info;
SELECT name, address FROM public.stores;
