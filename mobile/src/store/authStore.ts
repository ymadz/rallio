/**
 * Authentication store using Zustand
 * Manages user session and profile state
 */

import { create } from 'zustand';
import { supabase } from '@/services/supabase';
import type { User } from '@supabase/supabase-js';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
};

type Player = {
  id: string;
  user_id: string;
  skill_level: number | null;
  play_style: string | null;
  preferred_position: string | null;
  bio: string | null;
  total_games_played: number;
  win_rate: number;
  current_elo: number;
  created_at: string;
  updated_at: string;
};

type AuthState = {
  user: User | null;
  profile: Profile | null;
  player: Player | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setPlayer: (player: Player | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  signOut: () => Promise<void>;
  loadSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  player: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setProfile: (profile) => set({ profile }),

  setPlayer: (player) => set({ player }),

  setIsLoading: (isLoading) => set({ isLoading }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, player: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      set({ isLoading: true });

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ user: null, profile: null, player: null, isAuthenticated: false, isLoading: false });
        return;
      }

      set({ user: session.user, isAuthenticated: true });

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        set({ profile });
      }

      // Fetch player
      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (player) {
        set({ player });
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
