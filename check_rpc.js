import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

// Load env from root directory
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' })
  if (error) {
    console.log("RPC exec_sql not found or error:", error.message)
  } else {
    console.log("RPC exec_sql found!")
  }
}
check()
