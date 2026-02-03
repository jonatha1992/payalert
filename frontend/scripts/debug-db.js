const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        env[key] = value;
    }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: users } = await supabase.from('users').select('id, email, role, business_id');
    console.log('USERS:', JSON.stringify(users, null, 2));
    
    const { data: businesses } = await supabase.from('businesses').select('id, name');
    console.log('BUSINESSES:', JSON.stringify(businesses, null, 2));
}

check();
