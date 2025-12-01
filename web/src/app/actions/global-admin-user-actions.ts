'use server'

import { createClient } from '@/lib/supabase/server'
import { logAdminAction } from './global-admin-actions'

// Helper to verify global admin role
async function verifyGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner (name)')
    .eq('user_id', user.id)

  const isGlobalAdmin = roles?.some((r: any) => r.roles?.name === 'global_admin')
  
  if (!isGlobalAdmin) {
    return { success: false, error: 'Unauthorized: Global admin access required' }
  }

  return { success: true, user }
}

// Get all users with filters, search, and pagination
export async function getAllUsers(options: {
  page?: number
  pageSize?: number
  search?: string
  roleFilter?: string
  statusFilter?: 'all' | 'active' | 'banned'
} = {}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()
  const page = options.page || 1
  const pageSize = options.pageSize || 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('profiles')
    .select(`
      id,
      email,
      display_name,
      avatar_url,
      created_at,
      is_banned,
      is_active,
      banned_reason,
      banned_until
    `, { count: 'exact' })

  // Search filter
  if (options.search) {
    query = query.or(`email.ilike.%${options.search}%,display_name.ilike.%${options.search}%`)
  }

  // Status filter
  if (options.statusFilter === 'banned') {
    query = query.eq('is_banned', true)
  } else if (options.statusFilter === 'active') {
    query = query.eq('is_banned', false)
  }

  // Pagination
  query = query.range(from, to).order('created_at', { ascending: false })

  const { data: users, error, count } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  // Fetch roles separately for all users
  const userIds = users?.map(u => u.id) || []
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      roles:role_id (
        id,
        name
      )
    `)
    .in('user_id', userIds)

  // Attach roles to users
  const usersWithRoles = (users || []).map((user: any) => ({
    ...user,
    user_roles: userRoles?.filter(ur => ur.user_id === user.id) || []
  }))

  // Filter by role if needed
  let filteredUsers = usersWithRoles
  if (options.roleFilter && options.roleFilter !== 'all') {
    filteredUsers = usersWithRoles.filter((user: any) => 
      user.user_roles?.some((ur: any) => ur.roles?.name === options.roleFilter)
    )
  }

  return {
    success: true,
    users: filteredUsers,
    totalCount: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize)
  }
}

// Get detailed user information
export async function getUserDetails(userId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { data: user, error } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      display_name,
      avatar_url,
      created_at,
      updated_at,
      is_banned,
      banned_reason,
      banned_until,
      banned_by,
      banned_at
    `)
    .eq('id', userId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fetch roles separately
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      roles:role_id (
        id,
        name,
        description
      )
    `)
    .eq('user_id', userId)

  // Get player stats if they have a player profile
  const { data: playerStats } = await supabase
    .from('players')
    .select('skill_level, rating, total_games_played, total_wins')
    .eq('user_id', userId)
    .single()

  // Get recent activity from audit logs
  const { data: recentActivity } = await supabase
    .from('admin_audit_logs')
    .select('action_type, created_at, old_value, new_value')
    .eq('target_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    success: true,
    user: {
      ...user,
      user_roles: userRoles || [],
      playerStats,
      recentActivity: recentActivity || []
    }
  }
}

// Assign role to user
export async function assignUserRole(userId: string, roleName: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get role ID
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single()

  if (roleError || !role) {
    return { success: false, error: 'Role not found' }
  }

  // Check if user already has this role
  const { data: existing } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('role_id', role.id)
    .single()

  if (existing) {
    return { success: false, error: 'User already has this role' }
  }

  // Assign role
  const { error: insertError } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      role_id: role.id
    })

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'assign_role',
    targetType: 'user',
    targetId: userId,
    newValue: { role: roleName }
  })

  return { success: true, message: `Role ${roleName} assigned successfully` }
}

// Remove role from user
export async function removeUserRole(userId: string, roleName: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get role ID
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single()

  if (roleError || !role) {
    return { success: false, error: 'Role not found' }
  }

  // Remove role
  const { error: deleteError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', role.id)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'remove_role',
    targetType: 'user',
    targetId: userId,
    oldValue: { role: roleName }
  })

  return { success: true, message: `Role ${roleName} removed successfully` }
}

// Ban user permanently
export async function banUser(userId: string, reason: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get user's current state for audit
  const { data: currentUser } = await supabase
    .from('profiles')
    .select('is_banned, banned_reason')
    .eq('id', userId)
    .single()

  // Update user
  const { error } = await supabase
    .from('profiles')
    .update({
      is_banned: true,
      banned_reason: reason,
      banned_until: null, // null = permanent
      banned_by: auth.user!.id,
      banned_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'ban_user',
    targetType: 'user',
    targetId: userId,
    oldValue: { is_banned: currentUser?.is_banned, banned_reason: currentUser?.banned_reason },
    newValue: { is_banned: true, banned_reason: reason, permanent: true }
  })

  return { success: true, message: 'User banned successfully' }
}

// Suspend user temporarily
export async function suspendUser(userId: string, reason: string, durationDays: number) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const bannedUntil = new Date()
  bannedUntil.setDate(bannedUntil.getDate() + durationDays)

  // Get user's current state for audit
  const { data: currentUser } = await supabase
    .from('profiles')
    .select('is_banned, banned_reason, banned_until')
    .eq('id', userId)
    .single()

  // Update user
  const { error } = await supabase
    .from('profiles')
    .update({
      is_banned: true,
      banned_reason: reason,
      banned_until: bannedUntil.toISOString(),
      banned_by: auth.user!.id,
      banned_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'suspend_user',
    targetType: 'user',
    targetId: userId,
    oldValue: { 
      is_banned: currentUser?.is_banned, 
      banned_reason: currentUser?.banned_reason,
      banned_until: currentUser?.banned_until
    },
    newValue: { 
      is_banned: true, 
      banned_reason: reason, 
      banned_until: bannedUntil.toISOString(),
      duration_days: durationDays
    }
  })

  return { 
    success: true, 
    message: `User suspended for ${durationDays} days`,
    bannedUntil: bannedUntil.toISOString()
  }
}

// Unban user
export async function unbanUser(userId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get user's current state for audit
  const { data: currentUser } = await supabase
    .from('profiles')
    .select('is_banned, banned_reason, banned_until')
    .eq('id', userId)
    .single()

  // Update user
  const { error } = await supabase
    .from('profiles')
    .update({
      is_banned: false,
      banned_reason: null,
      banned_until: null,
      banned_by: null,
      banned_at: null
    })
    .eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'unban_user',
    targetType: 'user',
    targetId: userId,
    oldValue: {
      is_banned: currentUser?.is_banned,
      banned_reason: currentUser?.banned_reason,
      banned_until: currentUser?.banned_until
    },
    newValue: { is_banned: false }
  })

  return { success: true, message: 'User unbanned successfully' }
}

// Create new user
export async function createUser(data: {
  email: string
  password: string
  displayName: string
  phone?: string
  avatarUrl?: string
  roles?: string[]
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  // Import service client dynamically to avoid errors if env var not set
  const { createServiceClient } = await import('@/lib/supabase/server')
  const serviceClient = createServiceClient()

  // Create auth user using service role client
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      display_name: data.displayName
    }
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message || 'Failed to create user' }
  }

  // Wait a bit for profile trigger to complete, then update profile
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const { error: profileError } = await serviceClient
    .from('profiles')
    .update({
      display_name: data.displayName,
      phone: data.phone,
      avatar_url: data.avatarUrl
    })
    .eq('id', authData.user.id)

  if (profileError) {
    console.error('Profile update error:', profileError)
    // Don't fail the entire operation if profile update fails
    // The profile was created by trigger, we just couldn't update it yet
  }

  // Assign roles (default to 'player' if none specified)
  const rolesToAssign = data.roles && data.roles.length > 0 ? data.roles : ['player']
  
  if (rolesToAssign.length > 0) {
    const { data: roles } = await serviceClient
      .from('roles')
      .select('id, name')
      .in('name', rolesToAssign)

    if (roles && roles.length > 0) {
      const roleInserts = roles.map(role => ({
        user_id: authData.user.id,
        role_id: role.id
      }))

      await serviceClient.from('user_roles').insert(roleInserts)
    }
  }

  // Log the action
  await logAdminAction({
    actionType: 'create_user',
    targetType: 'user',
    targetId: authData.user.id,
    newValue: { email: data.email, display_name: data.displayName, roles: rolesToAssign }
  })

  return { success: true, message: 'User created successfully', userId: authData.user.id }
}

// Update user profile
export async function updateUserProfile(userId: string, data: {
  displayName?: string
  phone?: string
  avatarUrl?: string
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get current profile for audit
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('display_name, phone, avatar_url')
    .eq('id', userId)
    .single()

  // Update profile
  const { error } = await supabase
    .from('profiles')
    .update({
      ...(data.displayName && { display_name: data.displayName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.avatarUrl !== undefined && { avatar_url: data.avatarUrl })
    })
    .eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'update_user',
    targetType: 'user',
    targetId: userId,
    oldValue: currentProfile,
    newValue: data
  })

  return { success: true, message: 'User profile updated successfully' }
}

// Update player profile
export async function updatePlayerProfile(userId: string, data: {
  birthDate?: string
  gender?: string
  skillLevel?: number
  playStyle?: string
  bio?: string
}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Check if player profile exists
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!existingPlayer) {
    // Create player profile if doesn't exist
    const { error: insertError } = await supabase
      .from('players')
      .insert({
        user_id: userId,
        birth_date: data.birthDate,
        gender: data.gender,
        skill_level: data.skillLevel,
        play_style: data.playStyle,
        bio: data.bio
      })

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  } else {
    // Update existing player profile
    const { error: updateError } = await supabase
      .from('players')
      .update({
        ...(data.birthDate !== undefined && { birth_date: data.birthDate }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.skillLevel !== undefined && { skill_level: data.skillLevel }),
        ...(data.playStyle !== undefined && { play_style: data.playStyle }),
        ...(data.bio !== undefined && { bio: data.bio }),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }
  }

  // Log the action
  await logAdminAction({
    actionType: 'update_player_profile',
    targetType: 'user',
    targetId: userId,
    oldValue: existingPlayer,
    newValue: data
  })

  return { success: true, message: 'Player profile updated successfully' }
}

// Verify player badge
export async function verifyPlayer(userId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { error } = await supabase
    .from('players')
    .update({ verified_player: true })
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'verify_player',
    targetType: 'user',
    targetId: userId,
    newValue: { verified_player: true }
  })

  return { success: true, message: 'Player verified successfully' }
}

// Unverify player badge
export async function unverifyPlayer(userId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { error } = await supabase
    .from('players')
    .update({ verified_player: false })
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'unverify_player',
    targetType: 'user',
    targetId: userId,
    newValue: { verified_player: false }
  })

  return { success: true, message: 'Player verification removed' }
}

// Reset user password
export async function resetUserPassword(userId: string, newPassword: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action (don't log the actual password)
  await logAdminAction({
    actionType: 'reset_password',
    targetType: 'user',
    targetId: userId,
    newValue: { password_reset: true }
  })

  return { success: true, message: 'Password reset successfully' }
}

// Deactivate user account
export async function deactivateUser(userId: string, reason: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  // Get current user data for audit log
  const { data: oldUser } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', userId)
    .single()

  // Deactivate the user
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'deactivate_user',
    targetType: 'user',
    targetId: userId,
    oldValue: { is_active: oldUser?.is_active },
    newValue: { is_active: false, reason }
  })

  return { success: true, message: 'User account deactivated' }
}

// Reactivate user account
export async function reactivateUser(userId: string) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: true })
    .eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Log the action
  await logAdminAction({
    actionType: 'reactivate_user',
    targetType: 'user',
    targetId: userId,
    newValue: { is_active: true }
  })

  return { success: true, message: 'User account reactivated' }
}
