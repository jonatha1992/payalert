const { createClient } = require('@supabase/supabase-js');

const url = 'https://iyavgfypwgfrghmquvnm.supabase.co';
const key = 'sb_publishable_YdXTHFdh8WpA-csTiCc-TQ_4IVcBG9n';

console.log('Testing connection to:', url);
console.log('Using key:', key);

const supabase = createClient(url, key);

async function testConnection() {
    try {
        const { data, error } = await supabase.from('businesses').select('*').limit(1);

        if (error) {
            console.error('Connection Error:', error.message);
            if (error.code) console.error('Error Code:', error.code);
            if (error.hint) console.error('Hint:', error.hint);
        } else {
            console.log('Connection Successful!');
            console.log('Data retrieved:', data);
        }
    } catch (err) {
        console.error('Unexpected Error:', err.message);
    }
}

testConnection();
