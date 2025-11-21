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
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Build update object
    const updateData: any = {
      profile_completed: true,
    }

    if (data) {
      if (data.displayName) updateData.display_name = data.displayName
      if (data.firstName) updateData.first_name = data.firstName
      if (data.lastName) updateData.last_name = data.lastName
      if (data.avatarUrl) updateData.avatar_url = data.avatarUrl
    }

    // Update profile in database
    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (error) {
      console.error('Error updating profile:', error)
      return { success: false, error: error.message }
    }

    // CRITICAL: Revalidate all paths that depend on profile_completed
    revalidatePath('/', 'layout') // Revalidate entire app
    revalidatePath('/home')
    revalidatePath('/setup-profile')

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error in completeProfile:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Server action to update player profile data
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
      return { success: false, error: 'Not authenticated' }
    }

    // Update player data
    const { error } = await supabase
      .from('players')
      .update({
        birth_date: data.birthDate,
        gender: data.gender,
        skill_level: data.skillLevel,
        play_style: data.playStyle,
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('Error updating player profile:', error)
      return { success: false, error: error.message }
    }

    // Revalidate profile-related paths
    revalidatePath('/profile')
    revalidatePath('/home')

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error in updatePlayerProfile:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}
