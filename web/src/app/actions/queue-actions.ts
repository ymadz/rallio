'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { checkRateLimit, createRateLimitConfig } from '@/lib/rate-limiter';
import {
  createBulkNotifications,
  createNotification,
  NotificationTemplates,
} from '@/lib/notifications';
import { getServerNow } from '@/lib/time-server';
import { calculateApplicableDiscounts } from '@/app/actions/discount-actions';
import { requestRefundAction } from './refund-actions';
import { differenceInMinutes, addMinutes } from 'date-fns';

/**
 * Queue Management Server Actions
 * Handles queue session operations for the queue system
 */

export interface QueueSessionData {
  id: string;
  courtId: string;
  courtName: string;
  venueName: string;
  venueId: string;
  status: 'pending_payment' | 'open' | 'active' | 'paused' | 'completed' | 'cancelled';
  currentPlayers: number;
  maxPlayers: number;
  costPerGame: number;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  mode: 'casual' | 'competitive';
  gameFormat: 'singles' | 'doubles' | 'mixed';
  joinWindowHours?: number | null;
  minSkillLevel?: number | null;
  maxSkillLevel?: number | null;
  reservationId?: string;
  totalCost?: number;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentMethod?: 'cash' | 'e-wallet';
  participants?: QueueParticipantData[];
  sessionSummary?: {
    totalGames: number;
    totalRevenue: number;
    totalParticipants: number;
    unpaidBalances: number;
    completedAt?: string;
  };
  matchOutcomes?: Array<{
    matchNumber: number;
    winnerNames: string[];
    loserNames: string[];
    score: string;
    completedAt?: string;
    result: 'team_a' | 'team_b' | 'draw';
  }>;
}

export interface QueueParticipantData {
  id: string;
  userId: string;
  playerName: string;
  avatarUrl?: string;
  skillLevel: number;
  rating?: number;
  position: number;
  joinedAt: Date;
  gamesPlayed: number;
  gamesWon: number;
  status: 'waiting' | 'playing' | 'completed' | 'left';
  amountOwed: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
}

/**
 * Fetch queue session details by court ID
 */
export async function getQueueDetails(courtId: string) {
  console.log('[getQueueDetails] 🔍 Fetching queue for court:', courtId);

  try {
    const supabase = await createClient();
    const adminDb = createServiceClient();

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[getQueueDetails] ❌ User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // Resolve by queue session ID first (for legacy links/notifications),
    // then fall back to the latest session by court ID.
    const baseSessionSelect = `
      *,
      courts (
        name,
        venues (
          id,
          name
        )
      ),
      queue_session_courts (
        court_id,
        courts (
          name
        )
      )
    `;

    let resolvedBySessionId = false;

    let { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select(baseSessionSelect)
      .eq('id', courtId)
      .maybeSingle();

    if (session) {
      resolvedBySessionId = true;
    }

    if (!session && !sessionError) {
      const fallback = await supabase
        .from('queue_sessions')
        .select(baseSessionSelect)
        .eq('court_id', courtId)
        .in('status', ['pending_payment', 'open', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      session = fallback.data as any;
      sessionError = fallback.error;
    }

    if (sessionError) {
      console.error('[getQueueDetails] ❌ Database error:', sessionError);
      return { success: false, error: `Database error: ${sessionError.message}` };
    }

    if (!session) {
      console.log('[getQueueDetails] ℹ️ No active queue found for court');
      return { success: true, queue: null };
    }

    const isOrganizer = session.organizer_id === user.id;

    // SAFETY: ensure linked reservation is fully paid/confirmed before exposing to players.
    const linkedReservationId = session.metadata?.reservation_id;
    if (!isOrganizer && !linkedReservationId) {
      console.log(
        '[getQueueDetails] 🔒 Queue hidden: missing linked reservation metadata for non-organizer',
        {
          sessionId: session.id,
        }
      );
      return { success: true, queue: null };
    }

    if (linkedReservationId) {
      const { data: linkedReservation } = await adminDb
        .from('reservations')
        .select('status, total_amount, amount_paid')
        .eq('id', linkedReservationId)
        .single();

      const hasPaidInFull =
        !!linkedReservation &&
        ['confirmed', 'ongoing', 'completed'].includes(linkedReservation.status) &&
        Number(linkedReservation.amount_paid || 0) + 0.01 >=
          Number(linkedReservation.total_amount || 0);

      if (!isOrganizer && !hasPaidInFull) {
        console.log('[getQueueDetails] 🔒 Queue hidden: linked reservation not fully paid yet', {
          sessionId: session.id,
          reservationStatus: linkedReservation?.status,
          amountPaid: linkedReservation?.amount_paid,
          totalAmount: linkedReservation?.total_amount,
        });
        return { success: true, queue: null };
      }
    }

    // PRIVATE QUEUE AUTHORIZATION: Defense-in-depth check.
    // RLS (migration 042) already enforces this at the DB level, but we verify
    // explicitly to protect against misconfiguration or future service-client refactors.
    if (!session.is_public) {
      if (!isOrganizer) {
        const { count: participantCount } = await supabase
          .from('queue_participants')
          .select('*', { count: 'exact', head: true })
          .eq('queue_session_id', session.id)
          .eq('user_id', user.id)
          .neq('status', 'left');
        if (!participantCount || participantCount === 0) {
          console.log('[getQueueDetails] 🔒 Access denied to private queue:', session.id);
          return { success: true, queue: null };
        }
      }
    }

    // AUTO-CLOSE CHECK: If session is past end_time, close it automatically
    const now = await getServerNow();
    if (new Date(session.end_time) < now) {
      console.log('[getQueueDetails] 🕒 Session expired, auto-closing:', session.id);

      // Update DB to close the session
      const { error: closeError } = await supabase
        .from('queue_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);

      if (closeError) {
        console.error('[getQueueDetails] ❌ Failed to auto-close session:', closeError);
      } else {
        // Revalidate to ensure UI updates immediately
        revalidatePath(`/queue/${session.court_id}`);
        revalidatePath('/queue');
      }

      // If this page is tied to a specific session ID, keep the session visible
      // so the UI can render post-session summary instead of a not-found state.
      if (!resolvedBySessionId) {
        return { success: true, queue: null };
      }

      session.status = 'completed';
    }

    // Call centralized status auto-advancement to handle upcoming->open->active->completed
    await supabase.rpc('auto_advance_session_statuses');

    // Since we potentially advanced the status, double check if it's still active/open
    // (If it was auto-completed, it will be refetched correctly or missed by the query)
    const { data: updatedSession } = await supabase
      .from('queue_sessions')
      .select('status')
      .eq('id', session.id)
      .single();

    if (updatedSession?.status === 'completed' || updatedSession?.status === 'cancelled') {
      console.log('[getQueueDetails] 🕒 Session was auto-completed by RPC');

      if (!resolvedBySessionId) {
        return { success: true, queue: null };
      }
    }

    // Update local object to match potential new status (e.g. open -> active)
    if (updatedSession) {
      session.status = updatedSession.status;
    }
    const { data: participants, error: participantsError } = await supabase
      .from('queue_participants')
      .select(
        `
        *,
        user:user_id!inner (
          id,
          display_name,
          first_name,
          last_name,
          avatar_url
        )
      `
      )
      .eq('queue_session_id', session.id)
      .is('left_at', null)
      .order('joined_at', { ascending: true });

    if (participantsError) {
      console.error('[getQueueDetails] ❌ Failed to fetch participants:', participantsError);
      return { success: false, error: 'Failed to fetch participants' };
    }

    // Get player skill levels & ratings separately (since we can't nested join)
    const playerIds = participants?.map((p: any) => p.user_id) || [];
    const { data: players } = await supabase
      .from('players')
      .select('user_id, skill_level, rating')
      .in('user_id', playerIds);

    const playerSkillMap = new Map(players?.map((p: any) => [p.user_id, p.skill_level]) || []);
    const playerRatingMap = new Map(players?.map((p: any) => [p.user_id, p.rating]) || []);
    const participantNameMap = new Map(
      (participants || []).map((p: any) => [
        p.user_id,
        p.user?.display_name ||
          `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() ||
          'Unknown Player',
      ])
    );

    // Calculate positions and user position
    const formattedParticipants: QueueParticipantData[] = (participants || []).map(
      (p: any, index: number) => ({
        id: p.id,
        userId: p.user_id,
        playerName:
          p.user?.display_name ||
          `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() ||
          'Unknown Player',
        avatarUrl: p.user?.avatar_url,
        skillLevel: playerSkillMap.get(p.user_id) || 5,
        rating: playerRatingMap.get(p.user_id),
        position: index + 1,
        joinedAt: new Date(p.joined_at),
        gamesPlayed: p.games_played || 0,
        gamesWon: p.games_won || 0,
        status: p.status,
        amountOwed: parseFloat(p.amount_owed || '0'),
        paymentStatus: p.payment_status,
      })
    );

    const userParticipant = formattedParticipants.find((p) => p.userId === user.id);
    const userPosition = userParticipant ? userParticipant.position : null;

    // Fetch organizer display name
    let organizerName = 'Unknown Host';
    if (session.organizer_id) {
      const { data: orgProfile } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('id', session.organizer_id)
        .single();
      if (orgProfile) {
        organizerName =
          orgProfile.display_name ||
          `${orgProfile.first_name || ''} ${orgProfile.last_name || ''}`.trim() ||
          'Unknown Host';
      }
    }

    // For completed sessions, include per-match winner/loser summary.
    let matchOutcomes: QueueSessionData['matchOutcomes'] = undefined;
    if (session.status === 'completed' || session.status === 'cancelled') {
      const { data: sessionMatches } = await supabase
        .from('matches')
        .select(
          'match_number, team_a_players, team_b_players, score_a, score_b, winner, completed_at, created_at'
        )
        .eq('queue_session_id', session.id)
        .in('status', ['completed', 'in_progress'])
        .order('match_number', { ascending: true });

      const allMatchPlayerIds = Array.from(
        new Set(
          (sessionMatches || []).flatMap((m: any) => [
            ...(m.team_a_players || []),
            ...(m.team_b_players || []),
          ])
        )
      ) as string[];

      const missingProfileIds = allMatchPlayerIds.filter(
        (id: string) => !participantNameMap.has(id)
      );
      if (missingProfileIds.length > 0) {
        const { data: missingProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, first_name, last_name')
          .in('id', missingProfileIds);

        for (const profile of missingProfiles || []) {
          participantNameMap.set(
            profile.id,
            profile.display_name ||
              `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
              'Unknown Player'
          );
        }
      }

      matchOutcomes = (sessionMatches || []).map((m: any) => {
        const teamANames = (m.team_a_players || []).map(
          (id: string) => participantNameMap.get(id) || 'Unknown Player'
        );
        const teamBNames = (m.team_b_players || []).map(
          (id: string) => participantNameMap.get(id) || 'Unknown Player'
        );

        const winner =
          m.winner === 'team_a' || m.winner === 'team_b' || m.winner === 'draw' ? m.winner : 'draw';

        const winnerNames =
          winner === 'team_a' ? teamANames : winner === 'team_b' ? teamBNames : [];
        const loserNames = winner === 'team_a' ? teamBNames : winner === 'team_b' ? teamANames : [];

        return {
          matchNumber: Number(m.match_number || 0),
          winnerNames,
          loserNames,
          score: `${m.score_a ?? 0} - ${m.score_b ?? 0}`,
          completedAt: m.completed_at || m.created_at || undefined,
          result: winner,
        };
      });
    }

    const queueData: QueueSessionData & {
      players: QueueParticipantData[];
      userPosition: number | null;
      organizerId: string;
      organizerName: string;
    } = {
      id: session.id,
      courtId: session.court_id,
      courtName:
        session.queue_session_courts?.length > 0
          ? session.queue_session_courts
              .map((qsc: any) => qsc.courts?.name)
              .filter(Boolean)
              .join(', ')
          : session.metadata?.courts?.map((c: any) => c.name).join(', ') ||
            session.courts?.name ||
            'Unknown Court',
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
      joinWindowHours: session.join_window_hours ?? null,
      players: formattedParticipants,
      userPosition,
      organizerId: session.organizer_id,
      organizerName,
      minSkillLevel: session.min_skill_level,
      maxSkillLevel: session.max_skill_level,
      sessionSummary: session.settings?.summary
        ? {
            totalGames: Number(session.settings.summary.totalGames || 0),
            totalRevenue: Number(session.settings.summary.totalRevenue || 0),
            totalParticipants: Number(session.settings.summary.totalParticipants || 0),
            unpaidBalances: Number(session.settings.summary.unpaidBalances || 0),
            completedAt: session.settings?.completed_at || undefined,
          }
        : undefined,
      matchOutcomes,
    };

    console.log('[getQueueDetails] ✅ Queue fetched successfully:', {
      sessionId: queueData.id,
      playerCount: queueData.players.length,
      userPosition,
    });

    return { success: true, queue: queueData };
  } catch (error: any) {
    console.error('[getQueueDetails] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to fetch queue' };
  }
}

/**
 * Join a queue session
 */
export async function joinQueue(sessionId: string) {
  console.log('[joinQueue] 🚀 Joining queue session:', sessionId);

  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[joinQueue] ❌ User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('JOIN_QUEUE', user.id));
    if (!rateLimitResult.allowed) {
      console.warn('[joinQueue] ⚠️ Rate limit exceeded for user:', user.id);
      return {
        success: false,
        error: `Too many join attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      };
    }

    // Check if session exists and is joinable
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('*, courts(id)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[joinQueue] ❌ Session not found:', sessionError);
      return { success: false, error: 'Queue session not found' };
    }

    if (!['open', 'active'].includes(session.status)) {
      return { success: false, error: 'Queue is not accepting new players' };
    }

    // Call the centralized RPC function
    const { data: rpcResult, error: rpcError } = await supabase.rpc('join_queue', {
      p_session_id: sessionId,
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error('[joinQueue] ❌ RPC Error:', rpcError);
      return { success: false, error: 'Failed to join queue' };
    }

    if (!rpcResult.success) {
      console.warn('[joinQueue] ⚠️ Join rejected by RPC:', rpcResult.error);
      return { success: false, error: rpcResult.error };
    }

    console.log('[joinQueue] ✅ Successfully joined/rejoined queue via RPC:', rpcResult.action);

    // Revalidate queue pages
    revalidatePath(`/queue/${session.courts.id}`);
    revalidatePath('/queue');

    return {
      success: true,
      participant: { id: rpcResult.participant_id }, // Return minimal info needed
    };
  } catch (error: any) {
    console.error('[joinQueue] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to join queue' };
  }
}

/**
 * Leave a queue session
 */
export async function leaveQueue(sessionId: string) {
  console.log('[leaveQueue] 🚪 Leaving queue session:', sessionId);

  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[leaveQueue] ❌ User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('LEAVE_QUEUE', user.id));
    if (!rateLimitResult.allowed) {
      console.warn('[leaveQueue] ⚠️ Rate limit exceeded for user:', user.id);
      return {
        success: false,
        error: `Too many leave attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      };
    }

    // Get participant record
    const { data: participant, error: fetchError } = await supabase
      .from('queue_participants')
      .select('*, queue_sessions(courts(id))')
      .eq('queue_session_id', sessionId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .single();

    if (fetchError || !participant) {
      console.error('[leaveQueue] ❌ Not in queue:', fetchError);
      return { success: false, error: 'Not in queue' };
    }

    // Check if user owes money
    const gamesPlayed = participant.games_played || 0;
    const amountOwed = parseFloat(participant.amount_owed || '0');

    if (gamesPlayed > 0 && amountOwed > 0 && participant.payment_status !== 'paid') {
      console.log('[leaveQueue] ⚠️ User owes payment:', { gamesPlayed, amountOwed });
      return {
        success: false,
        error: 'Payment required',
        requiresPayment: true,
        amountOwed,
        gamesPlayed,
      };
    }

    // Mark as left.
    // NOTE: The DB trigger update_queue_count (migration 009) fires on this UPDATE
    // and decrements current_players automatically. Do NOT call decrement_queue_players
    // RPC here — that would cause a double-decrement.
    const now = await getServerNow();
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({
        left_at: now.toISOString(),
        status: 'left',
      })
      .eq('id', participant.id);

    if (updateError) {
      console.error('[leaveQueue] ❌ Failed to leave queue:', updateError);
      return { success: false, error: 'Failed to leave queue' };
    }

    console.log('[leaveQueue] ✅ Successfully left queue');

    // Revalidate queue pages
    const courtId = participant.queue_sessions?.courts?.id;
    if (courtId) {
      revalidatePath(`/queue/${courtId}`);
    }
    revalidatePath('/queue');

    return { success: true };
  } catch (error: any) {
    console.error('[leaveQueue] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to leave queue' };
  }
}

/**
 * Get all queue sessions where user is a participant
 */
export async function getMyQueues() {
  console.log('[getMyQueues] 🔍 Fetching user queues');

  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[getMyQueues] ❌ User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // Get all active queue participations
    const { data: participations, error: participationsError } = await supabase
      .from('queue_participants')
      .select(
        `
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
      `
      )
      .eq('user_id', user.id)
      .is('left_at', null)
      .in('queue_sessions.status', ['open', 'active', 'pending_payment'])
      .gt('queue_sessions.end_time', (await getServerNow()).toISOString()) // Filter out expired sessions
      .order('joined_at', { ascending: false });

    if (participationsError) {
      console.error('[getMyQueues] ❌ Failed to fetch queues:', participationsError);
      return { success: false, error: 'Failed to fetch queues' };
    }

    const queues = await Promise.all(
      (participations || []).map(async (p: any) => {
        // Get participant count for this session
        const { count } = await supabase
          .from('queue_participants')
          .select('*', { count: 'exact', head: true })
          .eq('queue_session_id', p.queue_session_id)
          .is('left_at', null);

        // Get user's position
        const { data: earlierParticipants } = await supabase
          .from('queue_participants')
          .select('id')
          .eq('queue_session_id', p.queue_session_id)
          .is('left_at', null)
          .lt('joined_at', p.joined_at);

        const position = (earlierParticipants?.length || 0) + 1;

        // Get organizer display name
        let organizerName = 'Unknown Host';
        if (p.queue_sessions.organizer_id) {
          const { data: orgProfile } = await supabase
            .from('profiles')
            .select('display_name, first_name, last_name')
            .eq('id', p.queue_sessions.organizer_id)
            .single();
          if (orgProfile) {
            organizerName =
              orgProfile.display_name ||
              `${orgProfile.first_name || ''} ${orgProfile.last_name || ''}`.trim() ||
              'Unknown Host';
          }
        }

        return {
          id: p.queue_session_id,
          courtId: p.queue_sessions.court_id,
          courtName: p.queue_sessions.courts?.name || 'Unknown Court',
          venueName: p.queue_sessions.courts?.venues?.name || 'Unknown Venue',
          venueId: p.queue_sessions.courts?.venues?.id || '',
          status: p.queue_sessions.status,
          players: [],
          userPosition: position,
          maxPlayers: p.queue_sessions.max_players,
          currentPlayers: count || 0,
          userGamesPlayed: p.games_played || 0,
          userAmountOwed: parseFloat(p.amount_owed || '0'),
          startTime: new Date(p.queue_sessions.start_time),
          endTime: new Date(p.queue_sessions.end_time),
          mode: p.queue_sessions.mode || 'casual',
          costPerGame: parseFloat(p.queue_sessions.cost_per_game || '0'),
          organizerName,
          minSkillLevel: p.queue_sessions.min_skill_level,
          maxSkillLevel: p.queue_sessions.max_skill_level,
        };
      })
    );

    console.log('[getMyQueues] ✅ Fetched queues:', queues.length);

    return { success: true, queues };
  } catch (error: any) {
    console.error('[getMyQueues] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to fetch queues' };
  }
}

/**
 * Get user's queue history (past sessions)
 */
export async function getMyQueueHistory() {
  console.log('[getMyQueueHistory] 🔍 Fetching queue history');

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get all past queue participations
    // We consider it "history" if:
    // 1. Session is closed/cancelled OR
    // 2. Session is past end_time OR
    // 3. User has 'left' status
    const { data: participations, error: participationsError } = await supabase
      .from('queue_participants')
      .select(
        `
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
      `
      )
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(50); // Limit to last 50 for now

    if (participationsError) {
      console.error('[getMyQueueHistory] ❌ Failed to fetch history:', participationsError);
      return { success: false, error: 'Failed to fetch history' };
    }

    const serverNow = await getServerNow();

    const history = (participations || [])
      .filter((p: any) => {
        const isLeft = p.status === 'left';
        const isSessionClosed = ['completed', 'cancelled'].includes(p.queue_sessions?.status);
        const isSessionEnded = new Date(p.queue_sessions?.end_time) < serverNow;
        return isLeft || isSessionClosed || isSessionEnded;
      })
      .map((p: any) => {
        const costPerGame = parseFloat(p.queue_sessions.cost_per_game || '0');
        const gamesPlayed = p.games_played || 0;
        const totalCost = costPerGame * gamesPlayed;

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
        };
      });

    console.log('[getMyQueueHistory] ✅ Fetched history items:', history.length);

    return { success: true, history };
  } catch (error: any) {
    console.error('[getMyQueueHistory] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to fetch queue history' };
  }
}

/**
 * Get nearby active queue sessions
 */
export async function getNearbyQueues(latitude?: number, longitude?: number) {
  console.log('[getNearbyQueues] 🔍 Fetching nearby queues');

  try {
    const supabase = await createClient();
    const adminDb = createServiceClient();

    // Get active queue sessions - ONLY approved sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('queue_sessions')
      .select(
        `
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
        ),
        queue_session_courts (
          court_id,
          courts (
            name
          )
        )
      `
      )
      .in('status', ['open', 'active'])
      .eq('is_public', true)
      .gt('end_time', (await getServerNow()).toISOString()) // Filter out expired sessions
      .order('start_time', { ascending: true })
      .limit(20);

    if (sessionsError) {
      console.error('[getNearbyQueues] ❌ Failed to fetch sessions:', sessionsError);
      return { success: false, error: 'Failed to fetch queues' };
    }

    // Fetch actual participant counts and avatar URLs since current_players column can be stale
    const sessionIds = (sessions || []).map((s: any) => s.id);
    let participantCounts: Record<string, number> = {};
    let participantAvatars: Record<string, { avatarUrl: string | null }[]> = {};

    if (sessionIds.length > 0) {
      const { data: participants } = await supabase
        .from('queue_participants')
        .select('queue_session_id, user_id, profiles(avatar_url)')
        .in('queue_session_id', sessionIds)
        .is('left_at', null);

      if (participants) {
        participants.forEach((p: any) => {
          participantCounts[p.queue_session_id] = (participantCounts[p.queue_session_id] || 0) + 1;
          if (!participantAvatars[p.queue_session_id]) {
            participantAvatars[p.queue_session_id] = [];
          }
          participantAvatars[p.queue_session_id].push({
            avatarUrl: p.profiles?.avatar_url || null,
          });
        });
      }
    }

    // Fetch organizer names for all sessions
    const organizerIds = [
      ...new Set((sessions || []).map((s: any) => s.organizer_id).filter(Boolean)),
    ];
    let organizerNames: Record<string, string> = {};
    if (organizerIds.length > 0) {
      const { data: orgProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, last_name')
        .in('id', organizerIds);
      if (orgProfiles) {
        orgProfiles.forEach((p: any) => {
          organizerNames[p.id] =
            p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Host';
        });
      }
    }

    const reservationIds = (sessions || [])
      .map((session: any) => session.metadata?.reservation_id)
      .filter(Boolean);

    const fullyPaidReservationIds = new Set<string>();
    if (reservationIds.length > 0) {
      const { data: reservations } = await adminDb
        .from('reservations')
        .select('id, status, total_amount, amount_paid')
        .in('id', reservationIds);

      (reservations || []).forEach((reservation: any) => {
        const hasPaidInFull =
          ['confirmed', 'ongoing', 'completed'].includes(reservation.status) &&
          Number(reservation.amount_paid || 0) + 0.01 >= Number(reservation.total_amount || 0);

        if (hasPaidInFull) {
          fullyPaidReservationIds.add(reservation.id);
        }
      });
    }

    const queues = (sessions || [])
      .filter((session: any) => {
        const reservationId = session.metadata?.reservation_id;
        // Player discovery should only show sessions with a linked, fully-paid reservation.
        if (!reservationId) {
          console.log('[getNearbyQueues] 🔒 Hidden session without reservation link:', session.id);
          return false;
        }

        const isFullyPaid = fullyPaidReservationIds.has(reservationId);
        if (!isFullyPaid) {
          console.log('[getNearbyQueues] 🔒 Hidden unpaid session:', {
            sessionId: session.id,
            reservationId,
            queueStatus: session.status,
          });
        }

        return isFullyPaid;
      })
      .map((session: any) => {
        // Use actual participant count, falling back to current_players column
        const currentPlayers = participantCounts[session.id] || session.current_players || 0;

        return {
          id: session.id,
          courtId: session.court_id,
          courtName:
            session.queue_session_courts?.length > 0
              ? session.queue_session_courts
                  .map((qsc: any) => qsc.courts?.name)
                  .filter(Boolean)
                  .join(', ')
              : session.metadata?.courts?.map((c: any) => c.name).join(', ') ||
                session.courts?.name ||
                'Unknown Court',
          venueName: session.courts?.venues?.name || 'Unknown Venue',
          venueId: session.courts?.venues?.id || '',
          status: session.status,
          players: (participantAvatars[session.id] || []).map((p: any) => ({
            avatarUrl: p.avatarUrl,
          })),
          userPosition: null,
          maxPlayers: session.max_players,
          currentPlayers,
          startTime: new Date(session.start_time),
          endTime: new Date(session.end_time),
          mode: session.mode || 'casual',
          costPerGame: parseFloat(session.cost_per_game || '0'),
          organizerName: organizerNames[session.organizer_id] || 'Unknown Host',
          minSkillLevel: session.min_skill_level,
          maxSkillLevel: session.max_skill_level,
        };
      });

    console.log('[getNearbyQueues] ✅ Fetched queues:', queues.length);

    return { success: true, queues };
  } catch (error: any) {
    console.error('[getNearbyQueues] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to fetch nearby queues' };
  }
}

/**
 * Calculate amount owed by a participant
 */
export async function calculateQueuePayment(sessionId: string) {
  console.log('[calculateQueuePayment] 💰 Calculating payment');

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get participant and session details
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select(
        `
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
      `
      )
      .eq('queue_session_id', sessionId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .single();

    if (participantError || !participant) {
      return { success: false, error: 'Participant not found' };
    }

    const costPerGame = parseFloat(participant.queue_sessions.cost_per_game || '0');
    const gamesPlayed = participant.games_played || 0;
    // Use stored amount_owed so QM-applied waivers are respected (honours QM fee waivers)
    const totalOwed = parseFloat(participant.amount_owed || '0');
    const amountPaid = participant.payment_status === 'paid' ? totalOwed : 0;

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
    };
  } catch (error: any) {
    console.error('[calculateQueuePayment] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to calculate payment' };
  }
}

/**
 * Get queue session history for Queue Master (sessions they organized)
 */
export async function getQueueMasterHistory() {
  console.log('[getQueueMasterHistory] 🔍 Fetching queue master history');

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Fetch sessions organized by user that are completed or cancelled
    // Also include expired sessions that might still be marked active/open if cron failed (fallback)
    const { data: sessions, error } = await supabase
      .from('queue_sessions')
      .select(
        `
        *,
        courts (
          name,
          venues (
            name
          )
        ),
        queue_session_courts (
          court_id,
          courts (
            name
          )
        )
      `
      )
      .eq('organizer_id', user.id)
      .or(`status.in.(completed,cancelled),end_time.lt.${(await getServerNow()).toISOString()}`)
      .order('start_time', { ascending: false });

    if (error) throw error;

    // Format for display
    const history =
      sessions?.map((session) => ({
        id: session.id,
        courtName:
          session.queue_session_courts?.length > 0
            ? session.queue_session_courts
                .map((qsc: any) => qsc.courts?.name)
                .filter(Boolean)
                .join(', ')
            : session.metadata?.courts?.map((c: any) => c.name).join(', ') ||
              session.courts?.name ||
              'Unknown Court',
        venueName: session.courts?.venues?.name || 'Unknown Venue',
        status: session.status,
        startTime: new Date(session.start_time),
        endTime: new Date(session.end_time),
        maxPlayers: session.max_players,
        costPerGame: session.cost_per_game,
        totalRevenue: session.settings?.summary?.totalRevenue || 0,
        totalGames: session.settings?.summary?.totalGames || 0,
        closedBy: session.settings?.summary?.closedBy || 'unknown',
      })) || [];

    return { success: true, history };
  } catch (error: any) {
    console.error('[getQueueMasterHistory] ❌ Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ========================================
 * QUEUE MASTER MANAGEMENT ACTIONS
 * ========================================
 * These actions are for Queue Masters to create and manage queue sessions
 */

export interface CreateQueueSessionParams {
  courts: { id: string; name: string }[]; // Changed to support multiple courts
  startTime: Date;
  endTime: Date;
  mode: 'casual' | 'competitive';
  gameFormat: 'singles' | 'doubles' | 'any';
  maxPlayers: number;
  costPerGame: number;
  isPublic?: boolean;
  joinWindowHours?: number | null;
  recurrenceWeeks?: number;
  selectedDays?: number[];
  paymentMethod?: 'cash' | 'e-wallet';
  promoCode?: string;
  customDownPaymentAmount?: number;
  minSkillLevel?: number | null;
  maxSkillLevel?: number | null;
}

/**
 * Create a new queue session
 * Queue Master action
 */
export async function createQueueSession(data: CreateQueueSessionParams): Promise<{
  success: boolean;
  session?: QueueSessionData;
  sessions?: QueueSessionData[];
  requiresApproval?: boolean;
  error?: string;
  downPaymentRequired?: boolean;
  downPaymentAmount?: number;
}> {
  console.log('[createQueueSession] 🚀 Creating queue session(s):', data);

  const recurrenceWeeks = data.recurrenceWeeks || 1;
  const createdSessions: QueueSessionData[] = [];

  // Generate a recurrence group ID if applicable
  const recurrenceGroupId =
    recurrenceWeeks > 1 || (data.selectedDays && data.selectedDays.length > 1)
      ? crypto.randomUUID()
      : undefined;

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[createQueueSession] ❌ User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(createRateLimitConfig('CREATE_SESSION', user.id));
    if (!rateLimitResult.allowed) {
      console.warn('[createQueueSession] ⚠️ Rate limit exceeded for user:', user.id);
      return {
        success: false,
        error: `Too many session creation attempts. Please wait ${rateLimitResult.retryAfter} seconds.`,
      };
    }

    // 2. Check user has queue_master role
    const { data: roles } = await supabase
      .from('user_roles')
      .select(
        `
        role_id,
        roles!inner (
          name
        )
      `
      )
      .eq('user_id', user.id);

    const hasQueueMasterRole = roles?.some((r: any) => r.roles?.name === 'queue_master');

    if (!hasQueueMasterRole) {
      console.error('[createQueueSession] ❌ User does not have queue_master role');
      return { success: false, error: 'Unauthorized: Queue Master role required' };
    }

    // 3. Validate inputs (Basic)
    if (new Date(data.endTime).getTime() <= new Date(data.startTime).getTime()) {
      return { success: false, error: 'End time must be after start time' };
    }
    if (data.costPerGame < 0) {
      return { success: false, error: 'Cost per game must be non-negative' };
    }
    if (data.maxPlayers < 4 || data.maxPlayers > 20) {
      return { success: false, error: 'Max players must be between 4 and 20' };
    }

    // 4. Verify courts exist and get venue settings + hourly rate
    if (!data.courts || data.courts.length === 0) {
      return { success: false, error: 'At least one court must be selected' };
    }

    const courtIds = data.courts.map((c) => c.id);
    const { data: dbCourts, error: courtError } = await supabase
      .from('courts')
      .select(
        `
        id,
        name,
        is_active,
        venue_id,
        hourly_rate,
        venues!inner (
          id,
          name,
          requires_queue_approval,
          opening_hours,
          metadata
        )
      `
      )
      .in('id', courtIds);

    if (courtError || !dbCourts || dbCourts.length !== courtIds.length) {
      console.error('[createQueueSession] ❌ Courts not found:', courtError);
      return { success: false, error: 'One or more courts not found' };
    }

    for (const c of dbCourts) {
      if (!c.is_active) {
        return { success: false, error: `Court ${c.name} is not active` };
      }
      if (!c.hourly_rate || c.hourly_rate <= 0) {
        console.error('[createQueueSession] ❌ Court hourly rate not configured. Court ID: ', c.id);
        return {
          success: false,
          error: `Court ${c.name} hourly rate not configured. Please contact venue admin.`,
        };
      }
    }

    // Extract venue from first court data (assuming all are from the same venue)
    const venue = dbCourts[0].venues as any;

    // Simplified: All sessions start as pending_payment regardless of payment method
    // Payment confirmation (e-wallet) or manual marking (cash) moves them to active/open

    // --- LOOP START ---
    // Generate all target dates first
    const targetDates: Date[] = [];

    // Interpret the input strings as Manila time
    // Data passed from checkout-store can be either Date objects or ISO strings
    // Convert to ISO string first if needed, then ensure timezone suffix
    const startTimeStr =
      data.startTime instanceof Date ? data.startTime.toISOString() : data.startTime;
    const endTimeStr = data.endTime instanceof Date ? data.endTime.toISOString() : data.endTime;

    const startStr =
      startTimeStr.endsWith('Z') || startTimeStr.includes('+')
        ? startTimeStr
        : `${startTimeStr}+08:00`;

    const endStr =
      endTimeStr.endsWith('Z') || endTimeStr.includes('+') ? endTimeStr : `${endTimeStr}+08:00`;

    const startObj = new Date(startStr);
    const endObj = new Date(endStr);
    const durationMs = endObj.getTime() - startObj.getTime();

    // Determine the "anchored" days
    // Get the Manila-equivalent representation to correctly find the day of the week
    const manilaStartObj = new Date(startObj.getTime() + 8 * 60 * 60 * 1000);
    const startDayIndex = manilaStartObj.getUTCDay(); // 0-6 (Sun-Sat) in Manila

    const daysToBook =
      data.selectedDays && data.selectedDays.length > 0 ? data.selectedDays : [startDayIndex];

    for (let i = 0; i < recurrenceWeeks; i++) {
      for (const dayIndex of daysToBook) {
        const dayOffset = (dayIndex - startDayIndex + 7) % 7;

        // Use precise ms offsets rather than error-prone local Date methods
        const targetStart = new Date(
          startObj.getTime() + dayOffset * 24 * 60 * 60 * 1000 + i * 7 * 24 * 60 * 60 * 1000
        );

        targetDates.push(targetStart);
      }
    }

    if (targetDates.length === 0) {
      return { success: false, error: 'No valid future dates selected.' };
    }

    // Pre-validation Loop
    for (const sessionStart of targetDates) {
      const sessionEnd = new Date(sessionStart.getTime() + durationMs);

      // Validate against venue hours
      const openingHours = venue?.opening_hours as Record<
        string,
        { open: string; close: string }
      > | null;

      // Calculate Manila time instances for this specific session iteration
      const manilaStart = new Date(sessionStart.getTime() + 8 * 60 * 60 * 1000);
      const manilaEnd = new Date(sessionEnd.getTime() + 8 * 60 * 60 * 1000);

      if (openingHours) {
        const dayNames = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ];
        const dayOfWeek = dayNames[manilaStart.getUTCDay()];
        const dayHours = openingHours[dayOfWeek];

        if (!dayHours) {
          const formattedDate = `${manilaStart.getUTCMonth() + 1}/${manilaStart.getUTCDate()}/${manilaStart.getUTCFullYear()}`;
          return { success: false, error: `Venue is closed on ${dayOfWeek} (${formattedDate})` };
        }

        // Parse open/close times
        const [openH, openM] = dayHours.open.split(':').map(Number);
        const [closeH, closeM] = dayHours.close.split(':').map(Number);

        const sessionStartH = manilaStart.getUTCHours();
        const sessionStartM = manilaStart.getUTCMinutes();
        const sessionEndH = manilaEnd.getUTCHours();
        const sessionEndM = manilaEnd.getUTCMinutes();

        const sessionStartMinutes = sessionStartH * 60 + sessionStartM;
        const sessionEndMinutes = sessionEndH * 60 + sessionEndM;
        const openMinutes = openH * 60 + (openM || 0);
        const closeMinutes = closeH * 60 + (closeM || 0);

        // Allow tight fitting? Usually yes.
        if (sessionStartMinutes < openMinutes || sessionEndMinutes > closeMinutes) {
          const timeStr = `${sessionStartH % 12 || 12}:${sessionStartM.toString().padStart(2, '0')} ${sessionStartH >= 12 ? 'PM' : 'AM'}`;
          return {
            success: false,
            error: `Venue is closed at ${timeStr} on ${dayOfWeek}s (Open: ${dayHours.open} - ${dayHours.close})`,
          };
        }
      }

      // Check conflicts for all selected courts
      for (const courtId of courtIds) {
        const { data: conflicts } = await supabase
          .from('reservations')
          .select('id')
          .eq('court_id', courtId)
          .in('status', ['pending_payment', 'partially_paid', 'confirmed', 'ongoing'])
          .lt('start_time', sessionEnd.toISOString())
          .gt('end_time', sessionStart.toISOString());

        if (conflicts && conflicts.length > 0) {
          const formattedDate = `${manilaStart.getUTCMonth() + 1}/${manilaStart.getUTCDate()}/${manilaStart.getUTCFullYear()}`;

          const sh = manilaStart.getUTCHours();
          const sm = manilaStart.getUTCMinutes();
          const startTimeStr = `${sh % 12 || 12}:${sm.toString().padStart(2, '0')} ${sh >= 12 ? 'PM' : 'AM'}`;

          const eh = manilaEnd.getUTCHours();
          const em = manilaEnd.getUTCMinutes();
          const endTimeStr = `${eh % 12 || 12}:${em.toString().padStart(2, '0')} ${eh >= 12 ? 'PM' : 'AM'}`;

          return {
            success: false,
            error: `Conflict detected for ${formattedDate}: Queue session overlaps with existing reservation (${startTimeStr} - ${endTimeStr}) on one of the selected courts.`,
          };
        }

        // Check for overlapping queue sessions on the same court.
        const { data: queueConflicts } = await supabase
          .from('queue_sessions')
          .select('id, metadata')
          .in('status', ['pending_payment', 'open', 'active', 'paused'])
          .lt('start_time', sessionEnd.toISOString())
          .gt('end_time', sessionStart.toISOString())
          // We have to use an OR query here because a queue_session might store courts in metadata, or be legacy court_id
          .or(`court_id.eq.${courtId},metadata->courts->>id.eq.${courtId}`); // note: this exact jsonb query might not work if courts is an array, so we must rely on reservations for accurate queue session conflicts!

        // Let's refine the queue conflicts. Since queue_sessions ALWAYS create reservations, checking reservations above ALREADY catches queue sessions!
        // But if we want to be explicit, checking reservations above is enough because queue sessions are represented as reservations!
      }
    }

    // Creation Loop
    let isDownPaymentRequired = false;

    const durationHours = durationMs / (1000 * 60 * 60);
    const baseCourtRentalPerSlotTotal = dbCourts.reduce(
      (sum, c) => sum + c.hourly_rate * durationHours,
      0
    );
    const totalBasePrice = baseCourtRentalPerSlotTotal * targetDates.length;

    // Discount applies to the total base price across all courts
    const discountResult = await calculateApplicableDiscounts({
      venueId: venue.id,
      courtId: data.courts[0].id, // primary court ID for finding discount scopes if any
      startDate: targetDates[0].toISOString(),
      endDate: new Date(targetDates[targetDates.length - 1].getTime() + durationMs).toISOString(),
      recurrenceWeeks: recurrenceWeeks,
      targetDateCount: targetDates.length,
      basePrice: totalBasePrice,
      promoCode: data.promoCode,
    });

    const courtAmountPerSlotTotal = discountResult.finalPrice / targetDates.length;
    const perInstanceDiscountTotal = discountResult.totalDiscount / targetDates.length;

    const platformFeePerSlotTotal = courtAmountPerSlotTotal * 0.05;
    const totalAmountPerSlotTotal =
      Math.round((courtAmountPerSlotTotal + platformFeePerSlotTotal) * 100) / 100;

    let primaryDiscountName: string | null = null;
    let primaryDiscountReason: string | null = null;
    if (discountResult.discounts.length > 0) {
      primaryDiscountName = discountResult.discounts[0].name;
      primaryDiscountReason = discountResult.discounts.map((d) => d.description).join(', ');
    }

    console.log(`[createQueueSession] 💰 Payment calculation per slot:`, {
      durationHours,
      baseCourtRentalPerSlotTotal,
      perInstanceDiscountTotal,
      courtAmountPerSlotTotal,
      platformFeePerSlotTotal,
      totalAmountPerSlotTotal,
    });

    // 1. Create a parent Booking record for this session group
    const { data: newBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        total_amount: totalAmountPerSlotTotal * targetDates.length,
        amount_paid: 0,
        remaining_balance: totalAmountPerSlotTotal * targetDates.length,
        payment_status: 'unpaid',
        status: 'pending',
        metadata: {
          booking_origin: 'queue_session',
          is_recurring: recurrenceWeeks > 1 || (data.selectedDays && data.selectedDays.length > 1),
          recurrence_group_id: recurrenceGroupId,
          promo_code: data.promoCode || undefined,
        },
      })
      .select('id')
      .single();

    if (bookingError || !newBooking) {
      console.error('[createQueueSession] ❌ Failed to create parent booking:', bookingError);
      return { success: false, error: 'Failed to initialize booking transaction' };
    }

    const bookingId = newBooking.id;

    for (const sessionStart of targetDates) {
      const sessionEnd = new Date(sessionStart.getTime() + durationMs);

      // Calculate down payment if applicable
      const venueData = dbCourts[0].venues as any;
      const venueMetadata = venueData
        ? Array.isArray(venueData)
          ? venueData[0]?.metadata
          : venueData.metadata
        : null;
      const downPaymentPercentage = parseFloat(venueMetadata?.down_payment_percentage || '20');

      let downPaymentAmountTotal: number | undefined = undefined;

      if (data.paymentMethod === 'cash') {
        const minimumDownPayment = (totalAmountPerSlotTotal * downPaymentPercentage) / 100;
        if (data.customDownPaymentAmount !== undefined && data.customDownPaymentAmount > 0) {
          const customPerSlot = data.customDownPaymentAmount / targetDates.length;
          const clampedAmount = Math.min(
            Math.max(customPerSlot, minimumDownPayment),
            totalAmountPerSlotTotal
          );
          downPaymentAmountTotal = Math.round(clampedAmount * 100) / 100;
        } else {
          downPaymentAmountTotal = minimumDownPayment;
        }
      }

      if (downPaymentAmountTotal && downPaymentAmountTotal > 0 && data.paymentMethod === 'cash') {
        isDownPaymentRequired = true;
      }

      // Calculate cash payment deadline for queue session reservations
      let cashPaymentDeadline: string | null = null;
      if (data.paymentMethod === 'cash') {
        const twoHoursBefore = new Date(sessionStart.getTime() - 2 * 60 * 60 * 1000);
        const minimumDeadline = new Date(Date.now() + 30 * 60 * 1000);
        const deadline = twoHoursBefore > minimumDeadline ? twoHoursBefore : minimumDeadline;
        cashPaymentDeadline = deadline.toISOString();
      }

      // We create multiple reservations (one for each court)
      const reservationIds: string[] = [];
      for (const court of dbCourts) {
        // Individual court price logic proportionally mapped if needed, or divided evenly
        // For simplicity, we can divide the totals evenly among the children reservations
        const ratio = court.hourly_rate / (baseCourtRentalPerSlotTotal / durationHours);
        const courtReservationTotal = Math.round(totalAmountPerSlotTotal * ratio * 100) / 100;

        const { data: reservation, error: reservationError } = await supabase
          .from('reservations')
          .insert({
            booking_id: bookingId,
            court_id: court.id,
            user_id: user.id,
            start_time: sessionStart.toISOString(),
            end_time: sessionEnd.toISOString(),
            status: 'pending_payment',
            total_amount: courtReservationTotal,
            amount_paid: 0,
            num_players: data.maxPlayers,
            payment_type: 'full',
            payment_method: data.paymentMethod || null,
            cash_payment_deadline: cashPaymentDeadline,
            discount_applied: Math.round(perInstanceDiscountTotal * ratio * 100) / 100,
            discount_type: primaryDiscountName || null,
            discount_reason: primaryDiscountReason || null,
            recurrence_group_id: recurrenceGroupId,
            metadata: {
              booking_origin: 'queue_session',
              queue_session_organizer: true,
              is_queue_session_reservation: true,
              recurrence_group_id: recurrenceGroupId,
              platform_fee: Math.round(platformFeePerSlotTotal * ratio * 100) / 100,
              hourly_rate: court.hourly_rate,
              duration_hours: durationHours,
              total_with_fee: courtReservationTotal,
              intended_payment_method: data.paymentMethod,
              promo_code: data.promoCode || undefined,
              down_payment_amount: downPaymentAmountTotal
                ? Math.round(downPaymentAmountTotal * ratio * 100) / 100
                : undefined,
            },
            notes: `Queue Session (${data.mode}) - ${sessionStart.toLocaleDateString()}${data.paymentMethod === 'cash' ? ' (Cash Payment)' : ''}`,
          })
          .select('id')
          .single();

        if (reservationError || !reservation) {
          console.error('[createQueueSession] ❌ Failed to create reservation:', reservationError);
          // Cancel the parent booking and return
          await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
          return {
            success: false,
            error: `Failed to create reservation for ${sessionStart.toLocaleDateString()} on court ${court.name}`,
          };
        }
        reservationIds.push(reservation.id);
      }

      // Create a single Queue Session representing all these courts
      const { data: session, error: insertError } = await supabase
        .from('queue_sessions')
        .insert({
          court_id: dbCourts[0].id, // primary fallback court
          organizer_id: user.id,
          start_time: sessionStart.toISOString(),
          end_time: sessionEnd.toISOString(),
          mode: data.mode,
          game_format: data.gameFormat,
          join_window_hours: data.joinWindowHours ?? null,
          max_players: data.maxPlayers,
          cost_per_game: data.costPerGame,
          is_public: data.isPublic,
          min_skill_level: data.minSkillLevel ?? null,
          max_skill_level: data.maxSkillLevel ?? null,
          status: 'pending_payment',
          current_players: 0,
          metadata: {
            reservation_ids: reservationIds, // Link to all reservations via array
            reservation_id: reservationIds[0], // primary fallback
            booking_id: bookingId,
            venue: { id: venue?.id, name: venue?.name },
            recurrence_group_id: recurrenceGroupId,
            payment_required: totalAmountPerSlotTotal,
            payment_status: 'pending',
            payment_method: data.paymentMethod || 'e-wallet',
            platform_fee: platformFeePerSlotTotal,
            down_payment_amount: downPaymentAmountTotal,
          },
        })
        .select()
        .single();

      if (insertError || !session) {
        console.error('[createQueueSession] ❌ DB Insert Error:', insertError);
        // Rollback reservations
        try {
          const serviceClient = await createServiceClient();
          for (const resId of reservationIds) {
            await serviceClient.from('reservations').delete().eq('id', resId);
          }
        } catch (rollbackError) {}
        return {
          success: false,
          error: `Failed to create session for ${sessionStart.toLocaleDateString()}: ${insertError?.message || 'Unknown error'}`,
        };
      }

      // Insert into junction table
      const junctionInserts = data.courts.map((c) => ({
        queue_session_id: session.id,
        court_id: c.id,
      }));
      const { error: junctionError } = await supabase
        .from('queue_session_courts')
        .insert(junctionInserts);
      if (junctionError) {
        console.error('[createQueueSession] ❌ Junction Insert Error:', junctionError);
      }

      // Final Step: Update all reservations in this bundle to have the queue_session_id in their metadata
      // This is important so the "My Bookings" page and detail modals can correctly identify all court partners as queue sessions.
      try {
        const { data: currentReservations } = await supabase
          .from('reservations')
          .select('id, metadata')
          .in('id', reservationIds);

        if (currentReservations) {
          for (const res of currentReservations) {
            const updatedMetadata = {
              ...((res.metadata as object) || {}),
              queue_session_id: session.id,
            };
            await supabase
              .from('reservations')
              .update({ metadata: updatedMetadata })
              .eq('id', res.id);
          }
        }
      } catch (e) {
        console.error(
          '[createQueueSession] ⚠️ Warning: Failed to link reservations to queue_session_id:',
          e
        );
      }

      createdSessions.push({
        id: session.id,
        courtId: session.court_id,
        courtName: data.courts.map((c) => c.name).join(', '),
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
        joinWindowHours: session.join_window_hours ?? null,
        participants: [],
        reservationId: reservationIds[0], // primary fallback
        paymentStatus: session.metadata?.payment_status || 'pending',
        paymentMethod: data.paymentMethod || 'e-wallet',
        totalCost: totalAmountPerSlotTotal,
        minSkillLevel: session.min_skill_level ?? null,
        maxSkillLevel: session.max_skill_level ?? null,
      });
    }

    console.log(`[createQueueSession] ✅ Successfully created ${createdSessions.length} sessions`);

    // Send payment notification to Queue Master
    try {
      const firstSession = createdSessions[0];

      await createNotification({
        userId: user.id,
        type: 'queue_approval_approved',
        title: '💳 Queue Session Payment Required',
        message: `Your queue session${createdSessions.length > 1 ? 's have' : ' has'} been created at ${venue?.name || 'the venue'}. ${data.paymentMethod === 'cash' ? 'Please pay at the venue to activate your session.' : 'Complete payment to activate.'}`,
        actionUrl: `/queue-master/sessions/${firstSession.id}`,
        metadata: {
          court_name: data.courts.map((c) => c.name).join(', '),
          venue_name: venue?.name || 'Unknown Venue',
          session_count: createdSessions.length,
          queue_session_id: firstSession.id,
          total_amount: firstSession.totalCost,
          payment_method: data.paymentMethod || 'e-wallet',
          payment_required: true,
        },
      });
      console.log('[createQueueSession] 📬 Sent payment notification to Queue Master');
    } catch (notificationError) {
      // Non-critical error - log but don't fail
      console.error(
        '[createQueueSession] ⚠️ Failed to send notifications (non-critical):',
        notificationError
      );
    }

    // Promo usage is consumed after successful payment webhook.
    // We only persist promo_code in reservation metadata here.

    // 9. Revalidate paths
    revalidatePath('/queue');
    revalidatePath('/queue-master');
    for (const c of data.courts) {
      revalidatePath(`/queue/${c.id}`);
    }

    // Return the first session as primary, but include all
    const firstSessionData = createdSessions[0];
    return {
      success: true,
      session: firstSessionData,
      sessions: createdSessions,
      // For queue sessions, payment is always required initially, but we specify if a down payment applies to cash
      downPaymentRequired: isDownPaymentRequired && firstSessionData.paymentStatus !== 'paid',
      // Note: we'd need downPaymentAmount from the metadata to return it cleanly, but we can extract it or pass it.
      // Wait, let's just grab it from the metadata.
      // Actually queue session `totalCost` isn't the down payment. Let's return what we know.
    };
  } catch (error: any) {
    console.error('[createQueueSession] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to create queue session' };
  }
}

/**
 * Update an existing queue session
 * Queue Master action
 */
export async function updateQueueSession(
  sessionId: string,
  updates: Partial<{
    startTime: Date;
    endTime: Date;
    mode: 'casual' | 'competitive';
    gameFormat: 'singles' | 'doubles' | 'any';
    maxPlayers: number;
    costPerGame: number;
    isPublic: boolean;
    minSkillLevel?: number | null;
    maxSkillLevel?: number | null;
  }>
): Promise<{
  success: boolean;
  session?: QueueSessionData;
  error?: string;
}> {
  console.log('[updateQueueSession] 🔄 Updating queue session:', sessionId, updates);

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[updateQueueSession] ❌ User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[updateQueueSession] ❌ Session not found:', sessionError);
      return { success: false, error: 'Queue session not found' };
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' };
    }

    // 3. Only allow updates if status is pending_payment or open
    if (!['pending_payment', 'open'].includes(session.status)) {
      return {
        success: false,
        error:
          'Cannot update session in current status. Only pending or open sessions can be updated.',
      };
    }

    // 4. Validate updates
    if (updates.startTime && updates.endTime) {
      if (new Date(updates.endTime) <= new Date(updates.startTime)) {
        return { success: false, error: 'End time must be after start time' };
      }
    }

    if (updates.costPerGame !== undefined && updates.costPerGame < 0) {
      return { success: false, error: 'Cost per game must be non-negative' };
    }

    if (updates.maxPlayers !== undefined && (updates.maxPlayers < 4 || updates.maxPlayers > 20)) {
      return { success: false, error: 'Max players must be between 4 and 20' };
    }

    // 5. Build update object
    const updateData: any = {};
    if (updates.startTime) updateData.start_time = updates.startTime.toISOString();
    if (updates.endTime) updateData.end_time = updates.endTime.toISOString();
    if (updates.mode) updateData.mode = updates.mode;
    if (updates.gameFormat) updateData.game_format = updates.gameFormat;
    if (updates.maxPlayers !== undefined) updateData.max_players = updates.maxPlayers;
    if (updates.costPerGame !== undefined) updateData.cost_per_game = updates.costPerGame;
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
    if (updates.minSkillLevel !== undefined) updateData.min_skill_level = updates.minSkillLevel;
    if (updates.maxSkillLevel !== undefined) updateData.max_skill_level = updates.maxSkillLevel;

    // 6. Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from('queue_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select(
        `
        *,
        courts (
          name,
          venues (
            id,
            name
          )
        )
      `
      )
      .single();
    if (updateError || !updatedSession) {
      console.error('[updateQueueSession] ❌ Failed to update session:', updateError);
      return { success: false, error: updateError?.message || 'Failed to update queue session' };
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
      minSkillLevel: updatedSession.min_skill_level ?? null,
      maxSkillLevel: updatedSession.max_skill_level ?? null,
    };

    // 7b. Sync with linked reservation if time was updated
    if (updates.startTime || updates.endTime) {
      const reservationId = updatedSession.metadata?.reservation_id;
      if (reservationId) {
        console.log('[updateQueueSession] 🔄 Syncing time with reservation:', reservationId);
        const adminDb = createServiceClient();
        await adminDb
          .from('reservations')
          .update({
            start_time: updatedSession.start_time,
            end_time: updatedSession.end_time,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reservationId);
      }
    }

    console.log('[updateQueueSession] ✅ Queue session updated successfully');

    // 8. Revalidate paths
    revalidatePath('/queue');
    revalidatePath('/queue-master');
    revalidatePath(`/queue/${session.court_id}`);
    revalidatePath(`/queue-master/sessions/${sessionId}`);

    return { success: true, session: queueData };
  } catch (error: any) {
    console.error('[updateQueueSession] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to update queue session' };
  }
}

/**
 * Pause an active queue session
 * Queue Master action
 */
export async function pauseQueueSession(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('[pauseQueueSession] ⏸️ Pausing queue session:', sessionId);

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' };
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' };
    }

    // 3. Check current status
    if (session.status !== 'active') {
      return { success: false, error: 'Can only pause active sessions' };
    }

    // 4. Update status to paused
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({ status: 'paused' })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[pauseQueueSession] ❌ Failed to pause session:', updateError);
      return { success: false, error: 'Failed to pause queue session' };
    }

    console.log('[pauseQueueSession] ✅ Queue session paused successfully');

    // 5. Revalidate paths
    revalidatePath('/queue');
    revalidatePath('/queue-master');
    revalidatePath(`/queue/${session.court_id}`);
    revalidatePath(`/queue-master/sessions/${sessionId}`);

    return { success: true };
  } catch (error: any) {
    console.error('[pauseQueueSession] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to pause queue session' };
  }
}

/**
 * Resume a paused queue session
 * Queue Master action
 */
export async function resumeQueueSession(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('[resumeQueueSession] ▶️ Resuming queue session:', sessionId);

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' };
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' };
    }

    // 3. Check current status
    if (session.status !== 'paused') {
      return { success: false, error: 'Can only resume paused sessions' };
    }

    // 4. Update status to active
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({ status: 'active' })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[resumeQueueSession] ❌ Failed to resume session:', updateError);
      return { success: false, error: 'Failed to resume queue session' };
    }

    console.log('[resumeQueueSession] ✅ Queue session resumed successfully');

    // 5. Revalidate paths
    revalidatePath('/queue');
    revalidatePath('/queue-master');
    revalidatePath(`/queue/${session.court_id}`);
    revalidatePath(`/queue-master/sessions/${sessionId}`);

    return { success: true };
  } catch (error: any) {
    console.error('[resumeQueueSession] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to resume queue session' };
  }
}

/**
 * Close a queue session and generate summary
 * Queue Master action
 */
export async function closeQueueSession(sessionId: string): Promise<{
  success: boolean;
  summary?: {
    totalGames: number;
    totalRevenue: number;
    totalParticipants: number;
    unpaidBalances: number;
  };
  error?: string;
}> {
  console.log('[closeQueueSession] 🔒 Closing queue session:', sessionId);

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, court_id, cost_per_game, metadata, settings')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' };
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' };
    }

    // 3. Get all participants
    const { data: participants, error: participantsError } = await supabase
      .from('queue_participants')
      .select('games_played, amount_owed, payment_status')
      .eq('queue_session_id', sessionId);

    if (participantsError) {
      console.error('[closeQueueSession] ❌ Failed to fetch participants:', participantsError);
      return { success: false, error: 'Failed to fetch participants' };
    }

    console.log('[closeQueueSession] 📊 Fetched participants count:', participants?.length || 0);
    if (participants && participants.length > 0) {
      participants.forEach((p, idx) => {
        console.log(
          `      [${idx + 1}] games_played=${p.games_played}, amount_owed=${p.amount_owed}, payment_status=${p.payment_status}`
        );
      });
    }

    // 4. Calculate summary
    const totalGamesFromParticipants =
      participants?.reduce((sum, p) => sum + (p.games_played || 0), 0) || 0;
    const totalRevenueFromParticipants =
      participants?.reduce((sum, p) => sum + parseFloat(p.amount_owed || '0'), 0) || 0;

    // Fallback: derive from completed matches in case participant counters/owed were not persisted.
    const costPerGame = parseFloat(session.cost_per_game || '0');
    const { data: completedMatches } = await supabase
      .from('matches')
      .select('team_a_players, team_b_players')
      .eq('queue_session_id', sessionId)
      .eq('status', 'completed');

    const totalGamesFromMatches = completedMatches?.length || 0;
    const totalRevenueFromMatches = (completedMatches || []).reduce((sum: number, m: any) => {
      const playersInMatch = (m.team_a_players?.length || 0) + (m.team_b_players?.length || 0);
      return sum + playersInMatch * costPerGame;
    }, 0);

    const totalGames = Math.max(totalGamesFromParticipants, totalGamesFromMatches);
    const totalRevenue =
      totalRevenueFromParticipants > 0 ? totalRevenueFromParticipants : totalRevenueFromMatches;
    const totalParticipants = participants?.length || 0;
    const unpaidBalances =
      participants?.filter(
        (p) => p.payment_status !== 'paid' && parseFloat(p.amount_owed || '0') > 0
      ).length || 0;

    const summary = {
      totalGames,
      totalRevenue,
      totalParticipants,
      unpaidBalances,
      closedBy: user.user_metadata?.full_name || user.email || user.id,
      closedAt: new Date().toISOString(),
      closedReason: 'manual',
    };

    console.log('[closeQueueSession] ✅ Calculated summary:', summary);

    // 5. Update session status to completed
    console.log('[closeQueueSession] 💾 Updating session with summary...');
    const { error: updateError } = await supabase
      .from('queue_sessions')
      .update({
        status: 'completed',
        settings: {
          ...(session.settings || {}),
          manually_closed: true,
          completed_at: summary.closedAt,
          summary,
        },
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[closeQueueSession] ❌ Failed to complete session:', updateError);
      return { success: false, error: 'Failed to complete queue session' };
    }

    console.log('[closeQueueSession] ✅ Session updated successfully');

    // Verify the update worked
    const { data: verify } = await supabase
      .from('queue_sessions')
      .select('settings')
      .eq('id', sessionId)
      .single();

    console.log(
      '[closeQueueSession] 🔍 Verification - settings saved:',
      verify?.settings?.['summary'] || 'NOT FOUND'
    );

    // 5a. Mark all remaining active participants as 'completed'
    const { error: participantStatusError } = await supabase
      .from('queue_participants')
      .update({ status: 'completed' })
      .eq('queue_session_id', sessionId)
      .is('left_at', null)
      .in('status', ['waiting', 'playing']);

    if (participantStatusError) {
      console.warn(
        '[closeQueueSession] ⚠️ Failed to mark participants as completed:',
        participantStatusError
      );
    } else {
      console.log('[closeQueueSession] ✅ Marked active participants as completed');
    }

    console.log('[closeQueueSession] ✅ Queue session completed successfully:', summary);

    // 5b. Also complete the linked reservation (belt-and-suspenders with DB trigger)
    const linkedReservationId = session.metadata?.reservation_id;
    if (linkedReservationId) {
      // Fetch existing reservation metadata so we can merge, not overwrite
      const { data: existingRes } = await supabase
        .from('reservations')
        .select('metadata')
        .eq('id', linkedReservationId)
        .single();

      const { error: resError } = await supabase
        .from('reservations')
        .update({
          status: 'completed',
          metadata: {
            ...(existingRes?.metadata || {}),
            auto_completed: {
              at: new Date().toISOString(),
              by: 'queue_master',
              reason: 'queue_session_closed',
              queue_session_id: sessionId,
            },
          },
        })
        .eq('id', linkedReservationId)
        .in('status', ['confirmed', 'partially_paid', 'ongoing']);

      if (resError) {
        console.error('[closeQueueSession] ⚠️ Failed to complete linked reservation:', resError);
      } else {
        console.log('[closeQueueSession] ✅ Linked reservation completed:', linkedReservationId);
        revalidatePath('/court-admin/reservations');
      }
    }

    // 6. Send notifications to all participants
    try {
      const { data: venue } = await supabase
        .from('courts')
        .select('name, venues(name)')
        .eq('id', session.court_id)
        .single();

      const venueData = venue?.venues
        ? Array.isArray(venue.venues)
          ? venue.venues[0]
          : venue.venues
        : null;
      const venueName = venueData?.name || 'Venue';

      const { data: allParticipants } = await supabase
        .from('queue_participants')
        .select('user_id, games_played')
        .eq('queue_session_id', sessionId)
        .is('left_at', null);

      if (allParticipants && allParticipants.length > 0) {
        const notifications = allParticipants.map((p) => ({
          userId: p.user_id,
          ...NotificationTemplates.queueSessionEnded(venueName, p.games_played || 0, sessionId),
        }));

        await createBulkNotifications(notifications);
        console.log(
          '[closeQueueSession] 📬 Sent',
          notifications.length,
          'end-of-session notifications'
        );
      }
    } catch (notificationError) {
      console.error(
        '[closeQueueSession] ⚠️ Failed to send notifications (non-critical):',
        notificationError
      );
    }

    // 7. Revalidate paths
    revalidatePath('/queue');
    revalidatePath('/queue-master');
    revalidatePath(`/queue/${session.court_id}`);
    revalidatePath(`/queue-master/sessions/${sessionId}`);

    return { success: true, summary };
  } catch (error: any) {
    console.error('[closeQueueSession] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to close queue session' };
  }
}

/**
 * Cancel a queue session
 * Queue Master action - mirrors the normal reservation flow with refund integration.
 */
export async function cancelQueueSession(
  sessionId: string,
  reason: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('[cancelQueueSession] ❌ Cancelling queue session:', sessionId, reason);

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, status, start_time, end_time, metadata')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' };
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' };
    }

    // 3. Status check — only active/pending sessions can be cancelled
    const cancellableStatuses = ['pending_payment', 'open', 'active'];
    if (!cancellableStatuses.includes(session.status)) {
      return { success: false, error: `Cannot cancel a session with status: ${session.status}` };
    }

    // 4. 24-hour policy — cannot cancel within 24 hours of start time
    const hoursUntilStart =
      (new Date(session.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilStart < 24) {
      return { success: false, error: 'Cannot cancel within 24 hours of session start time' };
    }

    // 5. Update session status to cancelled
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
      .eq('id', sessionId);

    if (updateError) {
      console.error('[cancelQueueSession] ❌ Failed to cancel session:', updateError);
      return { success: false, error: 'Failed to cancel queue session' };
    }

    // 6. Sync with linked reservations and handle refunds
    const reservationIds =
      session.metadata?.reservation_ids ||
      (session.metadata?.reservation_id ? [session.metadata.reservation_id] : []);

    if (reservationIds.length > 0) {
      console.log(
        '[cancelQueueSession] 🔄 Syncing cancellation with reservations:',
        reservationIds
      );
      const adminDb = createServiceClient();

      for (const resId of reservationIds) {
        // Fetch reservation to check payment status
        const { data: booking } = await adminDb
          .from('reservations')
          .select('id, status, amount_paid, metadata')
          .eq('id', resId)
          .single();

        if (!booking) continue;

        // If paid, trigger refund request
        if (booking.amount_paid > 0) {
          await requestRefundAction({
            reservationId: resId,
            reason: `Queue session cancelled: ${reason}`,
            reasonCode: 'requested_by_customer',
          });
        }

        // Update reservation status to cancelled
        await adminDb
          .from('reservations')
          .update({
            status: 'cancelled',
            metadata: {
              ...(booking.metadata || {}),
              cancelled_at: new Date().toISOString(),
              cancellation_reason: reason,
              queue_session_cancelled: true,
            },
          })
          .eq('id', resId);
      }
    }

    revalidatePath('/bookings');
    revalidatePath('/reservations');
    revalidatePath(`/queue/${sessionId}`);

    console.log('[cancelQueueSession] ✅ Queue session and reservations cancelled successfully');
    return { success: true };
  } catch (error) {
    console.error('[cancelQueueSession] ❌ Unexpected Error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Request a reschedule for a queue session.
 * Stores the proposed new times in metadata for admin approval.
 */
export async function rescheduleQueueSessionAction(
  sessionId: string,
  newDate: Date,
  newStartTime: string // HH:MM
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // 1. Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // 2. Fetch the existing queue session
  const adminDb = createServiceClient();
  const { data: session, error: fetchError } = await adminDb
    .from('queue_sessions')
    .select(
      `
      *,
      courts(
        id,
        name,
        venue:venues(
          id,
          name,
          owner_id
        )
      ),
      queue_session_courts(
        courts(
          id,
          name,
          venue:venues(
            id,
            name,
            owner_id
          )
        )
      )
    `
    )
    .eq('id', sessionId)
    .single();

  if (fetchError || !session) {
    return { success: false, error: 'Queue session not found' };
  }

  // Verify ownership
  if (session.organizer_id !== user.id) {
    return { success: false, error: 'You do not have permission to reschedule this session' };
  }

  // 3. Verify status
  const allowedStatuses = ['pending_payment', 'open', 'active'];
  if (!allowedStatuses.includes(session.status)) {
    return { success: false, error: `Cannot reschedule a session with status: ${session.status}` };
  }

  // 3b. 24-hour policy
  const hoursUntilStart = (new Date(session.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilStart < 24) {
    return { success: false, error: 'Cannot reschedule within 24 hours of session start time' };
  }

  // 3c. Check if already rescheduled or has pending request
  if (session.metadata?.rescheduled === true) {
    return { success: false, error: 'This session has already been rescheduled once.' };
  }
  if (session.metadata?.reschedule_request?.status === 'pending') {
    return { success: false, error: 'There is already a pending reschedule request.' };
  }

  // 4. Calculate new time range
  const oldStart = new Date(session.start_time);
  const oldEnd = new Date(session.end_time);
  const durationInMinutes = differenceInMinutes(oldEnd, oldStart);

  // Use Asia/Manila for time conversions
  const [hours, minutes] = newStartTime.split(':').map(Number);
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(newDate));

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const newStartISO = `${dateStr}T${hoursStr}:${minutesStr}:00+08:00`;
  const newStartDateTime = new Date(newStartISO);
  const newEndDateTime = addMinutes(newStartDateTime, durationInMinutes);
  const newEndISO = newEndDateTime.toISOString();

  // 5. Determine all court IDs in this session
  const courtIds: string[] = [];
  if (session.queue_session_courts && Array.isArray(session.queue_session_courts)) {
    session.queue_session_courts.forEach((qsc: any) => {
      if (qsc.courts?.id) courtIds.push(qsc.courts.id);
    });
  }

  // Fallback to primary court_id if junction table is empty
  if (courtIds.length === 0 && session.court_id) {
    courtIds.push(session.court_id);
  }

  const venue = session.queue_session_courts?.[0]?.courts?.venue || session.courts?.venue;
  if (!venue) {
    return { success: false, error: 'Venue information not found' };
  }

  // 6. Check Availability for ALL courts in the session

  for (const courtId of courtIds) {
    // Check reservations
    const { data: conflicts } = await adminDb
      .from('reservations')
      .select('id')
      .eq('court_id', courtId)
      // Ignore reservations that are part of THIS session
      .filter('metadata->>queue_session_id', 'neq', sessionId)
      .in('status', ['pending_payment', 'confirmed', 'ongoing', 'partially_paid'])
      .lt('start_time', newEndISO)
      .gt('end_time', newStartISO)
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: `One of the courts is no longer available at the selected time.`,
      };
    }

    // Check other queue sessions
    const { data: queueConflicts } = await adminDb
      .from('queue_sessions')
      .select('id')
      .eq('court_id', courtId)
      .neq('id', sessionId)
      .in('status', ['pending_payment', 'open', 'active'])
      .lt('start_time', newEndISO)
      .gt('end_time', newStartISO)
      .limit(1);

    if (queueConflicts && queueConflicts.length > 0) {
      return {
        success: false,
        error: `The selected time slot conflicts with another queue session.`,
      };
    }
  }

  // 6. Store request in metadata
  const rescheduleRequest = {
    status: 'pending',
    proposed_start_time: newStartISO,
    proposed_end_time: newEndISO,
    original_start_time: session.start_time,
    original_end_time: session.end_time,
    requested_at: new Date().toISOString(),
    requested_by: user.id,
  };

  const { error: updateError } = await adminDb
    .from('queue_sessions')
    .update({
      metadata: {
        ...(session.metadata || {}),
        reschedule_request: rescheduleRequest,
      },
    })
    .eq('id', sessionId);

  if (updateError) {
    return { success: false, error: 'Failed to submit reschedule request' };
  }

  // 7. Sync request to linked reservations (for UI visibility)
  const reservationIds =
    session.metadata?.reservation_ids ||
    (session.metadata?.reservation_id ? [session.metadata.reservation_id] : []);
  if (reservationIds.length > 0) {
    for (const resId of reservationIds) {
      const { data: res } = await adminDb
        .from('reservations')
        .select('metadata')
        .eq('id', resId)
        .single();
      await adminDb
        .from('reservations')
        .update({
          metadata: {
            ...(res?.metadata || {}),
            reschedule_request: rescheduleRequest,
          },
        })
        .eq('id', resId);
    }
  }

  // 8. Notify Admin
  const venueOwnerId = venue?.owner_id;

  if (venueOwnerId) {
    // Get user name for notification
    const { data: profile } = await adminDb
      .from('profiles')
      .select('display_name, first_name, last_name')
      .eq('id', user.id)
      .single();
    const customerName =
      profile?.display_name ||
      `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
      'A customer';

    await createNotification({
      userId: venueOwnerId,
      ...NotificationTemplates.reschedulePending(
        customerName,
        'Multi-court Queue Slot',
        new Date(newStartISO).toLocaleDateString('en-US', {
          timeZone: 'Asia/Manila',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
        sessionId
      ),
    });
  }

  revalidatePath('/bookings');
  revalidatePath(`/queue/${sessionId}`);

  return { success: true };
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
  success: boolean;
  amountOwed?: number;
  error?: string;
}> {
  console.log('[removeParticipant] 🚫 Removing participant:', { sessionId, userId, reason });

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Get session and verify user is organizer
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('organizer_id, court_id, cost_per_game')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return { success: false, error: 'Queue session not found' };
    }

    if (session.organizer_id !== user.id) {
      return { success: false, error: 'Unauthorized: Not session organizer' };
    }

    // 3. Get participant record
    const { data: participant, error: participantError } = await supabase
      .from('queue_participants')
      .select('*')
      .eq('queue_session_id', sessionId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (participantError || !participant) {
      return { success: false, error: 'Participant not found' };
    }

    // 4. Prevent removing players in active matches
    if (participant.status === 'playing') {
      return {
        success: false,
        error: 'Cannot remove player from active match. Please complete or cancel the match first.',
      };
    }

    // 5. Preserve stored amount_owed if fee was already waived; otherwise calculated from games
    const gamesPlayed = participant.games_played || 0;
    const costPerGame = parseFloat(session.cost_per_game || '0');
    const storedAmountOwed = parseFloat(participant.amount_owed || '0');
    const existingPaymentStatus = participant.payment_status;
    // If fee was waived (amount_owed is 0 and status is paid/waived), keep it; otherwise recalculate
    const amountOwed =
      existingPaymentStatus === 'paid' && storedAmountOwed === 0
        ? 0 // preserve waiver
        : storedAmountOwed > 0
          ? storedAmountOwed // use stored value if it already reflects updates
          : gamesPlayed * costPerGame; // fallback to calculation only if nothing stored

    // 6. Update participant record
    const leftAt = await getServerNow();
    const { error: updateError } = await supabase
      .from('queue_participants')
      .update({
        status: 'left',
        left_at: leftAt.toISOString(),
        amount_owed: amountOwed,
      })
      .eq('id', participant.id);

    if (updateError) {
      console.error('[removeParticipant] ❌ Failed to update participant:', updateError);
      return { success: false, error: 'Failed to remove participant' };
    }

    // NOTE: The DB trigger update_queue_count (migration 009) fires on the UPDATE above
    // and decrements current_players automatically when status → 'left'.
    // Do NOT call decrement_queue_players RPC here — that would cause a double-decrement.

    console.log('[removeParticipant] ✅ Participant removed successfully:', {
      amountOwed,
      gamesPlayed,
    });

    // 8. Revalidate paths
    revalidatePath('/queue');
    revalidatePath('/queue-master');
    revalidatePath(`/queue/${session.court_id}`);
    revalidatePath(`/queue-master/sessions/${sessionId}`);

    return { success: true, amountOwed };
  } catch (error: any) {
    console.error('[removeParticipant] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to remove participant' };
  }
}

/**
 * Mark participant as paid (cash payment)
 * Queue Master action
 */
export async function markAsPaid(participantId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('[markAsPaid] 💵 Marking participant as paid:', participantId);

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[markAsPaid] ❌ User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Use service client for all reads (Queue Master is not the participant, RLS blocks regular client)
    const serviceClient = createServiceClient();

    const { data: participant, error: participantError } = await serviceClient
      .from('queue_participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (participantError || !participant) {
      console.error('[markAsPaid] ❌ Participant not found:', {
        participantId,
        error: participantError,
        message: participantError?.message,
        details: participantError?.details,
        hint: participantError?.hint,
      });
      return { success: false, error: participantError?.message || 'Participant not found' };
    }

    console.log('[markAsPaid] 📦 Participant found:', {
      participantId: participant.id,
      sessionId: participant.queue_session_id,
      currentStatus: participant.payment_status,
      amountOwed: participant.amount_owed,
    });

    // 3. Get queue session details separately to verify organizer
    const { data: queueSession, error: sessionError } = await serviceClient
      .from('queue_sessions')
      .select('id, organizer_id, court_id')
      .eq('id', participant.queue_session_id)
      .single();

    if (sessionError || !queueSession) {
      console.error('[markAsPaid] ❌ Queue session not found:', sessionError);
      return { success: false, error: 'Queue session not found' };
    }

    console.log('[markAsPaid] 🔍 Session data:', {
      sessionId: queueSession.id,
      organizerId: queueSession.organizer_id,
      currentUserId: user.id,
    });

    // 4. Verify user is session organizer (Queue Master)
    if (queueSession.organizer_id !== user.id) {
      console.error('[markAsPaid] ❌ Unauthorized: Not session organizer');
      return { success: false, error: 'Unauthorized: Not session organizer' };
    }

    // 5. Check if already paid
    if (participant.payment_status === 'paid') {
      console.log('[markAsPaid] ℹ️ Participant already marked as paid');
      return { success: true }; // Idempotent - already paid is success
    }

    // 6. Update participant to mark as paid (preserve amount_owed for revenue tracking)
    const { error: updateError } = await serviceClient
      .from('queue_participants')
      .update({
        payment_status: 'paid',
      })
      .eq('id', participantId);

    if (updateError) {
      console.error('[markAsPaid] ❌ Failed to update participant:', updateError);
      return { success: false, error: 'Failed to mark as paid' };
    }

    console.log('[markAsPaid] ✅ Participant marked as paid successfully');

    // 7. Revalidate paths for immediate UI update
    revalidatePath('/queue-master');
    revalidatePath(`/queue-master/sessions/${queueSession.id}`);
    revalidatePath(`/queue/${queueSession.court_id}`);

    return { success: true };
  } catch (error: any) {
    console.error('[markAsPaid] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to mark as paid' };
  }
}

/**
 * Get all queue sessions created by current user (Queue Master)
 */
export async function getMyQueueMasterSessions(filter?: {
  status?: 'active' | 'pending' | 'past';
}): Promise<{
  success: boolean;
  sessions?: Array<QueueSessionData & { participants: QueueParticipantData[] }>;
  error?: string;
}> {
  console.log('[getMyQueueMasterSessions] 🔍 Fetching Queue Master sessions:', filter);

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Build query based on filter
    let query = supabase
      .from('queue_sessions')
      .select(
        `
        *,
        courts (
          id,
          name,
          venues (
            id,
            name
          )
        ),
        queue_session_courts (
          court_id,
          courts (
            name
          )
        )
      `
      )
      .eq('organizer_id', user.id);

    // Apply status filter
    if (filter?.status === 'active') {
      // Active: all paid sessions (open, active) — ready to go
      query = query.in('status', ['active', 'open']);
    } else if (filter?.status === 'pending') {
      // Pending: sessions awaiting payment (needs action)
      // Include legacy statuses that map to pending
      query = query.in('status', ['pending_payment', 'draft', 'pending_approval', 'upcoming']);
    } else if (filter?.status === 'past') {
      query = query.in('status', ['completed', 'cancelled', 'closed', 'rejected']);
    }

    query = query.order('created_at', { ascending: false });

    const { data: sessions, error: sessionsError } = await query;

    if (sessionsError) {
      console.error('[getMyQueueMasterSessions] ❌ Failed to fetch sessions:', sessionsError);
      return { success: false, error: 'Failed to fetch sessions' };
    }

    // Auto-activate, auto-close, and filter sessions based on time
    const now = await getServerNow();
    const validSessions: any[] = [];
    for (const session of sessions) {
      const startTime = new Date(session.start_time);
      const endTime = new Date(session.end_time);

      // AUTO-CLOSE: If past end_time, complete the session
      if (['open', 'active'].includes(session.status) && endTime < now) {
        console.log('[getMyQueueMasterSessions] 🕒 Session expired, auto-completing:', session.id);
        const { error } = await supabase
          .from('queue_sessions')
          .update({ status: 'completed', updated_at: now.toISOString() })
          .eq('id', session.id);
        if (error) {
          console.error('Failed to auto-complete expired session:', session.id, error);
        } else {
          session.status = 'completed';
        }
        // Exclude from active/pending views
        if (filter?.status === 'active' || filter?.status === 'pending') {
          continue;
        }
        validSessions.push(session);
        continue;
      }

      // AUTO-ACTIVATE: If session is 'open' and start_time has passed, flip to 'active'
      if (session.status === 'open' && startTime <= now && endTime > now) {
        console.log(
          '[getMyQueueMasterSessions] ▶️ Auto-activating session (start_time reached):',
          session.id
        );
        const { error } = await supabase
          .from('queue_sessions')
          .update({ status: 'active', updated_at: now.toISOString() })
          .eq('id', session.id);
        if (!error) {
          session.status = 'active';
        }
      }

      validSessions.push(session);
    }

    // 3. Get participant data for each session
    const sessionsWithParticipants = await Promise.all(
      (validSessions || []).map(async (session: any) => {
        // Get participants
        const { data: participants } = await supabase
          .from('queue_participants')
          .select(
            `
            *,
            user:user_id!inner (
              id,
              display_name,
              first_name,
              last_name,
              avatar_url
            )
          `
          )
          .eq('queue_session_id', session.id)
          .is('left_at', null);

        // Get player skill levels
        const playerIds = participants?.map((p: any) => p.user_id) || [];
        const { data: players } = await supabase
          .from('players')
          .select('user_id, skill_level')
          .in('user_id', playerIds);

        const playerSkillMap = new Map(players?.map((p: any) => [p.user_id, p.skill_level]) || []);

        const formattedParticipants: QueueParticipantData[] = (participants || []).map(
          (p: any, index: number) => ({
            id: p.id,
            userId: p.user_id,
            playerName:
              p.user?.display_name ||
              `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() ||
              'Unknown Player',
            avatarUrl: p.user?.avatar_url,
            skillLevel: playerSkillMap.get(p.user_id) || 5,
            position: index + 1,
            joinedAt: new Date(p.joined_at),
            gamesPlayed: p.games_played || 0,
            gamesWon: p.games_won || 0,
            status: p.status,
            amountOwed: parseFloat(p.amount_owed || '0'),
            paymentStatus: p.payment_status,
          })
        );

        // Status corrections are already handled above in the for-loop

        const courtName =
          session.queue_session_courts?.length > 0
            ? session.queue_session_courts
                .map((qsc: any) => qsc.courts?.name)
                .filter(Boolean)
                .join(', ')
            : session.metadata?.courts?.map((c: any) => c.name).join(', ') ||
              session.courts?.name ||
              'Unknown Court';

        return {
          id: session.id,
          courtId: session.court_id,
          courtName,
          venueName: session.courts?.venues?.name || 'Unknown Venue',
          venueId: session.courts?.venues?.id || '',
          status: session.status,

          currentPlayers: formattedParticipants.length,
          maxPlayers: session.max_players || 12,
          costPerGame: parseFloat(session.cost_per_game || '0'),
          startTime: new Date(session.start_time),
          endTime: new Date(session.end_time),
          createdAt: new Date(session.created_at),
          mode: session.mode,
          gameFormat: session.game_format,
          participants: formattedParticipants,
          totalCost: session.metadata?.payment_required
            ? parseFloat(session.metadata.payment_required)
            : 0,
          paymentStatus: session.metadata?.payment_status || 'pending',
          paymentMethod: session.metadata?.payment_method || 'e-wallet',
        };
      })
    );

    console.log('[getMyQueueMasterSessions] ✅ Fetched sessions:', sessionsWithParticipants.length);

    return { success: true, sessions: sessionsWithParticipants };
  } catch (error: any) {
    console.error('[getMyQueueMasterSessions] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to fetch sessions' };
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
  success: boolean;
  stats?: {
    totalSessions: number;
    totalRevenue: number;
    averagePlayers: number;
    activeSessions: number;
    counts: {
      active: number;
      pending: number;
      past: number;
    };
  };
  error?: string;
}> {
  console.log('[getQueueMasterStats] 📊 Fetching queue master stats');

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get all sessions for this organizer
    const { data: sessions, error } = await supabase
      .from('queue_sessions')
      .select(
        `
        id,
        status,
        start_time,
        end_time,
        current_players,
        cost_per_game,
        queue_participants (
          amount_owed,
          payment_status
        )
      `
      )
      .eq('organizer_id', user.id);
    // Remove .neq('status', 'draft') so we count drafts in 'upcoming' or similar if desired
    // But maybe we want to keep them hidden from stats?
    // Dashboard usually shows drafts in upcoming or active.
    // Let's remove the draft filter to be inclusive.

    if (error) {
      console.error('[getQueueMasterStats] ❌ Failed to fetch stats:', error);
      return { success: false, error: 'Failed to fetch stats' };
    }

    const now = await getServerNow();
    const totalSessions = sessions?.length || 0;

    // Categorize sessions
    let activeCount = 0;
    let pendingCount = 0;
    let pastCount = 0;

    let totalRevenue = 0;
    let totalPlayers = 0;
    let evaluatedSessions = 0;

    for (const session of sessions || []) {
      const startTime = new Date(session.start_time);
      const endTime = session.end_time ? new Date(session.end_time) : null;
      const isExpired = endTime && endTime < now && ['open', 'active'].includes(session.status);

      // Auto-complete if expired (await so counts below are accurate)
      if (isExpired) {
        const { error } = await supabase
          .from('queue_sessions')
          .update({ status: 'completed' })
          .eq('id', session.id);
        if (error) console.error('Failed to auto-complete expired session:', session.id, error);
        else session.status = 'completed';
      }

      // Auto-activate: open sessions whose start_time has passed
      if (!isExpired && session.status === 'open' && startTime <= now) {
        const { error } = await supabase
          .from('queue_sessions')
          .update({ status: 'active' })
          .eq('id', session.id);
        if (error) console.error('Failed to auto-activate session:', session.id, error);
        else session.status = 'active';
      }

      // Count logic matching Dashboard filters
      const effectiveStatus = isExpired ? 'completed' : session.status;

      if (['completed', 'cancelled', 'closed', 'rejected'].includes(effectiveStatus)) {
        pastCount++;
      } else if (['active', 'open'].includes(effectiveStatus)) {
        activeCount++;
      } else {
        // pending_payment + any legacy statuses (draft, pending_approval, upcoming)
        pendingCount++;
      }

      // Stats calculation — only count paid participants as revenue
      const sessionRevenue =
        session.queue_participants?.reduce((sum: number, p: any) => {
          if (p.payment_status === 'paid') {
            return sum + parseFloat(p.amount_owed || '0');
          }
          return sum;
        }, 0) || 0;
      totalRevenue += sessionRevenue;

      if (['active', 'open', 'completed'].includes(effectiveStatus)) {
        totalPlayers += session.queue_participants?.length || 0;
        evaluatedSessions++;
      }
    }

    const averagePlayers = evaluatedSessions > 0 ? Math.round(totalPlayers / evaluatedSessions) : 0;

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
          past: pastCount,
        },
      },
    };
  } catch (error: any) {
    console.error('[getQueueMasterStats] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to fetch stats' };
  }
}

export async function getQueueSessionSummary(sessionId: string): Promise<{
  success: boolean;
  summary?: {
    session: {
      id: string;
      status: string;
      mode: 'casual' | 'competitive';
      gameFormat: 'singles' | 'doubles' | 'any';
      costPerGame: number;
      startTime: string;
      endTime: string;
      courtName: string;
      venueName: string;
      venueId: string;
      organizerName: string;
      settings?: any;
      summary?: {
        totalGames: number;
        totalRevenue: number;
        totalParticipants: number;
        unpaidBalances: number;
        closedAt: string;
        closedBy: string;
        closedReason: string;
      };
    };
    participants: Array<{
      id: string;
      userId: string;
      playerName: string;
      avatarUrl?: string;
      skillLevel: number;
      position: number;
      joinedAt: string;
      leftAt?: string;
      gamesPlayed: number;
      gamesWon: number;
      status: string;
      amountOwed: number;
      paymentStatus: string;
    }>;
    matches: Array<{
      id: string;
      matchNumber: number;
      startTime: string;
      endTime?: string;
      status: string;
      team1Players: Array<{ id: string; name: string; skillLevel: number }>;
      team2Players: Array<{ id: string; name: string; skillLevel: number }>;
      team1Score?: number;
      team2Score?: number;
      winnerTeam?: number;
    }>;
  };
  error?: string;
}> {
  console.log('[getQueueSessionSummary] 🔍 Fetching summary for session:', sessionId);

  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // 2. Fetch session details with court and venue info
    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select(
        `
        *,
        courts (
          id,
          name,
          venues (
            id,
            name
          )
        ),
        queue_session_courts (
          court_id,
          courts (
            name
          )
        ),
        organizer:organizer_id (
          display_name,
          first_name,
          last_name
        )
      `
      )
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[getQueueSessionSummary] ❌ Session not found:', sessionError);
      return { success: false, error: 'Queue session not found' };
    }

    // Verify user is the organizer or has queue master role
    if (session.organizer_id !== user.id) {
      // Check if user has queue_master role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'queue_master')
        .maybeSingle();

      if (!userRoles) {
        return { success: false, error: 'Unauthorized to view this session summary' };
      }
    }

    // 3. Fetch all participants (including those who left)
    const { data: participants, error: participantsError } = await supabase
      .from('queue_participants')
      .select(
        `
        *,
        user:user_id!inner (
          id,
          display_name,
          first_name,
          last_name,
          avatar_url
        )
      `
      )
      .eq('queue_session_id', sessionId)
      .order('joined_at', { ascending: true });

    if (participantsError) {
      console.error('[getQueueSessionSummary] ❌ Failed to fetch participants:', participantsError);
      return { success: false, error: 'Failed to fetch participants' };
    }

    // Load player skill levels separately; queue_participants has no direct FK to players.
    const participantUserIds = (participants || []).map((p: any) => p.user_id);
    const { data: participantPlayers } =
      participantUserIds.length > 0
        ? await supabase
            .from('players')
            .select('user_id, skill_level')
            .in('user_id', participantUserIds)
        : { data: [] };

    const participantSkillMap = new Map(
      (participantPlayers || []).map((p: any) => [p.user_id, p.skill_level])
    );

    // 4. Fetch all matches for this session
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(
        `
        id,
        match_number,
        scheduled_at,
        started_at,
        completed_at,
        status,
        team_a_players,
        team_b_players,
        score_a,
        score_b,
        winner,
        created_at
      `
      )
      .eq('queue_session_id', sessionId)
      .order('match_number', { ascending: true });

    if (matchesError) {
      console.error('[getQueueSessionSummary] ❌ Failed to fetch matches:', matchesError);
      return { success: false, error: 'Failed to fetch matches' };
    }

    // 5. Transform data for frontend
    const participantsSummary = (participants || []).map((p: any, index: number) => ({
      id: p.id,
      userId: p.user_id,
      playerName: p.user.display_name || `${p.user.first_name} ${p.user.last_name}`.trim(),
      avatarUrl: p.user.avatar_url,
      skillLevel: participantSkillMap.get(p.user_id) || 1,
      position: index + 1,
      joinedAt: p.joined_at,
      leftAt: p.left_at,
      gamesPlayed: p.games_played || 0,
      gamesWon: p.games_won || 0,
      status: p.status,
      amountOwed: p.amount_owed || 0,
      paymentStatus: p.payment_status,
    }));

    // Build a profile map from queue participants first, then fill gaps from profiles table
    const nameMap = new Map(
      (participants || []).map((p: any) => [
        p.user_id,
        {
          name:
            p.user?.display_name ||
            `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() ||
            'Unknown Player',
          skillLevel: participantSkillMap.get(p.user_id) || 1,
        },
      ])
    );

    const matchPlayerIds = Array.from(
      new Set(
        (matches || []).flatMap((m: any) => [
          ...(m.team_a_players || []),
          ...(m.team_b_players || []),
        ])
      )
    ) as string[];

    const missingProfileIds = matchPlayerIds.filter((id: string) => !nameMap.has(id));
    if (missingProfileIds.length > 0) {
      const { data: missingProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, last_name')
        .in('id', missingProfileIds);

      for (const profile of missingProfiles || []) {
        nameMap.set(profile.id, {
          name:
            profile.display_name ||
            `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
            'Unknown Player',
          skillLevel: participantSkillMap.get(profile.id) || 1,
        });
      }
    }

    const matchesSummary = (matches || []).map((m: any) => {
      const team1Players = (m.team_a_players || []).map((userId: string) => ({
        id: userId,
        name: nameMap.get(userId)?.name || 'Unknown Player',
        skillLevel: nameMap.get(userId)?.skillLevel || 1,
      }));

      const team2Players = (m.team_b_players || []).map((userId: string) => ({
        id: userId,
        name: nameMap.get(userId)?.name || 'Unknown Player',
        skillLevel: nameMap.get(userId)?.skillLevel || 1,
      }));

      return {
        id: m.id,
        matchNumber: m.match_number,
        startTime: m.started_at || m.scheduled_at || m.created_at,
        endTime: m.completed_at,
        status: m.status,
        team1Players,
        team2Players,
        team1Score: m.score_a,
        team2Score: m.score_b,
        winnerTeam: m.winner === 'team_a' ? 1 : m.winner === 'team_b' ? 2 : undefined,
      };
    });

    // Extract summary from settings if available
    const sessionSummary = session.settings?.summary;

    const summary = {
      session: {
        id: session.id,
        status: session.status,
        mode: session.mode,
        gameFormat: session.game_format,
        costPerGame: session.cost_per_game,
        startTime: session.start_time,
        endTime: session.end_time,
        courtName:
          session.queue_session_courts?.length > 0
            ? session.queue_session_courts
                .map((qsc: any) => qsc.courts?.name)
                .filter(Boolean)
                .join(', ')
            : session.metadata?.courts?.map((c: any) => c.name).join(', ') ||
              session.courts?.name ||
              'Unknown Court',
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
    };

    console.log('[getQueueSessionSummary] ✅ Summary fetched:', {
      participants: participantsSummary.length,
      matches: matchesSummary.length,
    });

    return { success: true, summary };
  } catch (error: any) {
    console.error('[getQueueSessionSummary] ❌ Error:', error);
    return { success: false, error: error.message || 'Failed to fetch session summary' };
  }
}
