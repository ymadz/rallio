const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: 'web/.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  // get a recent match
  const { data: matches } = await supabase.from('matches').select('*').order('created_at', {ascending: false}).limit(1)
  console.log(matches)
}
run()
