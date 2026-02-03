const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('❌ Error: Variables de entorno no encontradas.');
    process.exit(1);
}

const supabase = createClient(url, key);

const sampleData = [
    { name: 'Tienda Central', settings: { theme: 'dark', currency: 'ARS' } },
    { name: 'Sucursal Norte', settings: { theme: 'light', currency: 'ARS' } },
    { name: 'Kiosco 24hs', settings: { notifications: true } }
];

async function seed() {
    console.log('🌱 Insertando datos de prueba en la tabla "businesses"...');

    try {
        const { data, error } = await supabase
            .from('businesses')
            .insert(sampleData)
            .select();

        if (error) {
            console.error('❌ Error al insertar datos:', error.message);
            if (error.code === '42P01') { // undefined_table
                console.error('   👉 La tabla no existe. Crea la tabla primero.');
            }
        } else {
            console.log('✅ Datos insertados correctamente!');
            console.log('   Registros creados:');
            data.forEach(item => {
                console.log(`   - [${item.id}] ${item.name}`);
            });
        }
    } catch (err) {
        console.error('❌ Error inesperado:', err.message);
    }
}

seed();
