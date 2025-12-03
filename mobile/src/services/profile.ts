/**
 * Profile service - mobile
 * Handles profile updates, stats, match history
 */

import { supabase } from './supabase';
import { uploadAvatar } from './auth';

export type UpdateProfileData = {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatarUri?: string;
};

export type UpdatePlayerData = {
  skillLevel?: number;
  playStyle?: string;
  preferredPosition?: string;
  bio?: string;
};

/**
 * Get user profile with player details
 */
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      player:players (
        id,
        skill_level,
        play_style,
        preferred_position,
        bio,
        current_rating,
        total_games,
        wins,
        losses
      )
    `)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update profile
 */
export async function updateProfile(userId: string, data: UpdateProfileData) {
  let avatarUrl: string | undefined;

  // Upload new avatar if provided
  if (data.avatarUri) {
    avatarUrl = await uploadAvatar(userId, data.avatarUri);
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      phone_number: data.phoneNumber,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Update player details
 */
export async function updatePlayer(userId: string, data: UpdatePlayerData) {
  const { error } = await supabase
    .from('players')
    .update({
      skill_level: data.skillLevel,
      play_style: data.playStyle,
      preferred_position: data.preferredPosition,
      bio: data.bio,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Get player match history
 */
export async function getMatchHistory(playerId: string, limit: number = 20) {
  const { data, error } = await supabase
    .from('match_participants')
    .select(`
      *,
      match:matches (
        id,
        match_date,
        format,
        winning_team,
        venue:venues (
          name,
          address
        ),
        queue_session:queue_sessions (
          id,
          format
        )
      )
    `)
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Get player statistics
 */
export async function getPlayerStats(playerId: string) {
  const { data, error } = await supabase
    .from('players')
    .select(`
      total_games,
      wins,
      losses,
      current_rating,
      rating_history
    `)
    .eq('id', playerId)
    .single();

  if (error) throw error;

  const winRate = data.total_games > 0 ? (data.wins / data.total_games) * 100 : 0;

  return {
    ...data,
    winRate,
  };
}

/**
 * Get rating history for chart
 */
export async function getRatingHistory(playerId: string) {
  const { data, error } = await supabase
    .from('player_ratings')
    .select('rating, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get favorite venues (most played)
 */
export async function getFavoriteVenues(playerId: string) {
  const { data, error } = await supabase
    .from('match_participants')
    .select(`
      match:matches (
        venue:venues (
          id,
          name,
          address
        )
      )
    `)
    .eq('player_id', playerId);

  if (error) throw error;

  // Count venue frequency
  const venueCounts: Record<string, { venue: any; count: number }> = {};

  data.forEach((item: any) => {
    const venue = item.match?.venue;
    if (venue) {
      if (!venueCounts[venue.id]) {
        venueCounts[venue.id] = { venue, count: 0 };
      }
      venueCounts[venue.id].count++;
    }
  });

  // Sort by count and return top 5
  return Object.values(venueCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
