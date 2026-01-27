import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

// SSR-safe storage adapter for Zustand
const getZustandStorage = (): StateStorage => {
    // Server-side rendering - return no-op storage
    if (typeof window === 'undefined') {
        return {
            getItem: () => null,
            setItem: () => { },
            removeItem: () => { },
        };
    }
    // Web browser - use localStorage
    if (Platform.OS === 'web') {
        return {
            getItem: (name: string) => localStorage.getItem(name),
            setItem: (name: string, value: string) => localStorage.setItem(name, value),
            removeItem: (name: string) => localStorage.removeItem(name),
        };
    }
    // Native platforms - use AsyncStorage
    return AsyncStorage;
};

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    profile_completed: boolean;
}

interface Player {
    id: string;
    user_id: string;
    skill_level: number | null;
    play_style: string | null;
    rating: number;
    total_games_played: number;
    total_wins: number;
}

interface AuthState {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    player: Player | null;
    isLoading: boolean;
    isInitialized: boolean;
}

interface AuthActions {
    initialize: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, metadata: { firstName: string; lastName: string; phone?: string }) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    setSession: (session: Session | null) => void;
    fetchProfile: () => Promise<void>;
    updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            // State
            user: null,
            session: null,
            profile: null,
            player: null,
            isLoading: true,
            isInitialized: false,

            // Actions
            initialize: async () => {
                try {
                    const { data: { session } } = await supabase.auth.getSession();

                    if (session) {
                        set({
                            session,
                            user: session.user,
                            isLoading: true,
                        });
                        await get().fetchProfile();
                    }

                    set({ isInitialized: true, isLoading: false });

                    // Listen for auth changes
                    supabase.auth.onAuthStateChange(async (event, session) => {
                        set({ session, user: session?.user ?? null });

                        if (session) {
                            await get().fetchProfile();
                        } else {
                            set({ profile: null, player: null });
                        }
                    });
                } catch (error) {
                    console.error('Auth initialization error:', error);
                    set({ isInitialized: true, isLoading: false });
                }
            },

            signIn: async (email, password) => {
                set({ isLoading: true });

                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) {
                    set({ isLoading: false });
                    return { error };
                }

                set({
                    session: data.session,
                    user: data.user,
                });

                await get().fetchProfile();
                set({ isLoading: false });

                return { error: null };
            },

            signUp: async (email, password, metadata) => {
                set({ isLoading: true });

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: metadata.firstName,
                            last_name: metadata.lastName,
                            phone: metadata.phone,
                        },
                    },
                });

                if (error) {
                    set({ isLoading: false });
                    return { error };
                }

                // Note: Database trigger creates profile and player records
                if (data.session) {
                    set({
                        session: data.session,
                        user: data.user,
                    });
                    await get().fetchProfile();
                }

                set({ isLoading: false });
                return { error: null };
            },

            signOut: async () => {
                set({ isLoading: true });
                await supabase.auth.signOut();
                set({
                    user: null,
                    session: null,
                    profile: null,
                    player: null,
                    isLoading: false,
                });
            },

            setSession: (session) => {
                set({ session, user: session?.user ?? null });
            },

            fetchProfile: async () => {
                const user = get().user;
                if (!user) return;

                try {
                    // Fetch profile
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    // Fetch player data
                    const { data: player } = await supabase
                        .from('players')
                        .select('*')
                        .eq('user_id', user.id)
                        .single();

                    set({ profile, player });
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            },

            updateProfile: async (data) => {
                const user = get().user;
                if (!user) return { error: new Error('Not authenticated') };

                const { error } = await supabase
                    .from('profiles')
                    .update(data)
                    .eq('id', user.id);

                if (!error) {
                    set((state) => ({
                        profile: state.profile ? { ...state.profile, ...data } : null,
                    }));
                }

                return { error };
            },
        }),
        {
            name: 'rallio-auth',
            storage: createJSONStorage(() => getZustandStorage()),
            partialize: (state) => ({
                // Only persist essential auth data
                user: state.user,
                profile: state.profile,
                player: state.player,
            }),
        }
    )
);
