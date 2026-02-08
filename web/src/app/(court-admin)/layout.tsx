import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CourtAdminSidebar } from '@/components/court-admin/court-admin-sidebar'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { UserNav } from '@/components/layout/user-nav'

export default async function CourtAdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/court-admin')
  }

  // Check if user has court_admin role
  const { data: roles } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles!inner (
        name
      )
    `)
    .eq('user_id', user.id)

  const hasCourtAdminRole = roles?.some((r: any) => r.roles?.name === 'court_admin')

  if (!hasCourtAdminRole) {
    redirect('/')
  }

  // Get user's venues
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('owner_id', user.id)
    .eq('is_active', true)

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, first_name, last_name, phone')
    .eq('id', user.id)
    .single()

  // Get player data for bio/gender/birthdate
  const { data: player } = await supabase
    .from('players')
    .select('bio, birth_date, gender')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <CourtAdminSidebar
        user={{
          email: user.email || '',
          avatarUrl: profile?.avatar_url,
          displayName: profile?.display_name,
        }}
        venues={venues || []}
      />

      {/* Main content area - offset for collapsed sidebar on desktop */}
      <div className="md:pl-20">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Court Administration</h2>
            <p className="text-sm text-gray-600">Manage courts and reservations</p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <UserNav
              user={{
                email: user.email || '',
                id: user.id,
                avatarUrl: profile?.avatar_url,
                displayName: profile?.display_name,
                firstName: profile?.first_name,
                lastName: profile?.last_name,
                phone: profile?.phone,
                bio: player?.bio,
                birthDate: player?.birth_date,
                gender: player?.gender,
              }}
            />
          </div>
        </header>

        <main className="min-h-screen pb-16 md:pb-0">{children}</main>
      </div>
    </div>
  )
}
