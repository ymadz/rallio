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

  // First, get all reservation IDs where the user has a split payment record
  const { data: userSplits } = await supabase
      .from('payment_splits')
      .select('reservation_id')
      .eq('user_id', userId)
  
  const participantResIds = (userSplits || []).map(s => s.reservation_id)

  let query = supabase
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
      user_id,
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
      ),
      payment_splits (
        id,
        user_id,
        email,
        amount,
        status,
        payment_link
      )
    `)

  // OR query: Where I am the owner OR where I am a participant
  if (participantResIds.length > 0) {
      // PostgREST or filter doesn't support easy multi-table OR on subqueries
      // So we use .or with ID in list
      query = query.or(`user_id.eq.${userId},id.in.(${participantResIds.join(',')})`)
  } else {
      query = query.eq('user_id', userId)
  }

  const { data, error } = await query.order('start_time', { ascending: false })

  if (error) {
    console.error('Error fetching bookings:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return []
  }

  // Mark bookings accurately evaluating metadata for queue_sessions
  const reservations = (data || []).map((r: any) => ({
    ...r,
    type: r.metadata?.is_queue_session_reservation ? 'queue_session' : ('reservation' as const),
    queue_session_id: r.metadata?.queue_session_id || null, // fallback if needed
    metadata: {
      ...r.metadata,
      current_user_id: userId,
      current_user_email: r.payment_splits?.find((s: any) => s.user_id === userId)?.email || null
    }
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
      metadata,
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
    .eq('organizer_id', userId)
    .order('start_time', { ascending: false })

  if (error) {
    console.error('Error fetching queue sessions:', error)
    return []
  }

  // Fetch linked reservations to get accurate status
  const reservationIds = (data || [])
    .map((qs: any) => qs.metadata?.reservation_id)
    .filter(Boolean)

  const { data: linkedReservations } = await supabase
    .from('reservations')
    .select('id, status, total_amount, amount_paid, payment_method')
    .in('id', reservationIds)

  const reservationMap = new Map(
    (linkedReservations || []).map((r: any) => [r.id, r])
  )

  // Get current user email once for metadata
  const { data: { user } } = await supabase.auth.getUser()
  const userEmail = user?.email || null

  // Normalize queue sessions into the Booking shape
  const queueSessions = (data || []).map((qs: any) => {
    const reservationId = qs.metadata?.reservation_id || null
    const linkedReservation = reservationId ? reservationMap.get(reservationId) : null

    // Use the actual reservation status if available, otherwise map from queue session status
    const actualStatus = linkedReservation?.status || mapQueueStatus(qs.status)
    const actualTotalAmount = linkedReservation?.total_amount || qs.metadata?.payment_required || 0
    const actualAmountPaid = linkedReservation?.amount_paid || (qs.metadata?.payment_status === 'paid' ? actualTotalAmount : 0)

    return {
      id: reservationId || qs.id,
      start_time: qs.start_time,
      end_time: qs.end_time,
      status: actualStatus,
      total_amount: actualTotalAmount,
      amount_paid: actualAmountPaid,
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
        intended_payment_method: linkedReservation?.payment_method || qs.metadata?.payment_method || 'cash',
        is_queue_session_reservation: true,
        current_user_id: userId,
        current_user_email: userEmail
      },
      // Queue session specific fields
      type: 'queue_session' as const,
      queue_session_id: qs.id,
      game_format: qs.game_format,
      mode: qs.mode,
    }
  })

  return queueSessions
}

function mapQueueStatus(queueStatus: string): string {
  switch (queueStatus) {
    case 'open':
    case 'active':
      return 'confirmed'
    case 'pending_payment':
      return 'pending_payment'
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

  // Process queue sessions to ensure they have unique IDs if needed, but we use the reservation ID to deduplicate
  const queueSessionReservationIds = new Set(queueSessions.map(qs => qs.id))

  // Enrich queue sessions with payments from the main reservations query
  const enrichedQueueSessions = queueSessions.map(qs => {
    const matchingBooking = bookings.find(b => b.id === qs.id)
    return {
      ...qs,
      payments: matchingBooking?.payments || []
    }
  })

  // Filter out reservations that already exist as queue sessions
  const regularBookings = bookings.filter(b => !queueSessionReservationIds.has(b.id))

  // Merge and sort by start_time descending
  const allBookings = [...regularBookings, ...enrichedQueueSessions].sort(
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
