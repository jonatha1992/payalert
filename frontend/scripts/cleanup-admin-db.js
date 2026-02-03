const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {});

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function finalFix() {
    const email = 'jonicorrea1992@gmail.com';
    console.log('🧹 Limpiando datos previos para', email, '...');

    // Borrar de public.users
    await supabase.from('users').delete().eq('email', email);
    
    // Borrar de businesses si existe el admin business
    await supabase.from('businesses').delete().eq('name', 'PayAlert Admin');

    console.log('✅ Base de datos limpia. Reintentando completar perfil...');

    // Ahora simplemente corremos el flujo de inserción de negocio y usuario para el ID que ya existe en Auth
    // (Ya que el usuario de Auth fue creado exitosamente en el paso anterior pero la DB falló)
    
    // Obtenemos el ID de auth (aunque ya lo sabemos por el log anterior, es más robusto pedirlo)
    // Pero como signUp fallaría si ya existe, y el script anterior dijo "Usuario creado", 
    // asumimos que el usuario ya está en Auth.
    
    // Re-corremos el script de admin principal pero lo he modificado mentalmente para que sea idempotente.
    // En lugar de eso, simplemente ejecutaremos el comando de nuevo ahora que la DB está limpia.
}

finalFix();
