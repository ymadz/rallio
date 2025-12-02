'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkRateLimit, createRateLimitConfig } from '@/lib/rate-limiter'
import { createBulkNotifications, NotificationTemplates } from '@/lib/notifications'

/**
 * Queue Management Server Actions
 * Handles queue session operations for the queue system
 */

export interface QueueSessionData {
  id: string
  courtId: string
  courtName: string
  venueName: string
  venueId: string
  status: 'draft' | 'open' | 'active' | 'paused' | 'closed' | 'cancelled'
  currentPlayers: number
  maxPlayers: number
  costPerGame: number
  startTime: Date
  endTime: Date
  mode: 'casual' | 'competitive'
  gameFormat: 'singles' | 'doubles' | 'mixed'
}

export interface QueueParticipantData {
  id: string
  userId: string
  playerName: string
  avatarUrl?: string
  skillLevel: number
  position: number
  joinedAt: Date
  gamesPlayed: number
  gamesWon: number
  status: 'waiting' | 'playing' | 'completed' | 'left'
  amountOwed: number
  paymentStatus: 'unpaid' | 'partial' | 'paid'
}

/**
 * Fetch queue session details by court ID
 */
export async function getQueueDetails(courtId: string) {
  console.log('[getQueueDetails] 🔍 Fetching queue for court:', courtId)

  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[getQueueDetails] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // Find active or open queue session for this court
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select(`
        *,
        courts (
          name,
          venues (
            id,
            name
          )
        )
      `)
      .eq('court_id', courtId)
      .in('status', ['open', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError || !session) {
      console.log('[getQueueDetails] ℹ️ No active queue found for court')
      return { success: true, queue: null }
    }

    // Get all participants in this session
    const { data: participants, error: participantsError } = await supabase
      .from('queue_participants')
      .select(`
        *,
        user:user_id!inner (
          id,
          display_name,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('queue_session_id', session.id)
      .is('left_at', null)
      .order('joined_at', { ascending: true })

    if (participantsError) {
      console.error('[getQueueDetails] ❌ Failed to fetch participants:', participantsError)
      return { success: false, error: 'Failed to fetch participants' }
    }

    // Get player skill levels separately (since we can't nested join)
    const playerIds = participants?.map((p: any) => p.user_id) || []
    const { data: players } = await supabase
      .from('players')
      .select('user_id, skill_level')
      .in('user_id', playerIds)

    const playerSkillMap = new Map(players?.map((p: any) => [p.user_id, p.skill_level]) || [])

    // Calculate positions and user position
    const formattedParticipants: QueueParticipantData[] = (participants || []).map((p: any, index: number) => ({
      id: p.id,
      userId: p.user_id,
      playerName: p.user?.display_name || `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() || 'Unknown Player',
      avatarUrl: p.user?.avatar_url,
      skillLevel: playerSkillMap.get(p.user_id) || 5,
      position: index + 1,
      joinedAt: new Date(p.joined_at),
      gamesPlayed: p.games_played || 0,
      gamesWon: p.games_won || 0,
      status: p.status,
      amountOwed: parseFloat(p.amount_owed || '0'),
      paymentStatus: p.payment_status,
    }))

    const userParticipant = formattedParticipants.find(p => p.userId === user.id)
    const userPosition = userParticipant ? userParticipant.position : null

    // Calculate estimated wait time (15 min per game × position)
    const estimatedWaitTime = userPosition ? userPosition * 15 : formattedParticipants.length * 15

    const queueData: QueueSessionData & {
      players: QueueParticipantData[]
      userPosition: number | null
      estimatedWaitTime: number
    } = {
      id: session.id,
      courtId: session.court_id,
      courtName: session.courts?.name || 'Unknown Court',
      venueName: session.courts?.venues?.name || 'Unknown Venue',
      venueId: session.courts?.venues?.id || '',
      status: session.status,
      currentPlayers: session.current_players || formattedParticipants.length,
      maxPlayers: session.max_players || 12,
      costPerGame: parseFloat(session.cost_per_game || '0'),
      startTime: new Date(session.start_time),
      endTime: new Date(session.end_time),
      mode: session.mode,
      gameFormat: session.game_format,
      players: formattedParticipants,
      userPosition,
      estimatedWaitTime,
    }

    console.log('[getQueueDetails] ✅ Queue fetched successfully:', {
      sessionId: queueData.id,
      playerCount: queueData.players.length,
      userPosition,
    })

    return { success: true, queue: queueData }
  } catch (error: any) {
    console.error('[getQueueDetails] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to fetch queue' }
  }
}

/**
 * Join a queue session
 */
export async function joinQueue(sessionId: string) {
  console.log('[joinQueue] 🚀 Joining queue session:', sessionId)

  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[joinQueue] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('JOIN_QUEUE', user.id))
    if (!rateLimitResult.allowed) {
      console.warn('[joinQueue] ⚠️ Rate limit exceeded for user:', user.id)
      return {
        success: false,
        error: `Too many join attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // Check if session exists and is joinable
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('*, courts(id)')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('[joinQueue] ❌ Session not found:', sessionError)
      return { success: false, error: 'Queue session not found' }
    }

    if (!['open', 'active'].includes(session.status)) {
      return { success: false, error: 'Queue is not accepting new players' }
    }

    // Check if queue is full
    const { count: currentCount } = await supabase
      .from('queue_participants')
      .select('*', { count: 'exact', head: true })
      .eq('queue_session_id', sessionId)
      .is('left_at', null)

    if (currentCount && currentCount >= session.max_players) {
      return { success: false, error: 'Queue is full' }
    }

    // Check if user has any record in this queue (due to UNIQUE constraint on session_id + user_id)
    const { data: existingParticipants } = await supabase
      .from('queue_participants')
      .select('*')
      .eq('queue_session_id', sessionId)
      .eq('user_id', user.id)
      .order('left_at', { ascending: false, nullsFirst: true })

    console.log('[joinQueue] 🔍 Existing participants:', existingParticipants)

    const existingRecord = existingParticipants?.[0]
    
    // If user has an existing record
    if (existingRecord) {
      // If they're still active (haven't left), they're already in queue
      if (!existingRecord.left_at) {
        console.log('[joinQueue] ⚠️ User already in queue (active):', existingRecord.id)
        return { success: false, error: 'You are already in this queue' }
      }
      
      // Check rejoin cooldown (5 minutes)
      const timeSinceLeave = Date.now() - new Date(existingRecord.left_at).getTime()
      const cooldownMs = 5 * 60 * 1000 // 5 minutes
      
      if (timeSinceLeave < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLeave) / 1000)
        const minutes = Math.floor(remainingSeconds / 60)
        const seconds = remainingSeconds % 60
        console.log('[joinQueue] ⏳ Cooldown active:', { timeSinceLeave, remainingSeconds })
        return {
          success: false,
          error: `Please wait ${minutes}m ${seconds}s before rejoining this queue`,
        }
      }
      
      // If they previously left, reactivate their record instead of inserting new
      console.log('[joinQueue] 🔄 Reactivating previous participant record:', existingRecord.id)
      const { data: participant, error: updateError } = await supabase
        .from('queue_participants')
        .update({
          left_at: null,
          status: 'waiting',
          joined_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id)
        .select()
        .single()

      if (updateError || !participant) {
        console.error('[joinQueue] ❌ Failed to reactivate participant:', updateError)
        return { success: false, error: 'Failed to rejoin queue' }
      }

      console.log('[joinQueue] ✅ Successfully rejoined queue')
      revalidatePath(`/queue/${session.courts.id}`)
      revalidatePath('/queue')
      return { success: true, participant }
    }

    // No existing record, create new participant
    const { data: participant, error: insertError } = await supabase
      .from('queue_participants')
      .insert({
        queue_session_id: sessionId,
        user_id: user.id,
        status: 'waiting',
        payment_status: 'unpaid',
        amount_owed: 0,
      })
      .select()
      .single()

    if (insertError || !participant) {
      console.error('[joinQueue] ❌ Failed to join queue:', insertError)
      
      // Handle specific error cases
      if (insertError?.code === '23505') {
        return { success: false, error: 'You are already in this queue' }
      }
      
      return { success: false, error: 'Failed to join queue' }
    }

    console.log('[joinQueue] ✅ Successfully joined queue')

    // Revalidate queue pages
    revalidatePath(`/queue/${session.courts.id}`)
    revalidatePath('/queue')

    return { success: true, participant }
  } catch (error: any) {
    console.error('[joinQueue] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to join queue' }
  }
}

/**
 * Leave a queue session
 */
export async function leaveQueue(sessionId: string) {
  console.log('[leaveQueue] 🚪 Leaving queue session:', sessionId)

  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[leaveQueue] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('LEAVE_QUEUE', user.id))
    if (!rateLimitResult.allowed) {
      console.warn('[leaveQueue] ⚠️ Rate limit exceeded for user:', user.id)
      return {
        success: false,
        error: `Too many leave attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // Get participant record
    const { data: participant, error: fetchError } = await supabase
      .from('queue_participants')
      .select('*, queue_sessions(courts(id))')
      .eq('queue_session_id', sessionId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .single()

    if (fetchError || !participant) {
      console.error('[leaveQueue] ❌ Not in queue:', fetchError)
      return { success: false, error: 'Not in queue' }
    }

    // Check if user owes money
    const gamesPlayed = participant.games_played || 0
    const amountOwed = parseFloat(participant.amount_owed || '0')

    if (gamesPlayed > 0 && amountOwed > 0 && participant.payment_status !== 'paid') {
      console.log('[leaveQueue] ⚠️ User owes payment:', { gamesPlayed, amountOwed })
      return {
        success: false,
        error: 'Payment required',
        requiresPayment: true,
        amountOwed,
        gamesPlayed,
      }
    }

    // Mark as left
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({
        left_at: new Date().toISOString(),
        status: 'left',
      })
      .eq('id', participant.id)

    if (updateError) {
      console.error('[leaveQueue] ❌ Failed to leave queue:', updateError)
      return { success: false, error: 'Failed to leave queue' }
    }

    console.log('[leaveQueue] ✅ Successfully left queue')

    // Revalidate queue pages
    const courtId = participant.queue_sessions?.courts?.id
    if (courtId) {
      revalidatePath(`/queue/${courtId}`)
    }
    revalidatePath('/queue')

    return { success: true }
  } catch (error: any) {
    console.error('[leaveQueue] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to leave queue' }
  }
}

/**
 * Get all queue sessions where user is a participant
 */
export async function getMyQueues() {
  console.log('[getMyQueues] 🔍 Fetching user queues')

  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[getMyQueues] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // Get all active queue participations
    const { data: participations, error: participationsError } = await supabase
      .from('queue_participants')
      .select(`
        *,
        queue_sessions!inner (
          *,
          courts (
            id,
            name,
            venues (
              id,
              name
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .is('left_at', null)
      .in('queue_sessions.status', ['open', 'active'])
      .order('joined_at', { ascending: false })

    if (participationsError) {
      console.error('[getMyQueues] ❌ Failed to fetch queues:', participationsError)
      return { success: false, error: 'Failed to fetch queues' }
    }

    const queues = await Promise.all(
      (participations || []).map(async (p: any) => {
        // Get participant count for this session
        const { count } = await supabase
          .from('queue_participants')
          .select('*', { count: 'exact', head: true })
          .eq('queue_session_id', p.queue_session_id)
          .is('left_at', null)

        // Get user's position
        const { data: earlierParticipants } = await supabase
          .from('queue_participants')
          .select('id')
          .eq('queue_session_id', p.queue_session_id)
          .is('left_at', null)
          .lt('joined_at', p.joined_at)

        const position = (earlierParticipants?.length || 0) + 1
        const estimatedWaitTime = position * 15 // 15 min per position

        return {
          id: p.queue_session_id,
          courtId: p.queue_sessions.court_id,
          courtName: p.queue_sessions.courts?.name || 'Unknown Court',
          venueName: p.queue_sessions.courts?.venues?.name || 'Unknown Venue',
          venueId: p.queue_sessions.courts?.venues?.id || '',
          status: p.queue_sessions.status,
          players: [],
          userPosition: position,
          estimatedWaitTime,
          maxPlayers: p.queue_sessions.max_players,
          currentPlayers: count || 0,
          userGamesPlayed: p.games_played || 0,
          userAmountOwed: parseFloat(p.amount_owed || '0'),
        }
      })
    )

    console.log('[getMyQueues] ✅ Fetched queues:', queues.length)

    return { success: true, queues }
  } catch (error: any) {
    console.error('[getMyQueues] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to fetch queues' }
  }
}

/**
 * Get nearby active queue sessions
 */
export async function getNearbyQueues(latitude?: number, longitude?: number) {
  console.log('[getNearbyQueues] 🔍 Fetching nearby queues')

  try {
    const supabase = await createClient()

    // Get active queue sessions - ONLY approved sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('queue_sessions')
      .select(`
        *,
        courts (
          id,
          name,
          venues (
            id,
            name,
            latitude,
            longitude
          )
        )
      `)
      .in('status', ['open', 'active'])
      .eq('is_public', true)
      .eq('approval_status', 'approved') // CRITICAL: Only show approved sessions
      .order('start_time', { ascending: true })
      .limit(20)

    if (sessionsError) {
      console.error('[getNearbyQueues] ❌ Failed to fetch sessions:', sessionsError)
      return { success: false, error: 'Failed to fetch queues' }
    }

    const queues = (sessions || []).map((session: any) => {
      // Use the current_players column which is maintained by database triggers
      const currentPlayers = session.current_players || 0
      const estimatedWaitTime = currentPlayers * 15

      console.log(`[getNearbyQueues] 📊 Session ${session.id.slice(0, 8)}: current_players=${currentPlayers}`)

      return {
        id: session.id,
        courtId: session.court_id,
        courtName: session.courts?.name || 'Unknown Court',
        venueName: session.courts?.venues?.name || 'Unknown Venue',
        venueId: session.courts?.venues?.id || '',
        status: session.status,
        players: [],
        userPosition: null,
        estimatedWaitTime,
        maxPlayers: session.max_players,
        currentPlayers,
      }
    })

    console.log('[getNearbyQueues] ✅ Fetched queues:', queues.length)

    return { success: true, queues }
  } catch (error: any) {
    console.error('[getNearbyQueues] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to fetch nearby queues' }
  }
}

/**
 * Calculate amount owed by a participant
 */
export async function calculateQueuePayment(sessionId: string) {
  console.log('[calculateQueuePayment] 💰 Calculating payment')

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get participant and session details
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select(`
        *,
        queue_sessions (
          cost_per_game,
          courts (
            name,
            venues (
              name
            )
          )
        )
      `)
      .eq('queue_session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return { success: false, error: 'Participant not found' }
    }

    const costPerGame = parseFloat(participant.queue_sessions.cost_per_game || '0')
    const gamesPlayed = participant.games_played || 0
    const totalOwed = costPerGame * gamesPlayed
    const amountPaid = 0 // Track separately if needed

    return {
      success: true,
      payment: {
        participantId: participant.id,
        sessionId: sessionId,
        gamesPlayed,
        costPerGame,
        totalOwed,
        amountPaid,
        remainingBalance: totalOwed - amountPaid,
        courtName: participant.queue_sessions.courts?.name || 'Unknown Court',
        venueName: participant.queue_sessions.courts?.venues?.name || 'Unknown Venue',
      },
    }
  } catch (error: any) {
    console.error('[calculateQueuePayment] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to calculate payment' }
  }
}

/**
 * ========================================
 * QUEUE MASTER MANAGEMENT ACTIONS
 * ========================================
 * These actions are for Queue Masters to create and manage queue sessions
 */

/**
 * Create a new queue session
 * Queue Master action
 */
export async function createQueueSession(data: {
  courtId: string
  startTime: Date
  endTime: Date
  mode: 'casual' | 'competitive'
  gameFormat: 'singles' | 'doubles' | 'mixed'
  maxPlayers: number
  costPerGame: number
  isPublic: boolean
}): Promise<{
  success: boolean
  session?: QueueSessionData
  requiresApproval?: boolean
  error?: string
}> {
  console.log('[createQueueSession] 🚀 Creating queue session:', data)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[createQueueSession] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('CREATE_SESSION', user.id))
    if (!rateLimitResult.allowed) {
      console.warn('[createQueueSession] ⚠️ Rate limit exceeded for user:', user.id)
      return {
        success: false,
        error: `Too many session creation attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // 2. Check user has queue_master role
    const { data: roles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner (
          name
        )
      `)
      .eq('user_id', user.id)

    const hasQueueMasterRole = roles?.some((r: any) => r.roles?.name === 'queue_master')

    if (!hasQueueMasterRole) {
      console.error('[createQueueSession] ❌ User does not have queue_master role')
      return { success: false, error: 'Unauthorized: Queue Master role required' }
    }

    // 3. Validate inputs
    if (new Date(data.endTime) <= new Date(data.startTime)) {
      return { success: false, error: 'End time must be after start time' }
    }

    if (data.costPerGame < 0) {
      return { success: false, error: 'Cost per game must be non-negative' }
    }

    if (data.maxPlayers < 4 || data.maxPlayers > 20) {
      return { success: false, error: 'Max players must be between 4 and 20' }
    }

    // 4. Verify court exists and get venue approval settings
    const { data: court, error: courtError } = await supabase
      .from('courts')
      .select(`
        id,
        name,
        is_active,
        venue_id,
        venues!inner (
          id,
          name,
          requires_queue_approval
        )
      `)
      .eq('id', data.courtId)
      .single()

    if (courtError || !court) {
      console.error('[createQueueSession] ❌ Court not found:', courtError)
      return { success: false, error: 'Court not found' }
    }

    if (!court.is_active) {
      return { success: false, error: 'Court is not active' }
    }

    // Determine if approval is required
    const venue = court.venues as any
    const requiresApproval = venue?.requires_queue_approval ?? true
    const initialStatus = requiresApproval ? 'pending_approval' : 'draft'
    const approvalStatus = requiresApproval ? 'pending' : 'approved'

    console.log('[createQueueSession] 📋 Venue approval settings:', {
      requiresApproval,
      initialStatus,
      approvalStatus,
    })

    // 5. Check for conflicting reservations before creating queue session
    const { data: conflictingReservations, error: conflictError } = await supabase
      .from('reservations')
      .select('id, start_time, end_time, status, user_id')
      .eq('court_id', data.courtId)
      .in('status', ['pending', 'confirmed', 'pending_payment', 'paid'])
      .lt('start_time', data.endTime.toISOString())
      .gt('end_time', data.startTime.toISOString())

    if (conflictError) {
      console.error('[createQueueSession] ❌ Error checking for reservation conflicts:', conflictError)
    }

    if (conflictingReservations && conflictingReservations.length > 0) {
      const reservation = conflictingReservations[0]
      const resStart = new Date(reservation.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      const resEnd = new Date(reservation.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

      console.warn('[createQueueSession] ⚠️ Reservation conflict detected:', reservation)
      return {
        success: false,
        error: `Court already has a confirmed reservation during this time (${resStart} - ${resEnd}). Please choose a different time slot.`,
      }
    }

    console.log('[createQueueSession] ✅ No conflicting reservations found')

    // 6. Create a reservation to block the time slot for the queue session
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        court_id: data.courtId,
        user_id: user.id,
        start_time: data.startTime.toISOString(),
        end_time: data.endTime.toISOString(),
        status: 'confirmed', // Queue session reservations are immediately confirmed
        total_amount: 0, // No upfront payment for queue sessions
        amount_paid: 0,
        num_players: data.maxPlayers,
        payment_type: 'full',
        metadata: {
          booking_origin: 'queue_session',
          queue_session_organizer: true,
          is_queue_session_reservation: true,
        },
        notes: `Queue Session (${data.mode} - ${data.gameFormat}) - Reserved by Queue Master`,
      })
      .select('id')
      .single()

    if (reservationError || !reservation) {
      console.error('[createQueueSession] ❌ Failed to create reservation:', reservationError)
      return { success: false, error: 'Failed to reserve time slot for queue session' }
    }

    console.log('[createQueueSession] ✅ Reservation created for queue session:', reservation.id)

    // 7. Insert queue session with approval status and link to reservation
    const { data: session, error: insertError } = await supabase
      .from('queue_sessions')
      .insert({
        court_id: data.courtId,
        organizer_id: user.id,
        start_time: data.startTime.toISOString(),
        end_time: data.endTime.toISOString(),
        mode: data.mode,
        game_format: data.gameFormat,
        max_players: data.maxPlayers,
        cost_per_game: data.costPerGame,
        is_public: data.isPublic,
        status: initialStatus,
        current_players: 0,
        requires_approval: requiresApproval,
        approval_status: approvalStatus,
        metadata: {
          reservation_id: reservation.id, // Link queue session to its blocking reservation
        },
      })
      .select()
      .single()

    if (insertError || !session) {
      console.error('[createQueueSession] ❌ Failed to create session:', insertError)
      
      // Rollback: Delete the reservation if queue session creation fails
      await supabase.from('reservations').delete().eq('id', reservation.id)
      
      return { success: false, error: insertError?.message || 'Failed to create queue session' }
    }

    // 8. Format response
    const queueData: QueueSessionData = {
      id: session.id,
      courtId: session.court_id,
      courtName: court.name,
      venueName: venue?.name || 'Unknown Venue',
      venueId: venue?.id || '',
      status: session.status,
      currentPlayers: 0,
      maxPlayers: session.max_players,
      costPerGame: parseFloat(session.cost_per_game),
      startTime: new Date(session.start_time),
      endTime: new Date(session.end_time),
      mode: session.mode,
      gameFormat: session.game_format,
    }

    console.log('[createQueueSession] ✅ Queue session created successfully:', {
      id: queueData.id,
      requiresApproval,
      status: initialStatus,
      approvalStatus,
    })

    // 9. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${data.courtId}`)

    return { success: true, session: queueData, requiresApproval }
  } catch (error: any) {
    console.error('[createQueueSession] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to create queue session' }
  }
}

/**
 * Update an existing queue session
 * Queue Master action
 */
export async function updateQueueSession(
  sessionId: string,
  updates: Partial<{
    startTime: Date
    endTime: Date
    mode: 'casual' | 'competitive'
    gameFormat: 'singles' | 'doubles' | 'mixed'
    maxPlayers: number
    costPerGame: number
    isPublic: boolean
  }>
): Promise<{
  success: boolean
  session?: QueueSessionData
  error?: string
}> {
  console.log('[updateQueueSession] 🔄 Updating queue session:', sessionId, updates)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[updateQueueSession] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('[updateQueueSession] ❌ Session not found:', sessionError)
      return { success: false, error: 'Queue session not found' }
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 3. Only allow updates if status is draft or open
    if (!['draft', 'open'].includes(session.status)) {
      return {
        success: false,
        error: 'Cannot update session in current status. Only draft or open sessions can be updated.',
      }
    }

    // 4. Validate updates
    if (updates.startTime && updates.endTime) {
      if (new Date(updates.endTime) <= new Date(updates.startTime)) {
        return { success: false, error: 'End time must be after start time' }
      }
    }

    if (updates.costPerGame !== undefined && updates.costPerGame < 0) {
      return { success: false, error: 'Cost per game must be non-negative' }
    }

    if (updates.maxPlayers !== undefined && (updates.maxPlayers < 4 || updates.maxPlayers > 20)) {
      return { success: false, error: 'Max players must be between 4 and 20' }
    }

    // 5. Build update object
    const updateData: any = {}
    if (updates.startTime) updateData.start_time = updates.startTime.toISOString()
    if (updates.endTime) updateData.end_time = updates.endTime.toISOString()
    if (updates.mode) updateData.mode = updates.mode
    if (updates.gameFormat) updateData.game_format = updates.gameFormat
    if (updates.maxPlayers !== undefined) updateData.max_players = updates.maxPlayers
    if (updates.costPerGame !== undefined) updateData.cost_per_game = updates.costPerGame
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic

    // 6. Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from('queue_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select(`
        *,
        courts (
          name,
          venues (
            id,
            name
          )
        )
      `)
      .single()

    if (updateError || !updatedSession) {
      console.error('[updateQueueSession] ❌ Failed to update session:', updateError)
      return { success: false, error: updateError?.message || 'Failed to update queue session' }
    }

    // 7. Format response
    const queueData: QueueSessionData = {
      id: updatedSession.id,
      courtId: updatedSession.court_id,
      courtName: updatedSession.courts?.name || 'Unknown Court',
      venueName: updatedSession.courts?.venues?.name || 'Unknown Venue',
      venueId: updatedSession.courts?.venues?.id || '',
      status: updatedSession.status,
      currentPlayers: updatedSession.current_players || 0,
      maxPlayers: updatedSession.max_players,
      costPerGame: parseFloat(updatedSession.cost_per_game),
      startTime: new Date(updatedSession.start_time),
      endTime: new Date(updatedSession.end_time),
      mode: updatedSession.mode,
      gameFormat: updatedSession.game_format,
    }

    console.log('[updateQueueSession] ✅ Queue session updated successfully')

    // 8. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath(`/queue-master/sessions/${sessionId}`)

    return { success: true, session: queueData }
  } catch (error: any) {
    console.error('[updateQueueSession] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to update queue session' }
  }
}

/**
 * Pause an active queue session
 * Queue Master action
 */
export async function pauseQueueSession(sessionId: string): Promise<{
  success: boolean
  error?: string
}> {
  console.log('[pauseQueueSession] ⏸️ Pausing queue session:', sessionId)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' }
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 3. Check current status
    if (session.status !== 'active') {
      return { success: false, error: 'Can only pause active sessions' }
    }

    // 4. Update status to paused
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({ status: 'paused' })
      .eq('id', sessionId)

    if (updateError) {
      console.error('[pauseQueueSession] ❌ Failed to pause session:', updateError)
      return { success: false, error: 'Failed to pause queue session' }
    }

    console.log('[pauseQueueSession] ✅ Queue session paused successfully')

    // 5. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath(`/queue-master/sessions/${sessionId}`)

    return { success: true }
  } catch (error: any) {
    console.error('[pauseQueueSession] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to pause queue session' }
  }
}

/**
 * Resume a paused queue session
 * Queue Master action
 */
export async function resumeQueueSession(sessionId: string): Promise<{
  success: boolean
  error?: string
}> {
  console.log('[resumeQueueSession] ▶️ Resuming queue session:', sessionId)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' }
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 3. Check current status
    if (session.status !== 'paused') {
      return { success: false, error: 'Can only resume paused sessions' }
    }

    // 4. Update status to active
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({ status: 'active' })
      .eq('id', sessionId)

    if (updateError) {
      console.error('[resumeQueueSession] ❌ Failed to resume session:', updateError)
      return { success: false, error: 'Failed to resume queue session' }
    }

    console.log('[resumeQueueSession] ✅ Queue session resumed successfully')

    // 5. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath(`/queue-master/sessions/${sessionId}`)

    return { success: true }
  } catch (error: any) {
    console.error('[resumeQueueSession] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to resume queue session' }
  }
}

/**
 * Close a queue session and generate summary
 * Queue Master action
 */
export async function closeQueueSession(sessionId: string): Promise<{
  success: boolean
  summary?: {
    totalGames: number
    totalRevenue: number
    totalParticipants: number
    unpaidBalances: number
  }
  error?: string
}> {
  console.log('[closeQueueSession] 🔒 Closing queue session:', sessionId)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' }
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 3. Get all participants
    const { data: participants, error: participantsError } = await supabase
      .from('queue_participants')
      .select('games_played, amount_owed, payment_status')
      .eq('queue_session_id', sessionId)

    if (participantsError) {
      console.error('[closeQueueSession] ❌ Failed to fetch participants:', participantsError)
      return { success: false, error: 'Failed to fetch participants' }
    }

    // 4. Calculate summary
    const totalGames = participants?.reduce((sum, p) => sum + (p.games_played || 0), 0) || 0
    const totalRevenue = participants?.reduce((sum, p) => sum + parseFloat(p.amount_owed || '0'), 0) || 0
    const totalParticipants = participants?.length || 0
    const unpaidBalances = participants?.filter(p => p.payment_status !== 'paid' && parseFloat(p.amount_owed || '0') > 0).length || 0

    const summary = {
      totalGames,
      totalRevenue,
      totalParticipants,
      unpaidBalances,
    }

    // 5. Update session status to closed
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({
        status: 'closed',
        settings: {
          closed_at: new Date().toISOString(),
          summary,
        },
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('[closeQueueSession] ❌ Failed to close session:', updateError)
      return { success: false, error: 'Failed to close queue session' }
    }

    console.log('[closeQueueSession] ✅ Queue session closed successfully:', summary)

    // 6. Send notifications to all participants
    try {
      const { data: venue } = await supabase
        .from('courts')
        .select('name, venues(name)')
        .eq('id', session.court_id)
        .single()

      const venueData = venue?.venues ? (Array.isArray(venue.venues) ? venue.venues[0] : venue.venues) : null
      const venueName = venueData?.name || 'Venue'

      const { data: allParticipants } = await supabase
        .from('queue_participants')
        .select('user_id, games_played')
        .eq('queue_session_id', sessionId)
        .is('left_at', null)

      if (allParticipants && allParticipants.length > 0) {
        const notifications = allParticipants.map(p => ({
          userId: p.user_id,
          ...NotificationTemplates.queueSessionEnded(venueName, p.games_played || 0, sessionId),
        }))

        await createBulkNotifications(notifications)
        console.log('[closeQueueSession] 📬 Sent', notifications.length, 'end-of-session notifications')
      }
    } catch (notificationError) {
      console.error('[closeQueueSession] ⚠️ Failed to send notifications (non-critical):', notificationError)
    }

    // 7. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath(`/queue-master/sessions/${sessionId}`)

    return { success: true, summary }
  } catch (error: any) {
    console.error('[closeQueueSession] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to close queue session' }
  }
}

/**
 * Cancel a queue session
 * Queue Master action
 */
export async function cancelQueueSession(
  sessionId: string,
  reason: string
): Promise<{
  success: boolean
  error?: string
}> {
  console.log('[cancelQueueSession] ❌ Cancelling queue session:', sessionId, reason)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id, current_players')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' }
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 3. Only allow cancellation if status is draft or open with no players
    if (!['draft', 'open'].includes(session.status)) {
      return { success: false, error: 'Can only cancel draft or open sessions' }
    }

    if (session.current_players > 0) {
      return {
        success: false,
        error: 'Cannot cancel session with active participants. Close the session instead.',
      }
    }

    // 4. Update session status to cancelled
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({
        status: 'cancelled',
        metadata: {
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        },
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('[cancelQueueSession] ❌ Failed to cancel session:', updateError)
      return { success: false, error: 'Failed to cancel queue session' }
    }

    console.log('[cancelQueueSession] ✅ Queue session cancelled successfully')

    // 5. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath(`/queue-master/sessions/${sessionId}`)

    return { success: true }
  } catch (error: any) {
    console.error('[cancelQueueSession] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to cancel queue session' }
  }
}

/**
 * Remove a participant from the queue
 * Queue Master action
 */
export async function removeParticipant(
  sessionId: string,
  userId: string,
  reason: string
): Promise<{
  success: boolean
  amountOwed?: number
  error?: string
}> {
  console.log('[removeParticipant] 🚫 Removing participant:', { sessionId, userId, reason })

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, court_id, cost_per_game')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' }
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 3. Get participant record
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select('*')
      .eq('queue_session_id', sessionId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single()

    if (participantError || !participant) {
      return { success: false, error: 'Participant not found' }
    }

    // 4. Prevent removing players in active matches
    if (participant.status === 'playing') {
      return {
        success: false,
        error: 'Cannot remove player from active match. Please complete or cancel the match first.',
      }
    }

    // 5. Calculate amount owed if not already set
    const gamesPlayed = participant.games_played || 0
    const costPerGame = parseFloat(session.cost_per_game || '0')
    const amountOwed = gamesPlayed * costPerGame

    // 6. Update participant with metadata about removal
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({
        status: 'left',
        left_at: new Date().toISOString(),
        amount_owed: amountOwed,
        metadata: {
          ...participant.metadata,
          removed_by: user.id,
          removal_reason: reason,
          removed_at: new Date().toISOString(),
        },
      })
      .eq('id', participant.id)

    if (updateError) {
      console.error('[removeParticipant] ❌ Failed to update participant:', updateError)
      return { success: false, error: 'Failed to remove participant' }
    }

    // 7. Decrement current_players count
    const { error: decrementError } = await supabase.rpc('decrement_queue_players', {
      session_id: sessionId,
    })

    if (decrementError) {
      console.warn('[removeParticipant] ⚠️ Failed to decrement player count:', decrementError)
      // Not critical - continue
    }

    console.log('[removeParticipant] ✅ Participant removed successfully:', {
      amountOwed,
      gamesPlayed,
    })

    // 8. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${session.court_id}`)
    revalidatePath(`/queue-master/sessions/${sessionId}`)

    return { success: true, amountOwed }
  } catch (error: any) {
    console.error('[removeParticipant] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to remove participant' }
  }
}

/**
 * Waive fee for a participant
 * Queue Master action
 */
export async function waiveFee(
  participantId: string,
  reason: string
): Promise<{
  success: boolean
  error?: string
}> {
  console.log('[waiveFee] 💸 Waiving fee for participant:', participantId, reason)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Get participant and session details
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select(`
        *,
        queue_sessions!inner (
          organizer_id,
          court_id
        )
      `)
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      return { success: false, error: 'Participant not found' }
    }

    // 3. Verify user is session organizer
    if (participant.queue_sessions.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 4. Update participant to waive fee
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({
        amount_owed: 0,
        payment_status: 'paid',
        metadata: {
          ...participant.metadata,
          fee_waived: {
            waived_at: new Date().toISOString(),
            waived_by: user.id,
            reason: reason,
            original_amount: participant.amount_owed,
          },
        },
      })
      .eq('id', participantId)

    if (updateError) {
      console.error('[waiveFee] ❌ Failed to waive fee:', updateError)
      return { success: false, error: 'Failed to waive fee' }
    }

    console.log('[waiveFee] ✅ Fee waived successfully')

    // 5. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${participant.queue_sessions.court_id}`)

    return { success: true }
  } catch (error: any) {
    console.error('[waiveFee] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to waive fee' }
  }
}

/**
 * Mark participant as paid (cash payment)
 * Queue Master action
 */
export async function markAsPaid(
  participantId: string
): Promise<{
  success: boolean
  error?: string
}> {
  console.log('[markAsPaid] 💵 Marking participant as paid:', participantId)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('[markAsPaid] ❌ User not authenticated')
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Get participant and session details
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select(`
        *,
        queue_sessions!inner (
          id,
          organizer_id,
          court_id
        )
      `)
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      console.error('[markAsPaid] ❌ Participant not found:', participantError)
      return { success: false, error: 'Participant not found' }
    }

    console.log('[markAsPaid] 🔍 Participant data:', {
      participantId,
      currentStatus: participant.payment_status,
      amountOwed: participant.amount_owed,
      organizerId: participant.queue_sessions.organizer_id,
    })

    // 3. Verify user is session organizer (Queue Master)
    if (participant.queue_sessions.organizer_id !== user.id) {
      console.error('[markAsPaid] ❌ Unauthorized: Not session organizer')
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 4. Check if already paid
    if (participant.payment_status === 'paid') {
      console.log('[markAsPaid] ℹ️ Participant already marked as paid')
      return { success: true } // Idempotent - already paid is success
    }

    // 5. Update participant to mark as paid (keep amount_owed for records)
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({
        payment_status: 'paid',
        metadata: {
          ...participant.metadata,
          cash_payment: {
            marked_paid_at: new Date().toISOString(),
            marked_paid_by: user.id,
            amount_paid: participant.amount_owed,
            payment_method: 'cash',
          },
        },
      })
      .eq('id', participantId)

    if (updateError) {
      console.error('[markAsPaid] ❌ Failed to update participant:', updateError)
      return { success: false, error: 'Failed to mark as paid' }
    }

    console.log('[markAsPaid] ✅ Participant marked as paid successfully')

    // 6. Revalidate paths for immediate UI update
    revalidatePath('/queue-master')
    revalidatePath(`/queue-master/sessions/${participant.queue_sessions.id}`)
    revalidatePath(`/queue/${participant.queue_sessions.court_id}`)

    return { success: true }
  } catch (error: any) {
    console.error('[markAsPaid] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to mark as paid' }
  }
}

/**
 * Get all queue sessions created by current user (Queue Master)
 */
export async function getMyQueueMasterSessions(filter?: {
  status?: 'active' | 'upcoming' | 'past'
}): Promise<{
  success: boolean
  sessions?: Array<QueueSessionData & { participants: QueueParticipantData[] }>
  error?: string
}> {
  console.log('[getMyQueueMasterSessions] 🔍 Fetching Queue Master sessions:', filter)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Build query based on filter
    let query = supabase
      .from('queue_sessions')
      .select(`
        *,
        courts (
          id,
          name,
          venues (
            id,
            name
          )
        )
      `)
      .eq('organizer_id', user.id)

    // Apply status filter
    if (filter?.status === 'active') {
      query = query.in('status', ['open', 'active', 'paused'])
    } else if (filter?.status === 'upcoming') {
      query = query.eq('status', 'open').gt('start_time', new Date().toISOString())
    } else if (filter?.status === 'past') {
      query = query.in('status', ['closed', 'cancelled'])
    }

    query = query.order('created_at', { ascending: false })

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) {
      console.error('[getMyQueueMasterSessions] ❌ Failed to fetch sessions:', sessionsError)
      return { success: false, error: 'Failed to fetch sessions' }
    }

    // 3. Get participant data for each session
    const sessionsWithParticipants = await Promise.all(
      (sessions || []).map(async (session: any) => {
        // Get participants
        const { data: participants } = await supabase
          .from('queue_participants')
          .select(`
            *,
            user:user_id!inner (
              id,
              display_name,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq('queue_session_id', session.id)
          .is('left_at', null)

        // Get player skill levels
        const playerIds = participants?.map((p: any) => p.user_id) || []
        const { data: players } = await supabase
          .from('players')
          .select('user_id, skill_level')
          .in('user_id', playerIds)

        const playerSkillMap = new Map(players?.map((p: any) => [p.user_id, p.skill_level]) || [])

        const formattedParticipants: QueueParticipantData[] = (participants || []).map((p: any, index: number) => ({
          id: p.id,
          userId: p.user_id,
          playerName: p.user?.display_name || `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() || 'Unknown Player',
          avatarUrl: p.user?.avatar_url,
          skillLevel: playerSkillMap.get(p.user_id) || 5,
          position: index + 1,
          joinedAt: new Date(p.joined_at),
          gamesPlayed: p.games_played || 0,
          gamesWon: p.games_won || 0,
          status: p.status,
          amountOwed: parseFloat(p.amount_owed || '0'),
          paymentStatus: p.payment_status,
        }))

        return {
          id: session.id,
          courtId: session.court_id,
          courtName: session.courts?.name || 'Unknown Court',
          venueName: session.courts?.venues?.name || 'Unknown Venue',
          venueId: session.courts?.venues?.id || '',
          status: session.status,
          currentPlayers: formattedParticipants.length,
          maxPlayers: session.max_players || 12,
          costPerGame: parseFloat(session.cost_per_game || '0'),
          startTime: new Date(session.start_time),
          endTime: new Date(session.end_time),
          mode: session.mode,
          gameFormat: session.game_format,
          participants: formattedParticipants,
        }
      })
    )

    console.log('[getMyQueueMasterSessions] ✅ Fetched sessions:', sessionsWithParticipants.length)

    return { success: true, sessions: sessionsWithParticipants }
  } catch (error: any) {
    console.error('[getMyQueueMasterSessions] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to fetch sessions' }
  }
}

/**
 * Get comprehensive queue session summary for closed/completed sessions
 * Includes all participants, match results, payment status, and session statistics
 */
export async function getQueueSessionSummary(sessionId: string): Promise<{
  success: boolean
  summary?: {
    session: {
      id: string
      status: string
      mode: 'casual' | 'competitive'
      gameFormat: 'singles' | 'doubles' | 'mixed'
      costPerGame: number
      startTime: string
      endTime: string
      courtName: string
      venueName: string
      venueId: string
      organizerName: string
      settings?: any
      summary?: {
        totalGames: number
        totalRevenue: number
        totalParticipants: number
        unpaidBalances: number
        closedAt: string
        closedBy: string
        closedReason: string
      }
    }
    participants: Array<{
      id: string
      userId: string
      playerName: string
      avatarUrl?: string
      skillLevel: number
      position: number
      joinedAt: string
      leftAt?: string
      gamesPlayed: number
      gamesWon: number
      status: string
      amountOwed: number
      paymentStatus: string
    }>
    matches: Array<{
      id: string
      matchNumber: number
      startTime: string
      endTime?: string
      status: string
      team1Players: Array<{ id: string; name: string; skillLevel: number }>
      team2Players: Array<{ id: string; name: string; skillLevel: number }>
      team1Score?: number
      team2Score?: number
      winnerTeam?: number
    }>
  }
  error?: string
}> {
  console.log('[getQueueSessionSummary] 🔍 Fetching summary for session:', sessionId)

  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // 2. Fetch session details with court and venue info
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select(`
        *,
        courts (
          id,
          name,
          venues (
            id,
            name
          )
        ),
        organizer:organizer_id (
          display_name,
          first_name,
          last_name
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('[getQueueSessionSummary] ❌ Session not found:', sessionError)
      return { success: false, error: 'Queue session not found' }
    }

    // Verify user is the organizer or has queue master role
    if (session.organizer_id !== user.id) {
      // Check if user has queue_master role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'queue_master')
        .maybeSingle()

      if (!userRoles) {
        return { success: false, error: 'Unauthorized to view this session summary' }
      }
    }

    // 3. Fetch all participants (including those who left)
    const { data: participants, error: participantsError } = await supabase
      .from('queue_participants')
      .select(`
        *,
        user:user_id!inner (
          id,
          display_name,
          first_name,
          last_name,
          avatar_url
        ),
        player:user_id (
          skill_level
        )
      `)
      .eq('queue_session_id', sessionId)
      .order('position', { ascending: true })

    if (participantsError) {
      console.error('[getQueueSessionSummary] ❌ Failed to fetch participants:', participantsError)
      return { success: false, error: 'Failed to fetch participants' }
    }

    // 4. Fetch all matches for this session
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        *,
        match_players (
          user_id,
          team,
          user:user_id (
            display_name,
            first_name,
            last_name
          ),
          player:user_id (
            skill_level
          )
        )
      `)
      .eq('queue_session_id', sessionId)
      .order('match_number', { ascending: true })

    if (matchesError) {
      console.error('[getQueueSessionSummary] ❌ Failed to fetch matches:', matchesError)
      return { success: false, error: 'Failed to fetch matches' }
    }

    // 5. Transform data for frontend
    const participantsSummary = (participants || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      playerName: p.user.display_name || `${p.user.first_name} ${p.user.last_name}`.trim(),
      avatarUrl: p.user.avatar_url,
      skillLevel: p.player?.skill_level || 1,
      position: p.position,
      joinedAt: p.joined_at,
      leftAt: p.left_at,
      gamesPlayed: p.games_played || 0,
      gamesWon: p.games_won || 0,
      status: p.status,
      amountOwed: p.amount_owed || 0,
      paymentStatus: p.payment_status,
    }))

    const matchesSummary = (matches || []).map((m: any) => {
      const team1Players = (m.match_players || [])
        .filter((mp: any) => mp.team === 1)
        .map((mp: any) => ({
          id: mp.user_id,
          name: mp.user?.display_name || `${mp.user?.first_name} ${mp.user?.last_name}`.trim(),
          skillLevel: mp.player?.skill_level || 1,
        }))

      const team2Players = (m.match_players || [])
        .filter((mp: any) => mp.team === 2)
        .map((mp: any) => ({
          id: mp.user_id,
          name: mp.user?.display_name || `${mp.user?.first_name} ${mp.user?.last_name}`.trim(),
          skillLevel: mp.player?.skill_level || 1,
        }))

      return {
        id: m.id,
        matchNumber: m.match_number,
        startTime: m.start_time,
        endTime: m.end_time,
        status: m.status,
        team1Players,
        team2Players,
        team1Score: m.team1_score,
        team2Score: m.team2_score,
        winnerTeam: m.winner_team,
      }
    })

    // Extract summary from settings if available
    const sessionSummary = session.settings?.summary

    const summary = {
      session: {
        id: session.id,
        status: session.status,
        mode: session.mode,
        gameFormat: session.game_format,
        costPerGame: session.cost_per_game,
        startTime: session.start_time,
        endTime: session.end_time,
        courtName: session.courts?.name || 'Unknown Court',
        venueName: session.courts?.venues?.name || 'Unknown Venue',
        venueId: session.courts?.venues?.id || '',
        organizerName:
          session.organizer?.display_name ||
          `${session.organizer?.first_name} ${session.organizer?.last_name}`.trim() ||
          'Unknown',
        settings: session.settings,
        summary: sessionSummary,
      },
      participants: participantsSummary,
      matches: matchesSummary,
    }

    console.log('[getQueueSessionSummary] ✅ Summary fetched:', {
      participants: participantsSummary.length,
      matches: matchesSummary.length,
    })

    return { success: true, summary }
  } catch (error: any) {
    console.error('[getQueueSessionSummary] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to fetch session summary' }
  }
}
