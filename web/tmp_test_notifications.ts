import { createServiceClient } from './src/lib/supabase/service'
import { createNotification, NotificationTemplates } from './src/lib/notifications'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testNotifications() {
  const supabase = createServiceClient()
  
  console.log('--- Notification Fallback Verification Test ---')
  
  // 1. Get a test user
  const TEST_USER_ID = '440ea88a-bc6a-4080-bf8d-85e8b2b52e53' // Paseo Badminton Owner
  
  console.log('Using Test User:', TEST_USER_ID)
  
  // 2. Test Notification WITH Metadata (Should use fallback)
  console.log('\n2. Testing Notification WITH Metadata (Template)...')
  const res = await createNotification({
    userId: TEST_USER_ID,
    ...NotificationTemplates.newBookingRequest(
      'Test Venue',
      'Test Court',
      'Mar 1, 10:00 AM',
      'test-id-999'
    )
  })
  
  if (res.success) {
    console.log('✅ Success! Fallback worked.')
    console.log('Notification ID:', res.notification.id)
  } else {
    console.log('❌ Failed:', res.error)
  }

  // 3. Verify in DB
  console.log('\n3. Verifying in DB...')
  const { data: recent, error: dbError } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', TEST_USER_ID)
    .order('created_at', { ascending: false })
    .limit(1)
  
  if (dbError) {
    console.error('Error verifying DB:', dbError.message)
  } else if (recent && recent.length > 0) {
    console.log(`Found recent notification: [${recent[0].type}] ${recent[0].title}`)
    console.log(`Message: ${recent[0].message}`)
    if ('metadata' in recent[0]) {
       console.log('Metadata column exists in result:', recent[0].metadata)
    } else {
       console.log('Metadata column NOT in result (as expected if missing in DB)')
    }
  }
}

testNotifications()
