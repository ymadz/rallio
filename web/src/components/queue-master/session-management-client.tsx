'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getQueueDetails } from '@/app/actions/queue-actions';
import { closeQueueSession, removeParticipant } from '@/app/actions/queue-actions';
import {
  assignMatchFromQueue,
  recordMatchScore,
  getActiveMatch,
  startMatch,
  resetPlayerToWaiting,
  resetAllPlayersToWaiting,
} from '@/app/actions/match-actions';
import { PayMongoError } from '@/lib/paymongo/client';
import { initiatePaymentAction } from '@/app/actions/payments';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { StatusBadge } from '@/components/shared/status-badge';
import { QueueEventCard } from '@/components/queue/queue-event-card';
import type { QueueSession as QueueSessionHook } from '@/hooks/use-queue';
import {
  Users,
  Clock,
  PhilippinePeso,
  PlayCircle,
  StopCircle,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Trophy,
  Play,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { ScoreRecordingModal } from './score-recording-modal';
import { PaymentManagementModal } from './payment-management-modal';
import { MatchAssignmentModal } from './match-assignment-modal';
import { MatchTimer } from './match-timer';
import { MatchHistoryViewer } from '@/components/queue/match-history-viewer';
import { MatchStatusBadge } from './match-status-badge';
import { AutoAssignModal } from './auto-assign-modal';
import { useServerTime } from '@/hooks/use-server-time';

interface SessionManagementClientProps {
  sessionId: string;
  onSwitchToPlayerView?: () => void;
}

interface Participant {
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

interface QueueSession {
  id: string;
  courtId: string;
  courtName: string;
  venueName: string;
  status: string;
  currentPlayers: number;
  maxPlayers: number;
  costPerGame: number;
  startTime: Date;
  endTime: Date;
  mode: string;
  gameFormat: string;
  minSkillLevel?: number | null;
  maxSkillLevel?: number | null;
  players: Participant[];
  requiresApproval?: boolean;
  approvalStatus?: string;
  metadata?: any;
  queue_session_courts?: Array<{
    court_id: string;
    courts?: {
      name: string;
    };
  }>;
}

const resolveSkillRange = (
  sessionRow: any
): { minSkillLevel: number | null; maxSkillLevel: number | null } => {
  const meta = sessionRow?.metadata || {};

  let minSkillLevel =
    sessionRow?.min_skill_level ?? meta.min_skill_level ?? meta.minSkillLevel ?? null;
  let maxSkillLevel =
    sessionRow?.max_skill_level ?? meta.max_skill_level ?? meta.maxSkillLevel ?? null;

  // Fallback for older payload shapes that stored selected tiers in metadata.
  const tiers = Array.isArray(meta.allowed_skill_tiers) ? meta.allowed_skill_tiers : null;
  if ((minSkillLevel == null || maxSkillLevel == null) && tiers && tiers.length > 0) {
    const tierMap: Record<string, { min: number; max: number }> = {
      beginner: { min: 1, max: 3 },
      intermediate: { min: 4, max: 6 },
      advanced: { min: 7, max: 8 },
      elite: { min: 9, max: 10 },
    };

    const ranges = tiers.map((tier: string) => tierMap[String(tier).toLowerCase()]).filter(Boolean);

    if (ranges.length > 0) {
      minSkillLevel = Math.min(...ranges.map((r: { min: number; max: number }) => r.min));
      maxSkillLevel = Math.max(...ranges.map((r: { min: number; max: number }) => r.max));
    }
  }

  return {
    minSkillLevel: minSkillLevel != null ? Number(minSkillLevel) : null,
    maxSkillLevel: maxSkillLevel != null ? Number(maxSkillLevel) : null,
  };
};

const getSkillRequirementLabel = (min?: number | null, max?: number | null) => {
  if (min == null && max == null) return 'Open to All';
  const low = min ?? 1;
  const high = max ?? 10;

  const getTierName = (l: number) => {
    if (l <= 3) return 'Beginner';
    if (l <= 6) return 'Intermediate';
    if (l <= 8) return 'Advanced';
    return 'Elite';
  };

  if (low === 1 && high === 3) return 'Beginner Only';
  if (low === 4 && high === 6) return 'Intermediate Only';
  if (low === 7 && high === 8) return 'Advanced Only';
  if (low === 9 && high === 10) return 'Elite Only';

  const minTier = getTierName(low);
  const maxTier = getTierName(high);

  if (minTier === maxTier) return `${minTier} Only`;
  return `${minTier} - ${maxTier}`;
};

export function SessionManagementClient({
  sessionId,
  onSwitchToPlayerView,
}: SessionManagementClientProps) {
  const router = useRouter();
  const { date: serverDate } = useServerTime();
  const supabase = createClient();

  const [session, setSession] = useState<QueueSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal states
  const [showMatchAssignModal, setShowMatchAssignModal] = useState(false);
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'participants' | 'matches'>('participants');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [activeMatches, setActiveMatches] = useState<any[]>([]);

  // Close session confirmation modal state
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  // Action feedback (replaces browser alert/confirm/prompt)
  const [actionError, setActionError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; playerName: string } | null>(
    null
  );
  const [removeReason, setRemoveReason] = useState('');

  useEffect(() => {
    loadSession();

    const channel = supabase
      .channel(`queue-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_participants',
          filter: `queue_session_id=eq.${sessionId}`,
        },
        () => loadSession()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => loadSession()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `queue_session_id=eq.${sessionId}`,
        },
        () => loadSession()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const loadSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('queue_sessions')
        .select(
          `
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
        `
        )
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData) {
        throw new Error('Session not found');
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
        .eq('queue_session_id', sessionId)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (participantsError) {
        throw new Error('Failed to fetch participants');
      }

      const playerIds = participants?.map((p: any) => p.user_id) || [];
      const { data: players } = await supabase
        .from('players')
        .select('user_id, skill_level, rating')
        .in('user_id', playerIds);

      const playerSkillMap = new Map(players?.map((p: any) => [p.user_id, p.skill_level]) || []);
      const playerRatingMap = new Map(players?.map((p: any) => [p.user_id, p.rating]) || []);

      // Format participants
      const formattedParticipants: Participant[] = (participants || []).map(
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

      const { minSkillLevel, maxSkillLevel } = resolveSkillRange(sessionData);

      // Format session data
      const formattedSession: QueueSession = {
        id: sessionData.id,
        courtId: sessionData.court_id,
        courtName:
          sessionData.queue_session_courts?.length > 0
            ? sessionData.queue_session_courts
                .map((qsc: any) => qsc.courts?.name)
                .filter(Boolean)
                .join(', ')
            : sessionData.metadata?.courts?.map((c: any) => c.name).join(', ') ||
              sessionData.courts?.name ||
              'Unknown Court',
        venueName: sessionData.courts?.venues?.name || 'Unknown Venue',
        status: sessionData.status,
        currentPlayers: sessionData.current_players || formattedParticipants.length,
        maxPlayers: sessionData.max_players || 12,
        costPerGame: parseFloat(sessionData.cost_per_game || '0'),
        startTime: new Date(sessionData.start_time),
        endTime: new Date(sessionData.end_time),
        mode: sessionData.mode,
        gameFormat: sessionData.game_format,
        minSkillLevel,
        maxSkillLevel,
        players: formattedParticipants,
        metadata: sessionData.metadata,
        queue_session_courts: sessionData.queue_session_courts,
      };

      // Call centralized status auto-advancement to handle upcoming->open->active->completed
      await supabase.rpc('auto_advance_session_statuses');

      // Self-healing: if queue session is stuck in pending_payment but the linked reservation
      // is already confirmed/partially_paid, auto-fix the queue session status.
      if (sessionData.status === 'pending_payment' && sessionData.metadata?.reservation_id) {
        const { data: linkedRes } = await supabase
          .from('reservations')
          .select('status')
          .eq('id', sessionData.metadata.reservation_id)
          .single();

        if (linkedRes && ['confirmed', 'partially_paid', 'ongoing'].includes(linkedRes.status)) {
          console.log(
            '[loadSession] 🔧 Self-healing: reservation is',
            linkedRes.status,
            'but queue session stuck at pending_payment. Fixing...'
          );
          const now = new Date();
          const startTime = new Date(sessionData.start_time);
          const endTime = new Date(sessionData.end_time);

          let correctedStatus: string;
          if (now >= endTime) {
            correctedStatus = 'completed';
          } else if (now >= startTime) {
            correctedStatus = 'active';
          } else {
            correctedStatus = 'open';
          }

          await supabase
            .from('queue_sessions')
            .update({
              status: correctedStatus,
              metadata: {
                ...sessionData.metadata,
                payment_status: linkedRes.status === 'confirmed' ? 'paid' : 'partially_paid',
                self_healed_at: now.toISOString(),
              },
            })
            .eq('id', sessionData.id);

          formattedSession.status = correctedStatus;
          console.log('[loadSession] ✅ Queue session status corrected to:', correctedStatus);
        }
      }

      // Double check status after potential auto-advancement
      const { data: updatedSession } = await supabase
        .from('queue_sessions')
        .select('status')
        .eq('id', sessionData.id)
        .single();

      if (updatedSession) {
        formattedSession.status = updatedSession.status;
      }

      setSession(formattedSession);

      await loadActiveMatches();
    } catch (err: any) {
      console.error('[loadSession] Error:', err.message);
      setError(err.message || 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveMatches = async () => {
    try {
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(
          `
          *,
          courts (
            name
          )
        `
        )
        .eq('queue_session_id', sessionId)
        .in('status', ['scheduled', 'in_progress'])
        .order('created_at', { ascending: false });

      if (matches) {
        // Batch fetch all player profiles in one query instead of N separate queries
        const allPlayerIds = [
          ...new Set(
            matches.flatMap((m: any) => [...(m.team_a_players || []), ...(m.team_b_players || [])])
          ),
        ];
        const { data: allProfiles } =
          allPlayerIds.length > 0
            ? await supabase
                .from('profiles')
                .select('id, display_name, first_name, last_name, avatar_url')
                .in('id', allPlayerIds)
            : { data: [] };
        const profileMap = new Map((allProfiles || []).map((p: any) => [p.id, p]));
        const getPlayerInfo = (id: string) => {
          const player = profileMap.get(id) as any;
          return {
            id,
            name: player?.display_name || `${player?.first_name} ${player?.last_name}` || 'Unknown',
            avatarUrl: player?.avatar_url,
          };
        };
        const formattedMatches = matches.map((match: any) => ({
          ...match,
          teamAPlayers: (match.team_a_players || []).map(getPlayerInfo),
          teamBPlayers: (match.team_b_players || []).map(getPlayerInfo),
        }));
        setActiveMatches(formattedMatches);
      }
    } catch (err) {
      console.error('[loadActiveMatches] Error:', err);
    }
  };

  const handleClose = () => {
    setCloseError(null);
    setShowCloseConfirmModal(true);
  };

  const handleConfirmClose = async () => {
    setActionLoading('close');
    setCloseError(null);
    try {
      const result = await closeQueueSession(sessionId);
      if (!result.success) throw new Error(result.error);

      setShowCloseConfirmModal(false);
      // Immediately navigate to the queue session route where completed sessions
      // render the full summary view.
      router.push(`/queue/${sessionId}`);
    } catch (err: any) {
      setCloseError(err.message || 'Failed to close session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemovePlayer = (userId: string, playerName: string) => {
    setRemoveTarget({ userId, playerName });
    setRemoveReason('');
    setShowRemoveModal(true);
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget || !removeReason.trim()) return;
    setShowRemoveModal(false);
    setActionLoading(`remove-${removeTarget.userId}`);
    try {
      const result = await removeParticipant(sessionId, removeTarget.userId, removeReason.trim());
      if (!result.success) throw new Error(result.error);
      setRemoveTarget(null);
      setRemoveReason('');
      await loadSession();
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove player');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignMatch = () => {
    setShowMatchAssignModal(true);
  };

  const handleOpenScoreModal = (match: any) => {
    setSelectedMatch(match);
    setShowScoreModal(true);
  };

  const handleOpenPaymentModal = (participant: Participant) => {
    setSelectedParticipant(participant);
    setShowPaymentModal(true);
  };

  const handleModalSuccess = async () => {
    // Brief delay to ensure DB transaction from RPC is fully committed
    await new Promise((resolve) => setTimeout(resolve, 500));
    await loadSession();
  };

  const handleStartMatch = async (matchId: string) => {
    setActionLoading(`start-${matchId}`);
    try {
      const result = await startMatch(matchId);
      if (!result.success) throw new Error(result.error);
      await loadSession();
    } catch (err: any) {
      setActionError(err.message || 'Failed to start match');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayNow = async () => {
    if (!session?.metadata?.reservation_id) {
      setActionError('Payment information not found. Please contact support.');
      return;
    }

    setActionLoading('pay');
    try {
      const paymentMethod = session.metadata?.payment_method === 'paymaya' ? 'paymaya' : 'gcash';
      const result = await initiatePaymentAction(session.metadata.reservation_id, paymentMethod, {
        isMobile: Capacitor.isNativePlatform(),
      });
      if (!result.success || !result.checkoutUrl) {
        throw new Error(result.error || 'Failed to initiate payment');
      }

      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: result.checkoutUrl });
      } else {
        window.location.href = result.checkoutUrl;
      }
    } catch (err: any) {
      setActionError(err.message || 'Payment initiation failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Failed to Load Session</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  const waitingPlayers = session.players.filter((p) => p.status === 'waiting');
  const playingPlayers = session.players.filter((p) => p.status === 'playing');
  const totalRevenue = session.players.reduce(
    (sum, p) => sum + (p.paymentStatus === 'paid' ? p.amountOwed : 0),
    0
  );
  const totalGamesPlayed = session.players.reduce((sum, p) => sum + p.gamesPlayed, 0);

  // getStatusColor removed in favor of StatusBadge
  const getDisplayStatus = () => {
    const now = serverDate || new Date();
    const status = session.status;
    if (status === 'open' || status === 'active') {
      const isLive = new Date(session.startTime) <= now && new Date(session.endTime) > now;
      return isLive ? 'Live Now' : 'Open';
    }
    if (status === 'pending_payment') return 'Pending Payment';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getDisplayStatusKey = () => {
    const now = serverDate || new Date();
    const status = session.status;
    if (status === 'open' || status === 'active') {
      return new Date(session.startTime) <= now && new Date(session.endTime) > now
        ? 'live'
        : 'upcoming';
    }
    return status;
  };

  return (
    <div className="w-full">
      {actionError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-red-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Header — reuse the same glass-gradient event card as the player view */}
      <div className="mb-6 space-y-4">
        <QueueEventCard
          queue={{
            id: session.id,
            courtId: '',
            courtName: session.courtName,
            venueName: session.venueName,
            venueId: '',
            status: session.status as QueueSessionHook['status'],
            players: [],
            userPosition: null,
            maxPlayers: session.maxPlayers,
            currentPlayers: session.currentPlayers,
            startTime: session.startTime,
            endTime: session.endTime,
            mode: session.mode as 'casual' | 'competitive',
            costPerGame: session.costPerGame,
            minSkillLevel: session.minSkillLevel ?? null,
            maxSkillLevel: session.maxSkillLevel ?? null,
            organizerName: 'You',
          }}
          onBack={() => router.push('/bookings')}
          actionSlot={
            <>
              {session.status !== 'completed' && session.status !== 'cancelled' && (
                <>
                  <button
                    onClick={handleClose}
                    disabled={actionLoading === 'close'}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 bg-red-500/60 text-white/90 hover:bg-red-500/40 hover:text-white backdrop-blur-sm"
                  >
                    {actionLoading === 'close' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <StopCircle className="w-3.5 h-3.5" />
                    )}
                    Close Session
                  </button>
                </>
              )}
              {(session.status === 'completed' || session.status === 'cancelled') && (
                <Link
                  href="/bookings"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm transition-all"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  View Summary
                </Link>
              )}
            </>
          }
        >
          {/* Queue Master Controls inside the header */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/60 bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-lg">
              #{session.id.slice(0, 8)}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-sm text-white border border-white/20">
              {getDisplayStatus()}
            </span>
          </div>
        </QueueEventCard>

        {/* Payment Required Alert */}
        {session.status === 'pending_payment' && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <PhilippinePeso className="h-5 w-5 text-orange-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-orange-800">
                    Payment Required — Session Not Public
                  </h3>
                  <p className="mt-1 text-sm text-orange-700">
                    Your session is hidden from players until payment is completed. Pay the
                    remaining balance to make it public and allow players to join.
                    {session.metadata?.payment_required &&
                      ` Amount due: ₱${parseFloat(session.metadata.payment_required).toFixed(2)}`}
                  </p>
                  {session.metadata?.payment_method === 'cash' && (
                    <p className="mt-1 text-xs text-orange-600">
                      Cash payment — pay at the venue. The venue will activate your session once
                      payment is confirmed.
                    </p>
                  )}
                </div>
              </div>
              {session.metadata?.payment_method !== 'cash' && (
                <button
                  onClick={handlePayNow}
                  disabled={actionLoading === 'pay'}
                  className="ml-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading === 'pay' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Pay Now
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-blue-50" />
          <Users className="w-5 h-5 text-blue-500 mb-2 relative z-[1]" />
          <p className="text-2xl font-bold text-gray-900 leading-none mb-0.5">
            {session.currentPlayers}
            <span className="text-sm font-medium text-gray-400">/{session.maxPlayers}</span>
          </p>
          <p className="text-xs text-gray-500">Players</p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-amber-50" />
          <Clock className="w-5 h-5 text-amber-500 mb-2 relative z-[1]" />
          <p className="text-2xl font-bold text-amber-600 leading-none mb-0.5">
            {session.players.filter((p) => p.status === 'waiting').length}
          </p>
          <p className="text-xs text-gray-500">Waiting</p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-green-50" />
          <PlayCircle className="w-5 h-5 text-green-500 mb-2 relative z-[1]" />
          <p className="text-2xl font-bold text-green-600 leading-none mb-0.5">
            {session.players.filter((p) => p.status === 'playing').length}
          </p>
          <p className="text-xs text-gray-500">Playing</p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-purple-50" />
          <Trophy className="w-5 h-5 text-purple-500 mb-2 relative z-[1]" />
          <p className="text-2xl font-bold text-gray-900 leading-none mb-0.5">{totalGamesPlayed}</p>
          <p className="text-xs text-gray-500">Games</p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-emerald-50" />
          <PhilippinePeso className="w-5 h-5 text-emerald-500 mb-2 relative z-[1]" />
          <p className="text-2xl font-bold text-emerald-700 leading-none mb-0.5">
            ₱{totalRevenue.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Revenue</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Content Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-gray-100/50 border border-gray-200 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('participants')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'participants'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Participants
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'matches'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Match History
            </button>
          </div>

          {activeTab === 'participants' ? (
            <>
              {/* Active Matches */}
              {activeMatches.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Active Matches ({activeMatches.length})
                  </h2>
                  <div className="space-y-3">
                    {activeMatches.map((match) => (
                      <div
                        key={match.id}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          match.status === 'scheduled'
                            ? 'border-gray-200 bg-gray-50'
                            : match.status === 'in_progress'
                              ? 'border-green-200 bg-green-50 shadow-sm'
                              : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                                match.status === 'scheduled'
                                  ? 'bg-gray-600'
                                  : match.status === 'in_progress'
                                    ? 'bg-green-600 animate-pulse'
                                    : 'bg-blue-600'
                              }`}
                            >
                              <Trophy className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-gray-900">
                                  Match #{match.match_number}
                                </div>
                                {match.courts?.name && (
                                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {match.courts.name}
                                  </span>
                                )}
                              </div>
                              <MatchStatusBadge status={match.status} size="sm" />
                            </div>
                            {(match.status === 'in_progress' || match.status === 'completed') && (
                              <MatchTimer
                                startedAt={match.started_at}
                                completedAt={match.completed_at}
                                className="text-gray-600"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {match.status === 'scheduled' && (
                              <button
                                onClick={() => handleStartMatch(match.id)}
                                disabled={actionLoading === `start-${match.id}`}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
                              >
                                {actionLoading === `start-${match.id}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                                <span>Start Match</span>
                              </button>
                            )}
                            {match.status === 'in_progress' && (
                              <button
                                onClick={() => handleOpenScoreModal(match)}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
                              >
                                Record Winner
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 mt-1">
                          <div>
                            <div className="text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
                              Team A
                            </div>
                            <div className="space-y-1">
                              {match.teamAPlayers?.map((p: any) => (
                                <div
                                  key={p.id}
                                  className="text-sm font-medium text-gray-900 flex items-center gap-2"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  {p.name}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
                              Team B
                            </div>
                            <div className="space-y-1">
                              {match.teamBPlayers?.map((p: any) => (
                                <div
                                  key={p.id}
                                  className="text-sm font-medium text-gray-900 flex items-center gap-2"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  {p.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    Participants ({session.players.length})
                  </h2>
                  {(() => {
                    const now = serverDate || new Date();
                    const isStarted = new Date(session.startTime) <= now;
                    return (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowAutoAssignModal(true)}
                          disabled={
                            !isStarted ||
                            waitingPlayers.length < (session.gameFormat === 'doubles' ? 4 : 2)
                          }
                          title={!isStarted ? 'Session has not started yet' : undefined}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-bold text-sm"
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          <span>Auto-Assign</span>
                        </button>
                        <button
                          onClick={handleAssignMatch}
                          disabled={
                            !isStarted ||
                            waitingPlayers.length < (session.gameFormat === 'doubles' ? 4 : 2)
                          }
                          title={!isStarted ? 'Session has not started yet' : undefined}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-medium text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Assign Match</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Pre-start reminder */}
                {(() => {
                  const now = serverDate || new Date();
                  const sessionStart = new Date(session.startTime);
                  if (sessionStart > now) {
                    return (
                      <div className="mb-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm shadow-sm">
                        <Clock className="w-5 h-5 flex-shrink-0" />
                        <p>
                          Match assignments will be available once the session starts at{' '}
                          <span className="font-semibold">
                            {sessionStart.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                          . Players can join the queue in the meantime.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Doubles minimum-player notice */}
                {session.gameFormat === 'doubles' && waitingPlayers.length < 4 && (
                  <div className="mb-4 flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm shadow-sm">
                    <Users className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
                    <div>
                      <p className="font-semibold">Doubles — Minimum Players Required</p>
                      <p className="text-blue-700 mt-0.5">
                        A match cannot start until at least{' '}
                        <span className="font-semibold">4 players</span> are in the waiting queue (
                        {waitingPlayers.length} of 4 players joined).
                      </p>
                    </div>
                  </div>
                )}

                {/* Waiting Players */}
                {waitingPlayers.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Waiting ({waitingPlayers.length})
                    </h3>
                    <div className="space-y-2">
                      {waitingPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-lg hover:bg-white hover:border-primary/20 hover:shadow-md transition-all duration-200 group"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="relative inline-block w-10 h-10 shrink-0">
                              {player.avatarUrl ? (
                                <img
                                  src={player.avatarUrl}
                                  alt={player.playerName}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-primary group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                                  {player.playerName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-white shadow-sm z-10">
                                {player.position}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
                                  {player.playerName}
                                </div>
                                {player.rating && (
                                  <span className="px-2 py-0.5 bg-white text-gray-700 text-[10px] font-bold rounded-full border border-gray-200 shadow-sm">
                                    {player.rating} ELO
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-1.5">
                                <span className="font-medium text-primary/80">
                                  {player.gamesPlayed} played
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="font-semibold text-emerald-600">
                                  ₱{player.amountOwed.toFixed(0)} owed
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenPaymentModal(player)}
                              className={`px-3 py-1 text-xs font-bold rounded-full border shadow-sm transition-all hover:scale-105 active:scale-95 ${
                                player.paymentStatus === 'paid'
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : player.paymentStatus === 'partial'
                                    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                    : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-600 hover:text-white'
                              }`}
                              title="Manage payment"
                            >
                              <PhilippinePeso className="w-3 h-3 inline mr-0.5" />
                              {player.paymentStatus}
                            </button>
                          </div>
                          <button
                            onClick={() => handleRemovePlayer(player.userId, player.playerName)}
                            disabled={actionLoading === `remove-${player.userId}`}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50 ml-2"
                            title="Remove player"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Playing Players */}
                {playingPlayers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Playing ({playingPlayers.length})
                      </h3>
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="text-xs px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors font-bold shadow-sm"
                      >
                        Reset All to Queue
                      </button>
                    </div>
                    <div className="space-y-2">
                      {playingPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm group hover:bg-white hover:border-green-400 transition-all duration-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              {player.avatarUrl ? (
                                <img
                                  src={player.avatarUrl}
                                  alt={player.playerName}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-green-500 group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                                  {player.playerName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center border border-white shadow-sm">
                                <Play className="w-2 h-2 fill-current" />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-gray-900 group-hover:text-green-700">
                                  {player.playerName}
                                </div>
                                {player.rating && (
                                  <span className="px-2 py-0.5 bg-white text-gray-700 text-[10px] font-bold rounded-full border border-gray-200 shadow-sm">
                                    {player.rating} ELO
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-green-700 font-medium flex items-center gap-1.5">
                                <span>Currently playing</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              const result = await resetPlayerToWaiting(player.id, session.id);
                              if (result.success) {
                                loadSession();
                              } else {
                                setActionError('Reset failed: ' + result.error);
                              }
                            }}
                            title="Return this player to the waiting queue"
                            className="text-xs px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors font-bold shadow-sm"
                          >
                            Reset
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {session.players.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <Users className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">No Participants Yet</h3>
                    <p className="text-sm text-gray-500 max-w-[200px] mx-auto">
                      Players will appear here as they join the queue.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Completed Matches</h2>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
              </div>
              <MatchHistoryViewer sessionId={session.id} userId="" courtId="" isManager={true} />
            </div>
          )}
        </div>

        {/* Right: Session Details */}
        <div className="space-y-4">
          {/* Session Details Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-primary" />
              Session Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Mode</span>
                <span
                  className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                    session.mode === 'competitive'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {session.mode === 'competitive' ? 'Competitive' : 'Casual'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Format</span>
                <span className="font-medium text-gray-900 capitalize">{session.gameFormat}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Skill Requirement</span>
                {session.minSkillLevel != null || session.maxSkillLevel != null ? (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                    {getSkillRequirementLabel(session.minSkillLevel, session.maxSkillLevel)}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                    Open to All
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Cost/Game</span>
                <span className="font-semibold text-gray-900">₱{session.costPerGame}</span>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2 mb-2 text-gray-500 text-xs uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  Session Time
                </div>
                <div className="text-sm text-gray-900 font-medium">
                  {new Date(session.startTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                  {' – '}
                  {new Date(session.endTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {new Date(session.startTime).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Revenue</span>
                  <span className="text-base font-bold text-emerald-700">
                    ₱{totalRevenue.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {session && (
        <>
          {/* Close Session Confirmation Modal */}
          {showCloseConfirmModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <StopCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Close Session?</h2>
                      <p className="text-white/80 text-sm">
                        {session.courtName} · {session.venueName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-gray-700">
                      You are about to <strong>permanently close</strong> this queue session. This
                      will end all active matches and prevent new players from joining.
                    </p>
                    <p className="text-xs text-gray-500 mt-2">⚠️ This action cannot be undone.</p>
                  </div>

                  {/* Session quick stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-gray-900">
                        {session.players.length}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Players</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-gray-900">{totalGamesPlayed}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Games</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-gray-900">
                        ₱{totalRevenue.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Revenue</div>
                    </div>
                  </div>

                  {/* Error message */}
                  {closeError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{closeError}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowCloseConfirmModal(false);
                        setCloseError(null);
                      }}
                      disabled={actionLoading === 'close'}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmClose}
                      disabled={actionLoading === 'close'}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'close' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Closing...
                        </>
                      ) : (
                        <>
                          <StopCircle className="w-4 h-4" />
                          Close Session
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <MatchAssignmentModal
            isOpen={showMatchAssignModal}
            onClose={() => setShowMatchAssignModal(false)}
            sessionId={sessionId}
            sessionCourts={
              session.queue_session_courts && session.queue_session_courts.length > 0
                ? session.queue_session_courts.map((qsc: any) => ({
                    id: qsc.court_id,
                    name: qsc.courts?.name || 'Unknown Court',
                  }))
                : session.metadata?.courts || [{ id: session.courtId, name: session.courtName }]
            }
            waitingPlayers={waitingPlayers.map((p) => ({
              id: p.id,
              userId: p.userId,
              playerName: p.playerName,
              avatarUrl: p.avatarUrl,
              skillLevel: p.skillLevel,
              rating: p.rating,
              gamesPlayed: p.gamesPlayed,
              position: p.position,
            }))}
            gameFormat={session.gameFormat as 'singles' | 'doubles' | 'any'}
            onSuccess={handleModalSuccess}
          />

          <AutoAssignModal
            isOpen={showAutoAssignModal}
            onClose={() => setShowAutoAssignModal(false)}
            sessionId={sessionId}
            waitingPlayersCount={waitingPlayers.length}
            gameFormat={session.gameFormat as 'singles' | 'doubles' | 'any'}
            onSuccess={handleModalSuccess}
          />

          {selectedMatch && (
            <ScoreRecordingModal
              isOpen={showScoreModal}
              onClose={() => {
                setShowScoreModal(false);
                setSelectedMatch(null);
              }}
              match={{
                id: selectedMatch.id,
                matchNumber: selectedMatch.match_number,
                gameFormat: selectedMatch.game_format,
                teamAPlayers: selectedMatch.teamAPlayers || [],
                teamBPlayers: selectedMatch.teamBPlayers || [],
              }}
              sessionId={sessionId}
              onSuccess={handleModalSuccess}
            />
          )}

          {selectedParticipant && (
            <PaymentManagementModal
              isOpen={showPaymentModal}
              onClose={() => {
                setShowPaymentModal(false);
                setSelectedParticipant(null);
              }}
              participant={selectedParticipant}
              sessionId={sessionId}
              costPerGame={session.costPerGame}
              onSuccess={handleModalSuccess}
            />
          )}

          {/* Remove Player Modal */}
          {showRemoveModal && removeTarget && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Player</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Why are you removing{' '}
                  <span className="font-medium">{removeTarget.playerName}</span>?
                </p>
                <textarea
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  placeholder="Enter reason..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRemoveModal(false);
                      setRemoveTarget(null);
                    }}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRemove}
                    disabled={!removeReason.trim()}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset All Confirm Modal */}
          {showResetConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Reset All Playing Players?
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Move all {playingPlayers.length} currently playing player(s) back to the waiting
                  queue?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setShowResetConfirm(false);
                      const result = await resetAllPlayersToWaiting(session.id);
                      if (result.success) {
                        loadSession();
                      } else {
                        setActionError('Reset failed: ' + result.error);
                      }
                    }}
                    className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                  >
                    Reset All
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
