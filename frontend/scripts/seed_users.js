const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    console.log('Ensure .env.local exists with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (optional but recommended for seeding)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const users = [
    { email: 'owner@payalert.com', password: 'Password123!', role: 'owner', name: 'Test Owner' },
    { email: 'employee@payalert.com', password: 'Password123!', role: 'employee', name: 'Test Employee' },
    { email: 'admin@payalert.com', password: 'Password123!', role: 'admin', name: 'Test Admin' }
];

async function seed() {
    console.log('Starting Seed Process...');

    // 1. Create Business
    const { data: business, error: busError } = await supabase
        .from('businesses')
        .insert([{ name: 'PayAlert Demo Business' }])
        .select()
        .single();
    
    if (busError) {
        console.error('Error creating business:', busError.message);
        // Continue if business existence error, maybe fetch it?
    } else {
        console.log('Created Business:', business.id);
    }

    // Fetch a valid business ID (either new or existing generic one)
    const { data: existingBusiness } = await supabase.from('businesses').select().limit(1).single();
    const businessId = business?.id || existingBusiness?.id;

    if (!businessId) {
        console.error('No business ID available. Aborting.');
        return;
    }

    for (const u of users) {
        console.log(`Processing ${u.role}: ${u.email}`);

        // 2. Sign Up (Auth)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: u.email,
            password: u.password,
            options: {
                data: {
                    first_name: u.name.split(' ')[0],
                    role: u.role
                }
            }
        });

        if (authError) {
            console.log(`Auth Sign up info for ${u.email}:`, authError.message);
        }
        
        const userId = authData.user?.id;

        if (userId) {
            console.log(`Auth User Created: ${userId}`);

            // 3. Create Public Profile
            // Check if exists first
            const { data: existingProfile } = await supabase.from('users').select().eq('id', userId).single();

            if (!existingProfile) {
                const { error: profileError } = await supabase.from('users').insert([{
                    id: userId,
                    email: u.email,
                    role: u.role, // This might fail for Admin if Check Constraint not updated in DB
                    first_name: u.name.split(' ')[0],
                    last_name: u.name.split(' ')[1],
                    business_id: businessId
                }]);

                if (profileError) {
                    console.error(`Failed to create profile for ${u.role}:`, profileError.message);
                } else {
                    console.log(`Profile created for ${u.role}`);
                }
            } else {
                console.log(`Profile already exists for ${u.role}`);
            }
        }
    }
    console.log('Seed process finished.');
}

seed();
