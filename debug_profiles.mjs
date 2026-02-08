import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(url, key);

async function checkProfiles() {
    console.log('Checking recent profile updates...');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching profiles:', error);
    } else {
        console.table(data);
        // Also check if we can match stripe_customer_id
        if (data.length > 0) {
            console.log('Most recent profile:', data[0]);
        }
    }
}

checkProfiles();
