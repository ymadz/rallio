'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types matching web app's queue system
export interface QueueParticipant {
    id: string;
    oderId: string;
    playerName: string;
    avatarUrl?: string;
    skillLevel: number;
    position: number;
    joinedAt: Date;
    gamesPlayed: number;
    gamesWon: number;
    status: 'waiting' | 'playing' | 'completed' | 'left';
    amountOwed: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
}

export interface QueueSession {
    id: string;
    courtId: string;
    courtName: string;
    venueName: string;
    venueId: string;
    status: 'draft' | 'open' | 'active' | 'paused' | 'closed' | 'cancelled';
    currentPlayers: number;
    maxPlayers: number;
    costPerGame: number;
    startTime: Date;
    endTime: Date;
    mode: 'casual' | 'competitive';
    gameFormat: 'singles' | 'doubles' | 'mixed';
    players?: QueueParticipant[];
    userPosition?: number | null;
    estimatedWaitTime?: number;
}

export interface ActiveMatch {
    id: string;
    matchNumber: number;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    teamAPlayers: string[];
    teamBPlayers: string[];
    scoreA?: number;
    scoreB?: number;
    winner?: 'team_a' | 'team_b' | 'draw';
    startedAt?: Date;
    courtName?: string;
    queueSessionId: string;
}

interface QueueState {
    // Nearby queues for discovery
    nearbyQueues: QueueSession[];
    isLoadingNearby: boolean;

    // User's active queue memberships
    myQueues: QueueSession[];
    isLoadingMyQueues: boolean;

    // Current queue details (when viewing)
    currentQueue: QueueSession | null;
    isLoadingQueue: boolean;

    // Active match (when playing)
    activeMatch: ActiveMatch | null;
    isLoadingMatch: boolean;

    // Join/leave state
    isJoining: boolean;
    isLeaving: boolean;

    // Payment state
    showPaymentModal: boolean;
    pendingPayment: {
        sessionId: string;
        amountOwed: number;
        gamesPlayed: number;
    } | null;

    // Error state
    error: string | null;

    // Actions
    setNearbyQueues: (queues: QueueSession[]) => void;
    setMyQueues: (queues: QueueSession[]) => void;
    setCurrentQueue: (queue: QueueSession | null) => void;
    setActiveMatch: (match: ActiveMatch | null) => void;
    setIsJoining: (joining: boolean) => void;
    setIsLeaving: (leaving: boolean) => void;
    setError: (error: string | null) => void;
    showPayment: (sessionId: string, amountOwed: number, gamesPlayed: number) => void;
    hidePayment: () => void;
    updateUserPosition: (sessionId: string, position: number) => void;
    addParticipant: (sessionId: string, participant: QueueParticipant) => void;
    removeParticipant: (sessionId: string, oderId: string) => void;
    reset: () => void;
}

const initialState = {
    nearbyQueues: [],
    isLoadingNearby: false,
    myQueues: [],
    isLoadingMyQueues: false,
    currentQueue: null,
    isLoadingQueue: false,
    activeMatch: null,
    isLoadingMatch: false,
    isJoining: false,
    isLeaving: false,
    showPaymentModal: false,
    pendingPayment: null,
    error: null,
};

export const useQueueStore = create<QueueState>()(
    persist(
        (set, get) => ({
            ...initialState,

            setNearbyQueues: (queues) => set({ nearbyQueues: queues, isLoadingNearby: false }),

            setMyQueues: (queues) => set({ myQueues: queues, isLoadingMyQueues: false }),

            setCurrentQueue: (queue) => set({ currentQueue: queue, isLoadingQueue: false }),

            setActiveMatch: (match) => set({ activeMatch: match, isLoadingMatch: false }),

            setIsJoining: (joining) => set({ isJoining: joining }),

            setIsLeaving: (leaving) => set({ isLeaving: leaving }),

            setError: (error) => set({ error }),

            showPayment: (sessionId, amountOwed, gamesPlayed) =>
                set({
                    showPaymentModal: true,
                    pendingPayment: { sessionId, amountOwed, gamesPlayed },
                }),

            hidePayment: () =>
                set({
                    showPaymentModal: false,
                    pendingPayment: null,
                }),

            updateUserPosition: (sessionId, position) => {
                const { currentQueue, myQueues } = get();

                // Update current queue if matches
                if (currentQueue?.id === sessionId) {
                    set({
                        currentQueue: {
                            ...currentQueue,
                            userPosition: position,
                            estimatedWaitTime: position * 15,
                        },
                    });
                }

                // Update in myQueues array
                const updatedMyQueues = myQueues.map((q) =>
                    q.id === sessionId
                        ? { ...q, userPosition: position, estimatedWaitTime: position * 15 }
                        : q
                );
                set({ myQueues: updatedMyQueues });
            },

            addParticipant: (sessionId, participant) => {
                const { currentQueue } = get();

                if (currentQueue?.id === sessionId && currentQueue.players) {
                    set({
                        currentQueue: {
                            ...currentQueue,
                            players: [...currentQueue.players, participant],
                            currentPlayers: currentQueue.currentPlayers + 1,
                        },
                    });
                }
            },

            removeParticipant: (sessionId, oderId) => {
                const { currentQueue } = get();

                if (currentQueue?.id === sessionId && currentQueue.players) {
                    set({
                        currentQueue: {
                            ...currentQueue,
                            players: currentQueue.players.filter((p) => p.oderId !== oderId),
                            currentPlayers: Math.max(0, currentQueue.currentPlayers - 1),
                        },
                    });
                }
            },

            reset: () => set(initialState),
        }),
        {
            name: 'queue-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                // Only persist minimal data - queues should be refreshed on app load
                myQueues: state.myQueues.map((q) => ({
                    id: q.id,
                    courtId: q.courtId,
                    courtName: q.courtName,
                    venueName: q.venueName,
                    status: q.status,
                    userPosition: q.userPosition,
                })),
            }),
        }
    )
);
