import { createClient } from '@supabase/supabase-js';

async function main() {
    console.log("Starting...");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if(!supabaseUrl || !supabaseKey) { console.error("Missing env"); return; }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Client created, fetching...");
    
    const { data: refunds, error } = await supabase.from('refunds').select('*').order('created_at', { ascending: false }).limit(5);
    if(error) console.error("Error:", error);
    else console.log(JSON.stringify(refunds, null, 2));
}
main().catch(console.error);
