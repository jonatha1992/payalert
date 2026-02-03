const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno manualmente porque no tenemos dotenv instalado
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
        acc[key.trim()] = value.trim();
    }
    return acc;
}, {});

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno no encontradas en .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    const email = 'jonicorrea1992@gmail.com';
    const password = 'joni1910';

    console.log(`⏳ Creando usuario ${email}...`);

    // 1. Crear usuario en Auth (con email confirmado automáticamente)
    // Nota: Usamos signUp pero forzando el auto-confirm si las políticas lo permiten, 
    // o simplemente avisamos al usuario que debe desactivar la confirmación en Supabase.
    // Dado que estamos usando la anon key, el auto-confirm REAL requiere la Service Role Key.
    // Como alternativa, usaremos una opción para intentar que Supabase no pida confirmación si está configurado.
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                email_confirmed: true // Algunos proveedores lo toman como hint
            }
        }
    });

    if (authError) {
        console.error('❌ Error al crear usuario en Auth:', authError.message);
        return;
    }

    const userId = authData.user?.id;

    if (!userId) {
        console.error('❌ Error: No se pudo obtener el ID del usuario.');
        return;
    }

    console.log('✅ Usuario creado en Auth correctamente. ID:', userId);

    // 2. Crear un negocio "Dashboard Admin" para este usuario (ya que es necesario por la FK)
    // Nota: Como es un admin de plataforma, le creamos un negocio propio para que pueda entrar.
    const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .insert([{ name: 'PayAlert Admin' }])
        .select()
        .single();

    if (businessError) {
        console.error('❌ Error al crear el negocio del admin:', businessError.message);
        return;
    }

    console.log('✅ Negocio "PayAlert Admin" creado. ID:', businessData.id);

    // 3. Insertar en tabla public.users
    const { error: userError } = await supabase
        .from('users')
        .insert([{
            id: userId,
            email: email,
            business_id: businessData.id,
            role: 'owner', // Usamos 'owner' temporalmente ya que 'admin' no existe en el CHECK constraint
            first_name: 'Jonathan',
            last_name: 'Correa'
        }]);

    if (userError) {
        console.error('❌ Error al insertar en public.users:', userError.message);
    } else {
        console.log('🎉 ¡Usuario Administrador configurado con éxito!');
        console.log('   Ya puedes iniciar sesión en http://localhost:3000/login');
    }
}

createAdmin();
