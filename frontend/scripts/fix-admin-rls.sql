-- Actualizar el constraint de roles para incluir 'admin'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'owner', 'employee'));

-- Dar permisos totales a los administradores en todas las tablas
DO $$
BEGIN
    -- Usuarios
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins_full_access_users') THEN
        CREATE POLICY "admins_full_access_users" ON public.users FOR ALL USING (
            (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
        );
    END IF;

    -- Negocios
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins_full_access_businesses') THEN
        CREATE POLICY "admins_full_access_businesses" ON public.businesses FOR ALL USING (
            (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
        );
    END IF;

    -- Tiendas
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins_full_access_stores') THEN
        CREATE POLICY "admins_full_access_stores" ON public.stores FOR ALL USING (
            (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
        );
    END IF;
END
$$;
