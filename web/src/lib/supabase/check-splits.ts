import { createServiceClient } from './service';

async function checkTable() {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('payment_splits').select('*').limit(1);
    console.log('Data:', data);
    console.log('Error:', error);
}

checkTable();
