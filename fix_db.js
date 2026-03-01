import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'ml-service/.env' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function fix() {
  const vres = await supabase.from('venues').update({ is_verified: true }).neq('id', '00000000-0000-0000-0000-000000000000');
  const cres = await supabase.from('courts').update({ is_verified: true }).neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Venues updated:", vres.error ? vres.error : "success")
  console.log("Courts updated:", cres.error ? cres.error : "success")
}
fix()
