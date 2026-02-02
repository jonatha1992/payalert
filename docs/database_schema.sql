-- Tabla de Negocios (Businesses)
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (RLS)
-- Nota: Estas políticas son permisivas para pruebas. En producción deben restringirse.

-- Permitir lectura a todos (o solo autenticados)
CREATE POLICY "Permitir lectura a todos" 
ON public.businesses 
FOR SELECT 
USING (true);

-- Permitir inserción a todos (para pruebas/seed)
CREATE POLICY "Permitir inserción a todos" 
ON public.businesses 
FOR INSERT 
WITH CHECK (true);

-- Permitir actualización a todos
CREATE POLICY "Permitir actualización a todos" 
ON public.businesses 
FOR UPDATE 
USING (true);

-- Permitir eliminación a todos
CREATE POLICY "Permitir eliminación a todos" 
ON public.businesses 
FOR DELETE 
USING (true);
