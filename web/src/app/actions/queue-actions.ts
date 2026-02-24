'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkRateLimit, createRateLimitConfig } from '@/lib/rate-limiter'
import { createBulkNotifications, createNotification, NotificationTemplates } from '@/lib/notifications'
import { getServerNow } from '@/lib/time-server'

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
  status: 'pending_payment' | 'open' | 'active' | 'completed' | 'cancelled'
  currentPlayers: number
  maxPlayers: number
  costPerGame: number
  startTime: Date
  endTime: Date
  createdAt: Date
  mode: 'casual' | 'competitive'
  gameFormat: 'singles' | 'doubles' | 'mixed'
  reservationId?: string
  totalCost?: number
  paymentStatus?: 'pending' | 'paid' | 'failed'
  paymentMethod?: 'cash' | 'e-wallet'
  participants?: QueueParticipantData[]
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

    if (sessionError) {
      console.error('[getQueueDetails] ❌ Database error:', sessionError)
      return { success: false, error: `Database error: ${sessionError.message}` }
    }

    if (!session) {
      console.log('[getQueueDetails] ℹ️ No active queue found for court')
      return { success: true, queue: null }
    }

    // AUTO-CLOSE CHECK: If session is past end_time, close it automatically
    const now = await getServerNow()
    if (new Date(session.end_time) < now) {
      console.log('[getQueueDetails] 🕒 Session expired, auto-closing:', session.id)

      // Update DB to close the session
      const { error: closeError } = await supabase
        .from('queue_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id)

      if (closeError) {
        console.error('[getQueueDetails] ❌ Failed to auto-close session:', closeError)
      } else {
        // Revalidate to ensure UI updates immediately
        revalidatePath(`/queue/${courtId}`)
        revalidatePath('/queue')
      }

      // Return null effectively removing it from view
      return { success: true, queue: null }
    }

    // AUTO-ACTIVATE: If session is 'open' and start_time has passed, flip to 'active'
    if (session.status === 'open' && new Date(session.start_time) <= now) {
      console.log('[getQueueDetails] ▶️ Auto-activating session (start_time reached):', session.id)
      const { error: activateError } = await supabase
        .from('queue_sessions')
        .update({ status: 'active' })
        .eq('id', session.id)

      if (!activateError) {
        session.status = 'active'
        revalidatePath(`/queue/${courtId}`)
        revalidatePath('/queue')
      }
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
      createdAt: new Date(session.created_at),
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

    // Call the centralized RPC function
    const { data: rpcResult, error: rpcError } = await supabase.rpc('join_queue', {
      p_session_id: sessionId,
      p_user_id: user.id
    })

    if (rpcError) {
      console.error('[joinQueue] ❌ RPC Error:', rpcError)
      return { success: false, error: 'Failed to join queue' }
    }

    if (!rpcResult.success) {
      console.warn('[joinQueue] ⚠️ Join rejected by RPC:', rpcResult.error)
      return { success: false, error: rpcResult.error }
    }

    console.log('[joinQueue] ✅ Successfully joined/rejoined queue via RPC:', rpcResult.action)

    // Revalidate queue pages
    revalidatePath(`/queue/${session.courts.id}`)
    revalidatePath('/queue')

    return {
      success: true,
      participant: { id: rpcResult.participant_id } // Return minimal info needed
    }
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
    const now = await getServerNow()
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({
        left_at: now.toISOString(),
        status: 'left',
      })
      .eq('id', participant.id)

    if (updateError) {
      console.error('[leaveQueue] ❌ Failed to leave queue:', updateError)
      return { success: false, error: 'Failed to leave queue' }
    }

    // Decrement current_players count
    const { error: decrementError } = await supabase.rpc('decrement_queue_players', {
      session_id: sessionId,
    })
    if (decrementError) {
      console.warn('[leaveQueue] ⚠️ Failed to decrement player count:', decrementError)
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
      .gt('queue_sessions.end_time', (await getServerNow()).toISOString()) // Filter out expired sessions
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
          startTime: new Date(p.queue_sessions.start_time),
          endTime: new Date(p.queue_sessions.end_time),
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
 * Get user's queue history (past sessions)
 */
export async function getMyQueueHistory() {
  console.log('[getMyQueueHistory] 🔍 Fetching queue history')

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get all past queue participations
    // We consider it "history" if:
    // 1. Session is closed/cancelled OR
    // 2. Session is past end_time OR
    // 3. User has 'left' status
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
      .order('joined_at', { ascending: false })
      .limit(50) // Limit to last 50 for now

    if (participationsError) {
      console.error('[getMyQueueHistory] ❌ Failed to fetch history:', participationsError)
      return { success: false, error: 'Failed to fetch history' }
    }

    const serverNow = await getServerNow()

    const history = (participations || [])
      .filter((p: any) => {
        const isLeft = p.status === 'left'
        const isSessionClosed = ['closed', 'cancelled'].includes(p.queue_sessions?.status)
        const isSessionEnded = new Date(p.queue_sessions?.end_time) < serverNow
        return isLeft || isSessionClosed || isSessionEnded
      })
      .map((p: any) => {
        const costPerGame = parseFloat(p.queue_sessions.cost_per_game || '0')
        const gamesPlayed = p.games_played || 0
        const totalCost = costPerGame * gamesPlayed

        return {
          id: p.queue_session_id,
          courtId: p.queue_sessions.court_id,
          courtName: p.queue_sessions.courts?.name || 'Unknown Court',
          venueName: p.queue_sessions.courts?.venues?.name || 'Unknown Venue',
          status: p.queue_sessions.status, // might be 'active' if user just left
          date: p.queue_sessions.start_time,
          joinedAt: p.joined_at,
          leftAt: p.left_at,
          gamesPlayed,
          gamesWon: p.games_won || 0,
          totalCost,
          paymentStatus: p.payment_status,
          userStatus: p.status, // 'left' or 'waiting'/'playing' if session closed
        }
      })

    console.log('[getMyQueueHistory] ✅ Fetched history items:', history.length)

    return { success: true, history }
  } catch (error: any) {
    console.error('[getMyQueueHistory] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to fetch queue history' }
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
      .gt('end_time', (await getServerNow()).toISOString()) // Filter out expired sessions
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
        startTime: new Date(session.start_time),
        endTime: new Date(session.end_time),
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
      .is('left_at', null)
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
 * Get queue session history for Queue Master (sessions they organized)
 */
export async function getQueueMasterHistory() {
  console.log('[getQueueMasterHistory] 🔍 Fetching queue master history')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Fetch sessions organized by user that are completed or cancelled
    // Also include expired sessions that might still be marked active/open if cron failed (fallback)
    const { data: sessions, error } = await supabase
      .from('queue_sessions')
      .select(`
        *,
        courts (
          name,
          venues (
            name
          )
        )
      `)
      .eq('organizer_id', user.id)
      .or(`status.in.(completed,cancelled),end_time.lt.${(await getServerNow()).toISOString()}`)
      .order('start_time', { ascending: false })

    if (error) throw error

    // Format for display
    const history = sessions?.map(session => ({
      id: session.id,
      courtName: session.courts?.name || 'Unknown Court',
      venueName: session.courts?.venues?.name || 'Unknown Venue',
      status: session.status,
      startTime: new Date(session.start_time),
      endTime: new Date(session.end_time),
      maxPlayers: session.max_players,
      costPerGame: session.cost_per_game,
      totalRevenue: session.settings?.summary?.totalRevenue || 0,
      totalGames: session.settings?.summary?.totalGames || 0,
      closedBy: session.settings?.summary?.closedBy || 'unknown',
    })) || []

    return { success: true, history }
  } catch (error: any) {
    console.error('[getQueueMasterHistory] ❌ Error:', error)
    return { success: false, error: error.message }
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
  recurrenceWeeks?: number
  selectedDays?: number[]
  paymentMethod?: 'cash' | 'e-wallet'
}): Promise<{
  success: boolean
  session?: QueueSessionData
  sessions?: QueueSessionData[]
  requiresApproval?: boolean
  error?: string
}> {
  console.log('[createQueueSession] 🚀 Creating queue session(s):', data)

  const recurrenceWeeks = data.recurrenceWeeks || 1
  const createdSessions: QueueSessionData[] = []

  // Generate a recurrence group ID if applicable
  const recurrenceGroupId = recurrenceWeeks > 1 ? crypto.randomUUID() : undefined

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

    // 3. Validate inputs (Basic)
    if (new Date(data.endTime) <= new Date(data.startTime)) {
      return { success: false, error: 'End time must be after start time' }
    }
    if (data.costPerGame < 0) {
      return { success: false, error: 'Cost per game must be non-negative' }
    }
    if (data.maxPlayers < 4 || data.maxPlayers > 20) {
      return { success: false, error: 'Max players must be between 4 and 20' }
    }

    // 4. Verify court exists and get venue settings + hourly rate
    const { data: court, error: courtError } = await supabase
      .from('courts')
      .select(`
        id,
        name,
        is_active,
        venue_id,
        hourly_rate,
        venues!inner (
          id,
          name,
          requires_queue_approval,
          opening_hours
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
    if (!court.hourly_rate || court.hourly_rate <= 0) {
      console.error('[createQueueSession] ❌ Court hourly rate not configured')
      return { success: false, error: 'Court hourly rate not configured. Please contact venue admin.' }
    }

    // Extract venue from court data
    const venue = court.venues as any

    // Simplified: All sessions start as pending_payment regardless of payment method
    // Payment confirmation (e-wallet) or manual marking (cash) moves them to active/open

    // --- LOOP START ---
    // Generate all target dates first
    const targetDates: Date[] = []
    const startObj = new Date(data.startTime)
    // Normalize to start of day for safer comparisons if needed, 
    // but here we need exact times.

    // Determine the "anchored" days
    // If selectedDays is provided, use it. Otherwise default to the start day.
    const daysToBook = data.selectedDays && data.selectedDays.length > 0
      ? data.selectedDays
      : [startObj.getDay()]

    const startDayIndex = startObj.getDay()

    for (let i = 0; i < recurrenceWeeks; i++) {
      for (const dayIndex of daysToBook) {
        const dayOffset = (dayIndex - startDayIndex + 7) % 7

        const targetStart = new Date(startObj.getTime())
        targetStart.setDate(targetStart.getDate() + (i * 7) + dayOffset)

        targetDates.push(targetStart)
      }
    }

    if (targetDates.length === 0) {
      return { success: false, error: 'No valid future dates selected.' }
    }


    // Pre-validation Loop
    for (const sessionStart of targetDates) {
      const sessionEnd = new Date(sessionStart)
      sessionEnd.setTime(sessionStart.getTime() + (new Date(data.endTime).getTime() - new Date(data.startTime).getTime()))

      // Validate against venue hours
      const openingHours = venue?.opening_hours as Record<string, { open: string; close: string }> | null
      if (openingHours) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const dayOfWeek = dayNames[sessionStart.getDay()]
        const dayHours = openingHours[dayOfWeek]

        if (!dayHours) {
          return { success: false, error: `Venue is closed on ${dayOfWeek} (${sessionStart.toLocaleDateString()})` }
        }

        // Parse open/close times
        const [openH, openM] = dayHours.open.split(':').map(Number)
        const [closeH, closeM] = dayHours.close.split(':').map(Number)

        const sessionStartH = sessionStart.getHours()
        const sessionStartM = sessionStart.getMinutes()
        const sessionEndH = sessionEnd.getHours()
        const sessionEndM = sessionEnd.getMinutes()

        const sessionStartMinutes = sessionStartH * 60 + sessionStartM
        const sessionEndMinutes = sessionEndH * 60 + sessionEndM
        const openMinutes = openH * 60 + (openM || 0)
        const closeMinutes = closeH * 60 + (closeM || 0)

        // Allow tight fitting? Usually yes.
        if (sessionStartMinutes < openMinutes || sessionEndMinutes > closeMinutes) {
          const timeStr = sessionStart.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          return {
            success: false,
            error: `Venue is closed at ${timeStr} on ${dayOfWeek}s (Open: ${dayHours.open} - ${dayHours.close})`
          }
        }
      }

      // Check conflicts
      const { data: conflicts } = await supabase
        .from('reservations')
        .select('id')
        .eq('court_id', data.courtId)
        .in('status', ['pending_payment', 'confirmed', 'paid', 'ongoing'])
        .lt('start_time', sessionEnd.toISOString())
        .gt('end_time', sessionStart.toISOString())

      if (conflicts && conflicts.length > 0) {
        return { success: false, error: `Conflict detected for ${sessionStart.toLocaleDateString()} at ${sessionStart.toLocaleTimeString()}` }
      }
    }

    // Creation Loop
    for (const sessionStart of targetDates) {
      const sessionEnd = new Date(sessionStart)
      sessionEnd.setTime(sessionStart.getTime() + (new Date(data.endTime).getTime() - new Date(data.startTime).getTime()))

      // Calculate payment amounts
      const durationMs = sessionEnd.getTime() - sessionStart.getTime()
      const durationHours = durationMs / (1000 * 60 * 60)
      const courtRental = court.hourly_rate * durationHours
      const platformFee = courtRental * 0.05
      const totalAmount = courtRental + platformFee

      console.log(`[createQueueSession] 💰 Payment calculation:`, {
        hourlyRate: court.hourly_rate,
        durationHours,
        courtRental,
        platformFee,
        totalAmount
      })

      // Calculate cash payment deadline for queue session reservations
      let cashPaymentDeadline: string | null = null
      if (data.paymentMethod === 'cash') {
        const twoHoursBefore = new Date(sessionStart.getTime() - 2 * 60 * 60 * 1000)
        const minimumDeadline = new Date(Date.now() + 30 * 60 * 1000)
        const deadline = twoHoursBefore > minimumDeadline ? twoHoursBefore : minimumDeadline
        cashPaymentDeadline = deadline.toISOString()
      }

      // Create Reservation with payment requirement
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          court_id: data.courtId,
          user_id: user.id,
          start_time: sessionStart.toISOString(),
          end_time: sessionEnd.toISOString(),
          status: 'pending_payment',
          total_amount: totalAmount, // Fixed: Include platform fee in total_amount
          amount_paid: 0,
          num_players: data.maxPlayers,
          payment_type: 'full',
          payment_method: data.paymentMethod || null,
          cash_payment_deadline: cashPaymentDeadline,
          metadata: {
            booking_origin: 'queue_session',
            queue_session_organizer: true,
            is_queue_session_reservation: true,
            recurrence_group_id: recurrenceGroupId,
            platform_fee: platformFee,
            hourly_rate: court.hourly_rate,
            duration_hours: durationHours,
            total_with_fee: totalAmount,
            intended_payment_method: data.paymentMethod
          },
          notes: `Queue Session (${data.mode}) - ${sessionStart.toLocaleDateString()}${data.paymentMethod === 'cash' ? ' (Cash Payment)' : ''}`,
        })
        .select('id')
        .single()

      if (reservationError || !reservation) {
        console.error('[createQueueSession] ❌ Failed to create reservation:', reservationError)
        return { success: false, error: `Failed to create reservation for ${sessionStart.toLocaleDateString()}` }
      }

      // Create Queue Session
      const { data: session, error: insertError } = await supabase
        .from('queue_sessions')
        .insert({
          court_id: data.courtId,
          organizer_id: user.id,
          start_time: sessionStart.toISOString(),
          end_time: sessionEnd.toISOString(),
          mode: data.mode,
          game_format: data.gameFormat,
          max_players: data.maxPlayers,
          cost_per_game: data.costPerGame,
          is_public: data.isPublic,
          status: 'pending_payment', // Always start with pending payment
          current_players: 0,
          metadata: {
            reservation_id: reservation.id,
            recurrence_group_id: recurrenceGroupId,
            payment_required: totalAmount,
            payment_status: 'pending',
            payment_method: data.paymentMethod || 'e-wallet',
            court_rental: courtRental,
            platform_fee: platformFee
          },
        })
        .select()
        .single()

      if (insertError || !session) {
        console.error('[createQueueSession] ❌ DB Insert Error:', insertError)
        // Rollback reservation
        await supabase.from('reservations').delete().eq('id', reservation.id)
        return { success: false, error: `Failed to create session for ${sessionStart.toLocaleDateString()}: ${insertError?.message || 'Unknown error'}` }
      }

      createdSessions.push({
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
        createdAt: new Date(session.created_at),
        mode: session.mode,
        gameFormat: session.game_format,
        participants: [],
        reservationId: reservation.id,
        paymentStatus: session.metadata?.payment_status || 'pending',
        paymentMethod: data.paymentMethod || 'e-wallet',
        totalCost: totalAmount,
      })
    }

    console.log(`[createQueueSession] ✅ Successfully created ${createdSessions.length} sessions`)

    // Send payment notification to Queue Master
    try {
      const firstSession = createdSessions[0]

      await createNotification({
        userId: user.id,
        type: 'queue_approval_approved',
        title: '💳 Queue Session Payment Required',
        message: `Your queue session${createdSessions.length > 1 ? 's have' : ' has'} been created at ${venue?.name || 'the venue'}. ${data.paymentMethod === 'cash' ? 'Please pay at the venue to activate your session.' : 'Complete payment to activate.'}`,
        actionUrl: `/queue-master/sessions/${firstSession.id}`,
        metadata: {
          court_name: court.name,
          venue_name: venue?.name || 'Unknown Venue',
          session_count: createdSessions.length,
          queue_session_id: firstSession.id,
          total_amount: firstSession.totalCost,
          payment_method: data.paymentMethod || 'e-wallet',
          payment_required: true
        }
      })
      console.log('[createQueueSession] 📬 Sent payment notification to Queue Master')
    } catch (notificationError) {
      // Non-critical error - log but don't fail
      console.error('[createQueueSession] ⚠️ Failed to send notifications (non-critical):', notificationError)
    }

    // 9. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${data.courtId}`)

    // Return the first session as primary, but include all
    return { success: true, session: createdSessions[0], sessions: createdSessions }

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

    // 3. Only allow updates if status is pending_payment or open
    if (!['pending_payment', 'open'].includes(session.status)) {
      return {
        success: false,
        error: 'Cannot update session in current status. Only pending or open sessions can be updated.',
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
      createdAt: new Date(updatedSession.created_at),
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
      .select('organizer_id, status, court_id, metadata, settings')
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

    // 5. Update session status to completed
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({
        status: 'completed',
        settings: {
          ...(session.settings || {}),
          manually_closed: true,
          completed_at: new Date().toISOString(),
          summary,
        },
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('[closeQueueSession] ❌ Failed to complete session:', updateError)
      return { success: false, error: 'Failed to complete queue session' }
    }

    console.log('[closeQueueSession] ✅ Queue session completed successfully:', summary)

    // 5b. Also complete the linked reservation (belt-and-suspenders with DB trigger)
    const linkedReservationId = session.metadata?.reservation_id
    if (linkedReservationId) {
      const { error: resError } = await supabase
        .from('reservations')
        .update({
          status: 'completed',
          metadata: {
            auto_completed: {
              at: new Date().toISOString(),
              by: 'queue_master',
              reason: 'queue_session_closed',
              queue_session_id: sessionId,
            },
          },
        })
        .eq('id', linkedReservationId)
        .in('status', ['confirmed', 'ongoing'])

      if (resError) {
        console.error('[closeQueueSession] ⚠️ Failed to complete linked reservation:', resError)
      } else {
        console.log('[closeQueueSession] ✅ Linked reservation completed:', linkedReservationId)
        revalidatePath('/court-admin/reservations')
      }
    }

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
      .select('organizer_id, status, court_id, current_players, metadata')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' }
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 3. Only allow cancellation if status is pending_payment or open with no players
    if (!['pending_payment', 'open'].includes(session.status)) {
      return { success: false, error: 'Can only cancel pending or open sessions' }
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
          ...(session.metadata || {}),
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

    // 2. Get participant details
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select('*')
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      return { success: false, error: 'Participant not found' }
    }

    // 3. Get queue session details separately to verify organizer
    const { data: queueSession, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('id, organizer_id, court_id')
      .eq('id', participant.queue_session_id)
      .single()

    if (sessionError || !queueSession) {
      return { success: false, error: 'Queue session not found' }
    }

    // 4. Verify user is session organizer
    if (queueSession.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 5. Update participant to waive fee using service client (bypasses RLS for admin operation)
    const serviceClient = createServiceClient()
    const { error: updateError } = await serviceClient
      .from('queue_participants')
      .update({
        amount_owed: 0,
        payment_status: 'paid',
        metadata: {
          ...(participant.metadata || {}),
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

    // 6. Revalidate paths
    revalidatePath('/queue')
    revalidatePath('/queue-master')
    revalidatePath(`/queue/${queueSession.court_id}`)

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

    // 2. Get participant details
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select('*')
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      console.error('[markAsPaid] ❌ Participant not found:', {
        participantId,
        error: participantError,
        message: participantError?.message,
        details: participantError?.details,
        hint: participantError?.hint,
      })
      return { success: false, error: participantError?.message || 'Participant not found' }
    }

    console.log('[markAsPaid] 📦 Participant found:', {
      participantId: participant.id,
      sessionId: participant.queue_session_id,
      currentStatus: participant.payment_status,
      amountOwed: participant.amount_owed,
    })

    // 3. Get queue session details separately to verify organizer
    const { data: queueSession, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('id, organizer_id, court_id')
      .eq('id', participant.queue_session_id)
      .single()

    if (sessionError || !queueSession) {
      console.error('[markAsPaid] ❌ Queue session not found:', sessionError)
      return { success: false, error: 'Queue session not found' }
    }

    console.log('[markAsPaid] 🔍 Session data:', {
      sessionId: queueSession.id,
      organizerId: queueSession.organizer_id,
      currentUserId: user.id,
    })

    // 4. Verify user is session organizer (Queue Master)
    if (queueSession.organizer_id !== user.id) {
      console.error('[markAsPaid] ❌ Unauthorized: Not session organizer')
      return { success: false, error: 'Unauthorized: Not session organizer' }
    }

    // 5. Check if already paid
    if (participant.payment_status === 'paid') {
      console.log('[markAsPaid] ℹ️ Participant already marked as paid')
      return { success: true } // Idempotent - already paid is success
    }

    // 6. Update participant to mark as paid using service client (bypasses RLS for admin operation)
    const serviceClient = createServiceClient()
    const { error: updateError } = await serviceClient
      .from('queue_participants')
      .update({
        payment_status: 'paid',
        metadata: {
          ...(participant.metadata || {}),
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

    // 7. Revalidate paths for immediate UI update
    revalidatePath('/queue-master')
    revalidatePath(`/queue-master/sessions/${queueSession.id}`)
    revalidatePath(`/queue/${queueSession.court_id}`)

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
  status?: 'active' | 'pending' | 'past'
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
      // Active: all paid sessions (open, active) — ready to go
      query = query.in('status', ['active', 'open'])
    } else if (filter?.status === 'pending') {
      // Pending: sessions awaiting payment (needs action)
      query = query.in('status', ['pending_payment'])
    } else if (filter?.status === 'past') {
      query = query.in('status', ['completed', 'cancelled'])
    }

    query = query.order('created_at', { ascending: false })

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) {
      console.error('[getMyQueueMasterSessions] ❌ Failed to fetch sessions:', sessionsError)
      return { success: false, error: 'Failed to fetch sessions' }
    }

    // Auto-activate, auto-close, and filter sessions based on time
    const now = await getServerNow()
    const validSessions: any[] = []
    for (const session of sessions) {
      const startTime = new Date(session.start_time)
      const endTime = new Date(session.end_time)

      // AUTO-CLOSE: If past end_time, complete the session
      if (['open', 'active'].includes(session.status) && endTime < now) {
        console.log('[getMyQueueMasterSessions] 🕒 Session expired, auto-completing:', session.id)
        const { error } = await supabase.from('queue_sessions')
          .update({ status: 'completed', updated_at: now.toISOString() })
          .eq('id', session.id)
        if (error) {
          console.error('Failed to auto-complete expired session:', session.id, error)
        } else {
          session.status = 'completed'
        }
        // Exclude from active/pending views
        if (filter?.status === 'active' || filter?.status === 'pending') {
          continue
        }
        validSessions.push(session)
        continue
      }

      // AUTO-ACTIVATE: If session is 'open' and start_time has passed, flip to 'active'
      if (session.status === 'open' && startTime <= now && endTime > now) {
        console.log('[getMyQueueMasterSessions] ▶️ Auto-activating session (start_time reached):', session.id)
        const { error } = await supabase.from('queue_sessions')
          .update({ status: 'active', updated_at: now.toISOString() })
          .eq('id', session.id)
        if (!error) {
          session.status = 'active'
        }
      }

      validSessions.push(session)
    }

    // 3. Get participant data for each session
    const sessionsWithParticipants = await Promise.all(
      (validSessions || []).map(async (session: any) => {
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

        // Status corrections are already handled above in the for-loop

        return {
          id: session.id,
          courtId: session.court_id,
          courtName: session.courts?.name || 'Unknown Court',
          venueName: session.courts?.venues?.name || 'Unknown Venue',
          venueId: session.courts?.venues?.id || '',
          status: session.status,
          approvalStatus: session.approval_status,
          currentPlayers: formattedParticipants.length,
          maxPlayers: session.max_players || 12,
          costPerGame: parseFloat(session.cost_per_game || '0'),
          startTime: new Date(session.start_time),
          endTime: new Date(session.end_time),
          createdAt: new Date(session.created_at),
          mode: session.mode,
          gameFormat: session.game_format,
          participants: formattedParticipants,
          totalCost: session.metadata?.payment_required ? parseFloat(session.metadata.payment_required) : 0,
          paymentStatus: session.metadata?.payment_status || 'pending',
          paymentMethod: session.metadata?.payment_method || 'e-wallet',
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
/**
 * Get aggregated stats for Queue Master dashboard
 */
export async function getQueueMasterStats(): Promise<{
  success: boolean
  stats?: {
    totalSessions: number
    totalRevenue: number
    averagePlayers: number
    activeSessions: number
    counts: {
      active: number
      pending: number
      past: number
    }
  }
  error?: string
}> {
  console.log('[getQueueMasterStats] 📊 Fetching queue master stats')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get all sessions for this organizer
    const { data: sessions, error } = await supabase
      .from('queue_sessions')
      .select(`
        id,
        status,
        start_time,
        end_time,
        current_players,
        cost_per_game,
        queue_participants (
          amount_owed
        )
      `)
      .eq('organizer_id', user.id)
    // Remove .neq('status', 'draft') so we count drafts in 'upcoming' or similar if desired
    // But maybe we want to keep them hidden from stats?
    // Dashboard usually shows drafts in upcoming or active.
    // Let's remove the draft filter to be inclusive.

    if (error) {
      console.error('[getQueueMasterStats] ❌ Failed to fetch stats:', error)
      return { success: false, error: 'Failed to fetch stats' }
    }

    const now = await getServerNow()
    const totalSessions = sessions?.length || 0

    // Categorize sessions
    let activeCount = 0
    let pendingCount = 0
    let pastCount = 0

    let totalRevenue = 0
    let totalPlayers = 0
    let evaluatedSessions = 0

    sessions?.forEach(session => {
      const startTime = new Date(session.start_time)
      const endTime = session.end_time ? new Date(session.end_time) : null
      const isExpired = endTime && endTime < now && ['open', 'active'].includes(session.status)

      // Auto-complete if expired (fire and forget)
      if (isExpired) {
        supabase.from('queue_sessions').update({ status: 'completed' }).eq('id', session.id).then(({ error }) => {
          if (error) console.error('Failed to auto-complete expired session:', session.id, error)
        })
      }

      // Auto-activate: open sessions whose start_time has passed (fire and forget)
      if (!isExpired && session.status === 'open' && startTime <= now) {
        supabase.from('queue_sessions').update({ status: 'active' }).eq('id', session.id).then(({ error }) => {
          if (error) console.error('Failed to auto-activate session:', session.id, error)
        })
        session.status = 'active' // Use corrected status for counting
      }

      // Count logic matching Dashboard filters
      const effectiveStatus = isExpired ? 'completed' : session.status

      if (['completed', 'cancelled'].includes(effectiveStatus)) {
        pastCount++
      } else if (['active', 'open'].includes(effectiveStatus)) {
        activeCount++
      } else if (['pending_payment'].includes(effectiveStatus)) {
        pendingCount++
      }

      // Stats calculation
      const sessionRevenue = session.queue_participants?.reduce((sum: number, p: any) => sum + (p.amount_owed || 0), 0) || 0
      totalRevenue += sessionRevenue

      if (['active', 'open', 'completed'].includes(effectiveStatus)) {
        totalPlayers += session.queue_participants?.length || 0
        evaluatedSessions++
      }
    })

    const averagePlayers = evaluatedSessions > 0 ? Math.round(totalPlayers / evaluatedSessions) : 0

    return {
      success: true,
      stats: {
        totalSessions,
        totalRevenue,
        averagePlayers,
        activeSessions: activeCount, // Backward compatibility
        counts: {
          active: activeCount,
          pending: pendingCount,
          past: pastCount
        }
      }
    }
  } catch (error: any) {
    console.error('[getQueueMasterStats] ❌ Error:', error)
    return { success: false, error: error.message || 'Failed to fetch stats' }
  }
}

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
