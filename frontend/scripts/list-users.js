const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('❌ Error: Variables de entorno no encontradas.');
    process.exit(1);
}

const supabase = createClient(url, key);

async function listUsers() {
    console.log('📋 Consultando usuarios en la base de datos...\n');

    const { data, error } = await supabase
        .from('users')
        .select('id, email, role, first_name, last_name');

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (data.length === 0) {
        console.log('⚠️  No hay usuarios en la base de datos.');
        return;
    }

    console.log('✅ Usuarios encontrados:\n');
    console.log('| Email | Rol | Nombre |');
    console.log('|-------|-----|--------|');
    data.forEach(u => {
        console.log(`| ${u.email} | ${u.role} | ${u.first_name || ''} ${u.last_name || ''} |`);
    });
}

listUsers();
