const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run create-admin script in production environment.');
    process.exit(1);
}

// Cargar variables de entorno manualmente desde .env.local si existe
const envPath = path.resolve(__dirname, '../.env.local');
let envConfig = {};
if (fs.existsSync(envPath)) {
    envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...values] = trimmed.split('=');
            if (key) acc[key.trim()] = values.join('=').trim();
        }
        return acc;
    }, {});
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno Supabase no encontradas en el entorno ni en .env.local');
    process.exit(1);
}

const email = process.env.ADMIN_EMAIL || envConfig.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD || envConfig.ADMIN_PASSWORD;

if (!email || !password) {
    console.error('❌ Error: ADMIN_EMAIL y ADMIN_PASSWORD deben definirse como variables de entorno.');
    console.error('   Ejemplo: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=clave_segura node scripts/create-admin.js');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    console.log(`⏳ Creando usuario ${email}...`);

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                email_confirmed: true
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

    const { error: userError } = await supabase
        .from('users')
        .insert([{
            id: userId,
            email: email,
            business_id: businessData.id,
            role: 'owner',
            first_name: process.env.ADMIN_FIRST_NAME || 'Admin',
            last_name: process.env.ADMIN_LAST_NAME || 'User'
        }]);

    if (userError) {
        console.error('❌ Error al insertar en public.users:', userError.message);
    } else {
        console.log('🎉 Usuario Administrador configurado con éxito.');
    }
}

createAdmin();
