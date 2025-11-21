'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Server action to mark a user's profile as completed
 * This invalidates the cache to ensure immediate UI updates
 */
export async function completeProfile(data?: {
  displayName?: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  phone?: string
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('[completeProfile] Not authenticated')
      return { success: false, error: 'Not authenticated' }
    }

    console.log('[completeProfile] Completing profile for user:', user.id, data)

    // Build update object
    const updateData: any = {
      profile_completed: true,
    }

    if (data) {
      if (data.displayName) updateData.display_name = data.displayName
      if (data.firstName) updateData.first_name = data.firstName
      if (data.lastName) updateData.last_name = data.lastName
      if (data.avatarUrl) updateData.avatar_url = data.avatarUrl
      if (data.phone) updateData.phone = data.phone
    }

    console.log('[completeProfile] Update data:', updateData)

    // Update profile in database
    const { error, data: result } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()

    if (error) {
      console.error('[completeProfile] Error updating profile:', error)
      return { success: false, error: error.message }
    }

    console.log('[completeProfile] Successfully updated profile:', result)

    // CRITICAL: Revalidate all paths that depend on profile_completed
    revalidatePath('/', 'layout') // Revalidate entire app
    revalidatePath('/home')
    revalidatePath('/setup-profile')

    return { success: true }
  } catch (error: any) {
    console.error('[completeProfile] Unexpected error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server action to update player profile data
 * Note: Player record should be created by database trigger on signup
 */
export async function updatePlayerProfile(data: {
  birthDate?: Date
  gender?: string
  skillLevel?: number
  playStyle?: string
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('[updatePlayerProfile] Not authenticated')
      return { success: false, error: 'Not authenticated' }
    }

    console.log('[updatePlayerProfile] Updating player profile for user:', user.id, data)

    // First check if player record exists
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!existingPlayer) {
      console.error('[updatePlayerProfile] Player record not found for user:', user.id)
      // Player record should have been created by database trigger
      // If it doesn't exist, we can't create it due to RLS policy
      return { success: false, error: 'Player profile not initialized. Please contact support.' }
    }

    // Update existing player data
    const { error, data: result } = await supabase
      .from('players')
      .update({
        birth_date: data.birthDate,
        gender: data.gender,
        skill_level: data.skillLevel,
        play_style: data.playStyle,
      })
      .eq('user_id', user.id)
      .select()

    if (error) {
      console.error('[updatePlayerProfile] Error updating player profile:', error)
      return { success: false, error: error.message }
    }

    console.log('[updatePlayerProfile] Successfully updated player profile:', result)

    // Revalidate profile-related paths
    revalidatePath('/profile')
    revalidatePath('/home')

    return { success: true }
  } catch (error: any) {
    console.error('[updatePlayerProfile] Unexpected error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}
