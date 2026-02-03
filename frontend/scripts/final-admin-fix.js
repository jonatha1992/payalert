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
    const password = 'joni1910';
    console.log('🚀 Iniciando configuración final para', email);

    // 1. Intentar Login para obtener el ID de Auth si ya existe
    const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    let userId;

    if (signError) {
        console.log('ℹ️ El usuario no pudo loguearse, intentando crear...');
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) {
            console.error('❌ Error fatal en Auth:', authError.message);
            return;
        }
        userId = authData.user.id;
    } else {
        userId = signData.user.id;
        console.log('✅ Usuario ya existente en Auth. ID:', userId);
    }

    // 2. Limpiar tablas publicas (por si acaso quedaron restos de intentos fallidos)
    console.log('🧹 Limpiando tablas públicas...');
    await supabase.from('users').delete().eq('id', userId);
    await supabase.from('businesses').delete().eq('name', 'PayAlert Admin');

    // 3. Crear Negocio
    const { data: businessData, error: busError } = await supabase
        .from('businesses')
        .insert([{ name: 'PayAlert Admin' }])
        .select()
        .single();

    if (busError) {
        console.error('❌ Error creando negocio:', busError.message);
        return;
    }
    console.log('✅ Negocio "PayAlert Admin" creado.');

    // 4. Crear Perfil de Usuario
    const { error: userError } = await supabase
        .from('users')
        .insert([{
            id: userId,
            email: email,
            business_id: businessData.id,
            role: 'owner',
            first_name: 'Jonathan',
            last_name: 'Correa'
        }]);

    if (userError) {
        console.error('❌ Error creando perfil:', userError.message);
    } else {
        console.log('🎉 CONFIGURACIÓN EXITOSA.');
        console.log('   Ya puedes entrar en http://localhost:3000/login');
    }
}

finalFix();
