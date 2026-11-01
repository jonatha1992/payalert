-- =========================================
-- RESET COMPLETO - Eliminar todo y recrear
-- WARNING: Esto borra TODOS los datos
-- =========================================

-- Eliminar tablas en orden (hijas primero por las FK)
DROP TABLE IF EXISTS public.webhook_logs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.payment_tokens CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;
DROP TABLE IF EXISTS public.businesses CASCADE;

-- Eliminar funciones si existen
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_logs CASCADE;

-- =========================================
-- CREACIÓN DE TABLAS DESDE CERO
-- =========================================

-- 1. NEGOCIOS (Tabla principal)
CREATE TABLE public.businesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. USUARIOS
CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'employee')),
    first_name TEXT,
    last_name TEXT,
    assigned_store_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. SUCURSALES (TIENDAS)
CREATE TABLE public.stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Agregar FK de assigned_store_id después de crear stores
ALTER TABLE public.users 
ADD CONSTRAINT fk_assigned_store 
FOREIGN KEY (assigned_store_id) 
REFERENCES public.stores(id) 
ON DELETE SET NULL;

-- 4. TOKENS DE PAGO (Integraciones MP/Ualá)
CREATE TABLE public.payment_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'uala')),
    token_type TEXT NOT NULL DEFAULT 'access',
    token_value TEXT NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    webhook_secret TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. PAGOS (Webhooks entrantes)
CREATE TABLE public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    external_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'ARS',
    status TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TRANSACCIONES (Registro financiero completo)
CREATE TABLE public.transactions (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT DEFAULT 'completed',
    provider TEXT,
    external_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. AUDIT LOGS (Seguimiento de operaciones)
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. WEBHOOK LOGS (Registro de webhooks recibidos)
CREATE TABLE public.webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'uala')),
    event_type TEXT,
    payload JSONB NOT NULL,
    headers JSONB,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed', 'invalid')),
    signature_valid BOOLEAN,
    signature_received TEXT,
    signature_calculated TEXT,
    error_message TEXT,
    processing_time_ms INTEGER,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 9. PUSH SUBSCRIPTIONS (Notificaciones push)
CREATE TABLE public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================
-- ÍNDICES DE PERFORMANCE
-- =========================================

-- Índices para transactions (dashboard y reportes)
CREATE INDEX idx_transactions_business_type_date ON public.transactions(business_id, type, created_at DESC);
CREATE INDEX idx_transactions_business_store_date ON public.transactions(business_id, store_id, created_at DESC);
CREATE INDEX idx_transactions_type_business ON public.transactions(type, business_id) WHERE type IN ('income', 'expense');
CREATE INDEX idx_transactions_latest ON public.transactions(business_id, created_at DESC, id);

-- Índices para users
CREATE INDEX idx_users_business_role ON public.users(business_id, role);

-- Índices para stores
CREATE INDEX idx_stores_business_active ON public.stores(business_id, is_active);

-- Índices para payments
CREATE INDEX idx_payments_store_status ON public.payments(store_id, status);
CREATE INDEX idx_payments_created_at ON public.payments(created_at);

-- Índices para payment_tokens
CREATE INDEX idx_payment_tokens_business_provider ON public.payment_tokens(business_id, provider);

-- Índices para audit_logs
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_business_id ON public.audit_logs(business_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Índices para webhook_logs
CREATE INDEX idx_webhook_logs_provider ON public.webhook_logs(provider);
CREATE INDEX idx_webhook_logs_status ON public.webhook_logs(status);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_store_id ON public.webhook_logs(store_id);

-- Índices para push_subscriptions
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- =========================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================

-- Businesses
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "businesses_select_all" ON public.businesses
    FOR SELECT USING (true);

CREATE POLICY "businesses_owner_all" ON public.businesses
    FOR ALL USING (
        id IN (SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner')
    );

CREATE POLICY "businesses_admin_all" ON public.businesses
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_business" ON public.users
    FOR SELECT USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "users_owner_all" ON public.users
    FOR ALL USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner')
    );

CREATE POLICY "users_admin_all" ON public.users
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

CREATE POLICY "users_self_update" ON public.users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_users_critical_columns()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    IF (NEW.role IS NOT DISTINCT FROM OLD.role) AND (NEW.business_id IS NOT DISTINCT FROM OLD.business_id) THEN
        RETURN NEW;
    END IF;

    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF current_user IN ('postgres', 'supabase_admin') AND current_setting('request.jwt.claim.sub', true) IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role = 'admin' THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Unauthorized: only administrators can change role or business_id'
        USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_protect_users_critical_columns ON public.users;
CREATE TRIGGER tr_protect_users_critical_columns
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_users_critical_columns();

-- Stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stores_select_business" ON public.stores
    FOR SELECT USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "stores_owner_all" ON public.stores
    FOR ALL USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner')
    );

CREATE POLICY "stores_admin_all" ON public.stores
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

-- Payment Tokens
ALTER TABLE public.payment_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_tokens_owner_all" ON public.payment_tokens
    FOR ALL USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner')
    );

CREATE POLICY "payment_tokens_admin_all" ON public.payment_tokens
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

-- Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_business" ON public.payments
    FOR SELECT USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid())
    );

-- Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_business" ON public.transactions
    FOR SELECT USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "transactions_owner_all" ON public.transactions
    FOR ALL USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner')
    );

-- Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_owner_access" ON public.audit_logs
    FOR ALL USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner')
    );

CREATE POLICY "audit_logs_admin_access" ON public.audit_logs
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

-- Webhook Logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_logs_owner_access" ON public.webhook_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.stores s
            JOIN public.users u ON s.business_id = u.business_id
            WHERE s.id = webhook_logs.store_id AND u.id = auth.uid() AND u.role = 'owner'
        )
    );

CREATE POLICY "webhook_logs_admin_access" ON public.webhook_logs
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    );

-- Push Subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_own_only" ON public.push_subscriptions
    FOR ALL USING (user_id = auth.uid());

-- =========================================
-- FUNCIONES Y TRIGGERS
-- =========================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_tokens_updated_at BEFORE UPDATE ON public.payment_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para limpiar logs antiguos
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.webhook_logs 
    WHERE created_at < timezone('utc'::text, now()) - INTERVAL '90 days';
    
    DELETE FROM public.audit_logs 
    WHERE created_at < timezone('utc'::text, now()) - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- DATOS DE PRUEBA (Opcional)
-- =========================================

-- Descomenta para crear datos de prueba:

-- INSERT INTO public.businesses (name, settings) VALUES
-- ('Mi Negocio de Prueba', '{"currency": "ARS", "theme": "light"}');

-- INSERT INTO public.users (id, business_id, email, role, first_name, last_name) VALUES
-- ('00000000-0000-0000-0000-000000000000', 
--  (SELECT id FROM public.businesses WHERE name = 'Mi Negocio de Prueba'),
--  'owner@test.com', 'owner', 'Juan', 'Pérez');

-- INSERT INTO public.stores (business_id, name, address, phone) VALUES
-- ((SELECT id FROM public.businesses WHERE name = 'Mi Negocio de Prueba'),
--  'Sucursal Centro', 'Av. Corrientes 1234', '+54 11 1234-5678');

-- =========================================
-- VERIFICACIÓN
-- =========================================

SELECT 
    'Tablas creadas:' as info,
    COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

SELECT 
    'Índices creados:' as info,
    COUNT(*) as count 
FROM pg_indexes 
WHERE schemaname = 'public';

SELECT 
    'Políticas RLS:' as info,
    COUNT(*) as count 
FROM pg_policies 
WHERE schemaname = 'public';
