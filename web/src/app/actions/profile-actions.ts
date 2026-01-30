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
 * Creates player record if it doesn't exist (handles cases where signup trigger failed)
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
    const { data: existingPlayer, error: selectError } = await supabase
      .from('players')
      .select('id, skill_level, skill_level_updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('[updatePlayerProfile] Error checking player record:', selectError)
      return { success: false, error: selectError.message }
    }

    let result
    let error

    if (!existingPlayer) {
      console.log('[updatePlayerProfile] Player record not found, creating new one')

      // Create new player record (requires INSERT policy to be applied)
      const insertResult = await supabase
        .from('players')
        .insert({
          user_id: user.id,
          birth_date: data.birthDate,
          gender: data.gender,
          skill_level: data.skillLevel,
          play_style: data.playStyle,
        })
        .select()

      error = insertResult.error
      result = insertResult.data

      if (error) {
        console.error('[updatePlayerProfile] Error creating player profile:', error)
        return {
          success: false,
          error: `Failed to create player profile: ${error.message}. Please ensure the database migration has been applied.`
        }
      }

      // Also assign default player role if not exists
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role_id: (await supabase.from('roles').select('id').eq('name', 'player').single()).data?.id
        })
        .select()
        .maybeSingle()

      if (roleError && !roleError.message.includes('duplicate')) {
        console.error('[updatePlayerProfile] Error assigning player role:', roleError)
        // Don't fail the entire operation if role assignment fails
      }
    } else {
      console.log('[updatePlayerProfile] Player record found, updating')

      // Skill level change restrictions
      if (data.skillLevel !== undefined && data.skillLevel !== existingPlayer.skill_level) {
        const oldLevel = existingPlayer.skill_level || 5
        const newLevel = data.skillLevel
        const levelDiff = Math.abs(newLevel - oldLevel)

        // Restriction 1: Can't change more than ±2 levels at once
        if (levelDiff > 2) {
          return {
            success: false,
            error: `Skill level can only be adjusted by ±2 levels at a time. Current: ${oldLevel}, Requested: ${newLevel}`
          }
        }

        // Restriction 2: 30-day cooldown between changes
        const lastChanged = existingPlayer.skill_level_updated_at
        if (lastChanged) {
          const daysSinceLastChange = Math.floor(
            (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24)
          )
          const cooldownDays = 30

          if (daysSinceLastChange < cooldownDays) {
            const daysRemaining = cooldownDays - daysSinceLastChange
            return {
              success: false,
              error: `Skill level can only be changed once every ${cooldownDays} days. You can change it again in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`
            }
          }
        }

        console.log('[updatePlayerProfile] Skill level change approved:', { oldLevel, newLevel, levelDiff })
      }

      // Update existing player data
      const updateData: any = {
        birth_date: data.birthDate,
        gender: data.gender,
        play_style: data.playStyle,
      }

      // Only update skill_level and timestamp if it's actually changing
      if (data.skillLevel !== undefined && data.skillLevel !== existingPlayer.skill_level) {
        updateData.skill_level = data.skillLevel
        updateData.skill_level_updated_at = new Date().toISOString()
      }

      const updateResult = await supabase
        .from('players')
        .update(updateData)
        .eq('user_id', user.id)
        .select()

      error = updateResult.error
      result = updateResult.data
    }

    if (error) {
      console.error('[updatePlayerProfile] Error updating player profile:', error)
      return { success: false, error: error.message }
    }

    console.log('[updatePlayerProfile] Successfully saved player profile:', result)

    // Revalidate profile-related paths
    revalidatePath('/profile')
    revalidatePath('/home')

    return { success: true }
  } catch (error: any) {
    console.error('[updatePlayerProfile] Unexpected error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}
