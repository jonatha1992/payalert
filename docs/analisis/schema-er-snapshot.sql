-- PayAlert SaaS - Esquema de Base de Datos
-- Versión: 1.0
-- Fecha: 2026-02-02

-- =========================================
-- TABLAS PRINCIPALES
-- =========================================

-- Tabla de Negocios (Businesses)
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'employee', 'admin')),
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Tiendas/Sucursales
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    manager_id UUID REFERENCES users(id),
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Pagos (desde gateways)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    external_id TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'uala')),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'ARS',
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    description TEXT,
    payer_info JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Transacciones (movimientos de caja)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    notes TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Tokens de Pago
CREATE TABLE IF NOT EXISTS public.payment_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'uala')),
    token_type TEXT NOT NULL CHECK (token_type IN ('access', 'refresh', 'webhook')),
    token_value TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- =========================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_tokens ENABLE ROW LEVEL SECURITY;

-- =========================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =========================================

-- Políticas para businesses
CREATE POLICY "owners_full_access_businesses" ON public.businesses
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM public.users
        WHERE business_id = businesses.id AND role = 'owner'
    ));

CREATE POLICY "employees_read_businesses" ON public.businesses
    FOR SELECT USING (auth.uid() IN (
        SELECT id FROM public.users
        WHERE business_id = businesses.id
    ));

-- Políticas para users
CREATE POLICY "owners_full_access_users" ON public.users
    FOR ALL USING (business_id IN (
        SELECT business_id FROM public.users
        WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "employees_read_own_profile" ON public.users
    FOR SELECT USING (id = auth.uid());

-- Políticas para stores
CREATE POLICY "owners_full_access_stores" ON public.stores
    FOR ALL USING (business_id IN (
        SELECT business_id FROM public.users
        WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "employees_limited_stores" ON public.stores
    FOR SELECT USING (business_id IN (
        SELECT business_id FROM public.users
        WHERE id = auth.uid()
    ));

-- Políticas para payments
CREATE POLICY "owners_full_access_payments" ON public.payments
    FOR ALL USING (store_id IN (
        SELECT s.id FROM public.stores s
        JOIN public.users u ON s.business_id = u.business_id
        WHERE u.id = auth.uid() AND u.role = 'owner'
    ));

CREATE POLICY "employees_limited_payments" ON public.payments
    FOR SELECT USING (store_id IN (
        SELECT s.id FROM public.stores s
        JOIN public.users u ON s.business_id = u.business_id
        WHERE u.id = auth.uid()
    ));

-- Políticas para transactions
CREATE POLICY "owners_full_access_transactions" ON public.transactions
    FOR ALL USING (business_id IN (
        SELECT business_id FROM public.users
        WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "employees_limited_transactions" ON public.transactions
    FOR SELECT USING (business_id IN (
        SELECT business_id FROM public.users
        WHERE id = auth.uid()
    ));

CREATE POLICY "employees_create_transactions" ON public.transactions
    FOR INSERT WITH CHECK (business_id IN (
        SELECT business_id FROM public.users
        WHERE id = auth.uid()
    ));

-- Políticas para payment_tokens (solo owners)
CREATE POLICY "owners_full_access_payment_tokens" ON public.payment_tokens
    FOR ALL USING (business_id IN (
        SELECT business_id FROM public.users
        WHERE id = auth.uid() AND role = 'owner'
    ));

-- =========================================
-- VISTAS ÚTILES
-- =========================================

-- Vista de resumen de negocios
CREATE OR REPLACE VIEW business_summary AS
SELECT
    b.id,
    b.name,
    COUNT(DISTINCT s.id) as total_stores,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT p.id) as total_payments,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as net_balance
FROM businesses b
LEFT JOIN stores s ON b.id = s.business_id
LEFT JOIN users u ON b.id = u.business_id
LEFT JOIN payments p ON s.id = p.store_id
LEFT JOIN transactions t ON b.id = t.business_id
GROUP BY b.id, b.name;

-- Vista de resumen diario por tienda
CREATE OR REPLACE VIEW store_daily_summary AS
SELECT
    s.id,
    s.name,
    DATE(t.created_at) as date,
    COUNT(CASE WHEN t.type = 'income' THEN 1 END) as income_count,
    COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_count,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as daily_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as daily_expenses
FROM stores s
LEFT JOIN transactions t ON s.id = t.store_id
WHERE t.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.id, s.name, DATE(t.created_at);

-- =========================================
-- ÍNDICES DE RENDIMIENTO
-- =========================================

CREATE INDEX IF NOT EXISTS idx_users_business_role ON public.users(business_id, role);
CREATE INDEX IF NOT EXISTS idx_stores_business_active ON public.stores(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payments_store_status ON public.payments(store_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_business_date ON public.transactions(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_store_date ON public.transactions(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_business_provider ON public.payment_tokens(business_id, provider);

-- =========================================
-- FUNCIONES ÚTILES
-- =========================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

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

-- =========================================
-- DATOS DE PRUEBA (DESCOMENTAR PARA DESARROLLO)
-- =========================================

/*
-- Insertar negocio de prueba
INSERT INTO public.businesses (name, settings) VALUES
('Tienda Central', '{"theme": "dark", "currency": "ARS"}');

-- Insertar usuarios de prueba
INSERT INTO public.users (business_id, email, role, first_name, last_name) VALUES
((SELECT id FROM public.businesses WHERE name = 'Tienda Central'), 'owner@test.com', 'owner', 'Juan', 'Pérez'),
((SELECT id FROM public.businesses WHERE name = 'Tienda Central'), 'employee@test.com', 'employee', 'María', 'García');

-- Insertar tienda de prueba
INSERT INTO public.stores (business_id, name, address) VALUES
((SELECT id FROM public.businesses WHERE name = 'Tienda Central'), 'Sucursal Centro', 'Av. Corrientes 1234');
*/
