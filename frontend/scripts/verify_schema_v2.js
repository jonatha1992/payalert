const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('Verifying Schema V2...');

    // Check 'users' for 'assigned_store_id'
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('assigned_store_id')
        .limit(1);

    if (userError) {
        console.error('❌ Error checking users.assigned_store_id:', userError.message);
    } else {
        console.log('✅ users.assigned_store_id exists.');
    }

    // Check 'payment_tokens' for 'store_id'
    const { data: tokens, error: tokenError } = await supabase
        .from('payment_tokens')
        .select('store_id')
        .limit(1);

    if (tokenError) {
        console.error('❌ Error checking payment_tokens.store_id:', tokenError.message);
    } else {
        console.log('✅ payment_tokens.store_id exists.');
    }

    if (userError || tokenError) {
        console.log('⚠️ Verification Failed. Please run the SQL migration.');
        process.exit(1);
    } else {
        console.log('🎉 Schema Verification Successful!');
    }
}

verify();
