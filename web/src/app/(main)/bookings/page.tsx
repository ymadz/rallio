import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookingsList } from './bookings-list'

export const metadata = {
  title: 'My Bookings | Rallio',
  description: 'Browse and manage your court bookings',
}

export const dynamic = 'force-dynamic'

async function getUserBookings(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id,
      start_time,
      end_time,
      status,
      total_amount,
      amount_paid,
      num_players,
      payment_type,
      notes,
      created_at,
      recurrence_group_id,
      metadata,
      courts (
        id,
        name,
        hourly_rate,
        venues (
          id,
          name,
          address,
          city
        )
      ),
      payments (
        id,
        status,
        payment_method,
        amount
      )
    `)
    .eq('user_id', userId)
    .order('start_time', { ascending: false })

  if (error) {
    console.error('Error fetching bookings:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return []
  }

  console.log(`Found ${data?.length || 0} bookings for user ${userId}`)

  return data || []
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const bookings = await getUserBookings(user.id)

  return (
    <div className="min-h-screen bg-white">


      {/* Main Content */}
      <div className="p-6">
        <BookingsList initialBookings={bookings as any} />
      </div>
    </div>
  )
}
