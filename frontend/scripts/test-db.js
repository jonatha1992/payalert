const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('❌ Error: Variables de entorno no encontradas.');
    console.error('   Asegúrate de correr este script con: node --env-file=../.env.local test-db.js');
    process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
    console.log('📡 Probando conexión a Supabase...');
    console.log('   URL:', url);

    try {
        const { data, error } = await supabase.from('businesses').select('*').limit(1);

        if (error) {
            console.error('❌ Error de conexión:', error.message);
            console.error('   Código:', error.code);
            if (error.code === 'PGRST205') {
                console.error('\n⚠️  DIAGNOSTICO: La tabla "businesses" no existe en la base de datos.');
                console.error('   SOLUCION: Ejecuta el script SQL ubicado en "docs/database_schema.sql" en el SQL Editor de Supabase.');
            }
        } else {
            console.log('✅ Conexión exitosa a la tabla "businesses"!');
            console.log('   Registros encontrados:', data.length);
        }
    } catch (err) {
        console.error('❌ Error inesperado:', err.message);
    }
}

test();
