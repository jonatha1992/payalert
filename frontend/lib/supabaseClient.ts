import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// El lock de Navigator falla ("immediately failed") con varias pestañas o refrescos simultáneos.
// Sin lock entre pestañas, cada una renueva su sesión por su cuenta; es el trade-off aceptado.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: async (_name, _acquireTimeout, fn) => fn() },
})
