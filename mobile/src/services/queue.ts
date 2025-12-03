/**
 * Queue service - mobile
 * Handles queue sessions, joining/leaving queues, real-time updates
 */

import { supabase } from './supabase';

/**
 * Get active queue sessions nearby
 */
export async function getActiveQueues(latitude?: number, longitude?: number, radiusKm: number = 10) {
  let query = supabase
    .from('queue_sessions')
    .select(`
      *,
      venue:venues (
        id,
        name,
        address,
        latitude,
        longitude
      ),
      queue_master:profiles!queue_sessions_queue_master_id_fkey (
        first_name,
        last_name,
        avatar_url
      ),
      queue_entries (
        id,
        player:players (
          id,
          user_id,
          skill_level,
          profiles (
            first_name,
            last_name,
            avatar_url
          )
        )
      )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  // If location provided, filter by distance
  if (latitude && longitude && data) {
    const filtered = data.filter((queue: any) => {
      if (!queue.venue.latitude || !queue.venue.longitude) return false;

      const distance = calculateDistance(
        latitude,
        longitude,
        queue.venue.latitude,
        queue.venue.longitude
      );

      return distance <= radiusKm;
    });

    return filtered;
  }

  return data;
}

/**
 * Get queue session by ID
 */
export async function getQueueById(queueId: string) {
  const { data, error } = await supabase
    .from('queue_sessions')
    .select(`
      *,
      venue:venues (*),
      queue_master:profiles!queue_sessions_queue_master_id_fkey (
        first_name,
        last_name,
        avatar_url
      ),
      queue_entries (
        *,
        player:players (
          id,
          user_id,
          skill_level,
          play_style,
          profiles (
            first_name,
            last_name,
            avatar_url
          )
        )
      )
    `)
    .eq('id', queueId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Join queue
 */
export async function joinQueue(queueId: string, playerId: string) {
  // 1. Check if already in queue
  const { data: existing } = await supabase
    .from('queue_entries')
    .select('id')
    .eq('queue_session_id', queueId)
    .eq('player_id', playerId)
    .maybeSingle();

  if (existing) {
    throw new Error('Already in queue');
  }

  // 2. Get queue to check capacity
  const queue = await getQueueById(queueId);
  if (queue.queue_entries.length >= queue.max_players) {
    throw new Error('Queue is full');
  }

  // 3. Add to queue
  const { data, error } = await supabase
    .from('queue_entries')
    .insert({
      queue_session_id: queueId,
      player_id: playerId,
      join_order: queue.queue_entries.length + 1,
      status: 'waiting',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Leave queue
 * Check if player has outstanding payments before leaving
 */
export async function leaveQueue(queueId: string, playerId: string) {
  // 1. Get queue entry
  const { data: entry, error: fetchError } = await supabase
    .from('queue_entries')
    .select('*, queue_session:queue_sessions(cost_per_game)')
    .eq('queue_session_id', queueId)
    .eq('player_id', playerId)
    .single();

  if (fetchError) throw fetchError;

  // 2. Check if player has played games and has unpaid balance
  const amountOwed = entry.games_played * (entry.queue_session?.cost_per_game || 0);
  const amountPaid = entry.amount_paid || 0;
  const balance = amountOwed - amountPaid;

  if (balance > 0) {
    throw new Error(`Cannot leave queue. You owe PHP ${balance.toFixed(2)}`);
  }

  // 3. Remove from queue
  const { error: deleteError } = await supabase
    .from('queue_entries')
    .delete()
    .eq('queue_session_id', queueId)
    .eq('player_id', playerId);

  if (deleteError) throw deleteError;
}

/**
 * Get player's queue status
 */
export async function getPlayerQueueStatus(playerId: string) {
  const { data, error } = await supabase
    .from('queue_entries')
    .select(`
      *,
      queue_session:queue_sessions (
        id,
        status,
        format,
        cost_per_game,
        venue:venues (
          name,
          address
        )
      )
    `)
    .eq('player_id', playerId)
    .eq('status', 'waiting')
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Subscribe to queue updates (real-time)
 */
export function subscribeToQueue(
  queueId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`queue:${queueId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queue_entries',
        filter: `queue_session_id=eq.${queueId}`,
      },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Helper: Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
