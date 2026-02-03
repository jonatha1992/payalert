const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const TARGET_EMAIL = 'jonicorrea1992@gmail.com';

async function fixUser() {
    console.log(`Fixing user: ${TARGET_EMAIL}`);

    // 1. Get a Business ID
    const { data: business } = await supabase.from('businesses').select('id').limit(1).single();
    
    if (!business) {
        console.error('No businesses found. Run seed_users.js first.');
        return;
    }

    console.log(`Using Business ID: ${business.id}`);

    // 2. Get User ID
    // We can't fetch from auth.users easily without Service Role, but we can try to update public.users directly if RLS allows or if we validly signed in.
    // Actually, let's just update public.users by email.
    
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', TARGET_EMAIL)
        .single();

    if (fetchError || !user) {
        console.error('User not found in public.users:', fetchError?.message);
        // If not in public.users but in Auth, we need to insert.
        // But we don't have the ID easily unless we sign in as them.
        return;
    }

    console.log('Found user in public table:', user.id);

    // 3. Update User
    const { error: updateError } = await supabase
        .from('users')
        .update({ business_id: business.id, role: 'owner' }) // Ensure he is owner
        .eq('id', user.id);

    if (updateError) {
        console.error('Error updating user:', updateError.message);
    } else {
        console.log('Success! User updated with Business ID.');
    }
}

fixUser();
