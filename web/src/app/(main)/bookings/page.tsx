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
      cancellation_reason,
      courts (
        id,
        name,
        hourly_rate,
        court_images (
          url,
          is_primary,
          display_order
        ),
        venues (
          id,
          name,
          address,
          city,
          image_url
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

  // Mark all as regular reservations
  const reservations = (data || []).map((r: any) => ({
    ...r,
    type: 'reservation' as const,
  }))

  return reservations
}

async function getUserQueueSessions(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('queue_sessions')
    .select(`
      id,
      court_id,
      start_time,
      end_time,
      status,
      mode,
      game_format,
      max_players,
      cost_per_game,
      is_public,
      created_at,
      reservation_id,
      courts (
        id,
        name,
        hourly_rate,
        court_images (
          url,
          is_primary,
          display_order
        ),
        venues (
          id,
          name,
          address,
          city,
          image_url
        )
      )
    `)
    .eq('queue_master_id', userId)
    .order('start_time', { ascending: false })

  if (error) {
    console.error('Error fetching queue sessions:', error)
    return []
  }

  // Normalize queue sessions into the Booking shape
  const queueSessions = (data || []).map((qs: any) => ({
    id: qs.reservation_id || qs.id,
    start_time: qs.start_time,
    end_time: qs.end_time,
    status: mapQueueStatus(qs.status),
    total_amount: 0,
    amount_paid: 0,
    num_players: qs.max_players || 0,
    payment_type: 'full',
    notes: null,
    created_at: qs.created_at,
    courts: qs.courts,
    payments: [],
    recurrence_group_id: null,
    cancellation_reason: null,
    metadata: {
      queue_mode: qs.mode,
      queue_game_format: qs.game_format,
      queue_cost_per_game: qs.cost_per_game,
      queue_is_public: qs.is_public,
    },
    // Queue session specific fields
    type: 'queue_session' as const,
    queue_session_id: qs.id,
    game_format: qs.game_format,
    mode: qs.mode,
  }))

  return queueSessions
}

function mapQueueStatus(queueStatus: string): string {
  switch (queueStatus) {
    case 'open':
    case 'active':
      return 'confirmed'
    case 'closed':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    default:
      return queueStatus
  }
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch both reservations and queue sessions in parallel
  const [bookings, queueSessions] = await Promise.all([
    getUserBookings(user.id),
    getUserQueueSessions(user.id),
  ])

  // Merge and sort by start_time descending
  const allBookings = [...bookings, ...queueSessions].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <div className="p-6">
        <BookingsList initialBookings={allBookings as any} />
      </div>
    </div>
  )
}
