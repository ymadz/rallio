import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Role priority order (highest first)
const ROLE_PRIORITY = ['global_admin', 'court_admin', 'queue_master', 'player'] as const

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  console.log('🔍 [Auth Callback] Received callback')
  console.log('🔍 [Auth Callback] Code:', code ? 'present' : 'missing')
  console.log('🔍 [Auth Callback] Error:', error)
  console.log('🔍 [Auth Callback] Error Description:', errorDescription)

  // Handle OAuth errors
  if (error) {
    console.error('❌ [Auth Callback] OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription || error)}`)
  }

  if (code) {
    // Use regular server client for code exchange (needs cookie access for PKCE)
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    console.log('🔍 [Auth Callback] Exchange result:', {
      hasError: !!error,
      errorMessage: error?.message,
      hasUser: !!data?.user,
      userId: data?.user?.id,
      userEmail: data?.user?.email,
      isNewUser: data?.user?.created_at === data?.user?.updated_at
    })

    if (error) {
      console.error('❌ [Auth Callback] Session exchange error:', error)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    if (!error && data.user) {
      // Check if profile was created
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, display_name, profile_completed')
        .eq('id', data.user.id)
        .single()

      console.log('🔍 [Auth Callback] Profile check:', {
        hasProfile: !!profile,
        profileError: profileError?.message,
        profileData: profile
      })

      // Check if player was created
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, user_id')
        .eq('user_id', data.user.id)
        .single()

      console.log('🔍 [Auth Callback] Player check:', {
        hasPlayer: !!player,
        playerError: playerError?.message
      })

      // WORKAROUND: If profile doesn't exist (trigger disabled), create it manually
      if (!profile) {
        console.log('🔍 [Auth Callback] Profile not found, creating manually...')
        
        const userMetadata = data.user.user_metadata || {}
        const email = data.user.email || ''
        
        // Create profile
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: email,
            display_name: userMetadata.full_name || userMetadata.name || email.split('@')[0],
            first_name: userMetadata.given_name || null,
            last_name: userMetadata.family_name || null,
            avatar_url: userMetadata.avatar_url || userMetadata.picture || null
          })
        
        if (profileInsertError) {
          console.error('❌ [Auth Callback] Failed to create profile:', profileInsertError)
        } else {
          console.log('✅ [Auth Callback] Profile created successfully')
        }
      }

      // WORKAROUND: If player doesn't exist, create it manually
      if (!player) {
        console.log('🔍 [Auth Callback] Player not found, creating manually...')
        
        const { error: playerInsertError } = await supabase
          .from('players')
          .insert({
            user_id: data.user.id,
            skill_level: 5  // Default to middle skill level (1-10 scale)
          })
        
        if (playerInsertError) {
          console.error('❌ [Auth Callback] Failed to create player:', playerInsertError)
        } else {
          console.log('✅ [Auth Callback] Player created successfully')
        }
      }

      // WORKAROUND: Assign player role if no roles exist
      const { data: existingRoles } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', data.user.id)
        .limit(1)

      if (!existingRoles || existingRoles.length === 0) {
        console.log('🔍 [Auth Callback] No roles found, assigning player role...')
        
        // Get the player role ID
        const { data: playerRole } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'player')
          .single()
        
        if (playerRole) {
          const { error: roleInsertError } = await supabase
            .from('user_roles')
            .insert({
              user_id: data.user.id,
              role_id: playerRole.id
            })
          
          if (roleInsertError) {
            console.error('❌ [Auth Callback] Failed to assign player role:', roleInsertError)
          } else {
            console.log('✅ [Auth Callback] Player role assigned successfully')
          }
        }
      }

      // If a specific redirect was requested, use that
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Otherwise, redirect based on user role (using service client to bypass RLS)
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role:roles(name)')
        .eq('user_id', data.user.id)

      console.log('🔍 [Auth Callback] User ID:', data.user.id)
      console.log('🔍 [Auth Callback] User roles query result:', userRoles)
      console.log('🔍 [Auth Callback] User roles query error:', rolesError)

      const roles = userRoles?.map((r: any) => r.role?.name).filter(Boolean) || []
      console.log('🔍 [Auth Callback] Extracted roles:', roles)

      // Find the highest priority role the user has
      const highestPriorityRole = ROLE_PRIORITY.find(role => roles.includes(role))
      console.log('🔍 [Auth Callback] Highest priority role:', highestPriorityRole)

      // Redirect based on highest priority role
      switch (highestPriorityRole) {
        case 'global_admin':
          return NextResponse.redirect(`${origin}/admin`)
        case 'court_admin':
          return NextResponse.redirect(`${origin}/court-admin`)
        case 'queue_master':
          return NextResponse.redirect(`${origin}/queue-master`)
        default:
          // Player or no role - go to home
          return NextResponse.redirect(`${origin}/home`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
