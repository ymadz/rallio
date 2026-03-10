const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: 'web/.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function test() {
  const { data } = await supabase.rpc('test_row_is_not_null')
  console.log(data)
}
test()
