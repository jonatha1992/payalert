-- PARTE 3: ÍNDICES, RLS Y FUNCIONES
-- Ejecutar después de las Partes 1 y 2

-- =========================================
-- ÍNDICES
-- =========================================

-- Índices para transactions
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

-- Índices para push_subscriptions
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- =========================================
-- RLS - ROW LEVEL SECURITY
-- =========================================

-- Businesses
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "businesses_select_all" ON public.businesses FOR SELECT USING (true);

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
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

CREATE POLICY "users_self_update" ON public.users FOR UPDATE USING (id = auth.uid());

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

-- Payment Tokens
ALTER TABLE public.payment_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_tokens_owner_all" ON public.payment_tokens
    FOR ALL USING (
        business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid() AND role = 'owner')
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

-- Push Subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_own_only" ON public.push_subscriptions
    FOR ALL USING (user_id = auth.uid());

-- =========================================
-- FUNCIONES Y TRIGGERS
-- =========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
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

-- Función para limpiar logs
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.webhook_logs 
    WHERE created_at < timezone('utc'::text, now()) - INTERVAL '90 days';
    
    DELETE FROM public.audit_logs 
    WHERE created_at < timezone('utc'::text, now()) - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Verificación final
SELECT 
    'Configuración completada:' as mensaje,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as tablas,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as indices,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as politicas_rls;
