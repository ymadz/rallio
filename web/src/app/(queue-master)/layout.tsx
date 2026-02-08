import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QueueMasterSidebar } from '@/components/queue-master/queue-master-sidebar'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { UserNav } from '@/components/layout/user-nav'

export default async function QueueMasterRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/queue-master')
  }

  // Check if user has queue_master role
  const { data: roles } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles!inner (
        name
      )
    `)
    .eq('user_id', user.id)

  const hasQueueMasterRole = roles?.some((r: any) => r.roles?.name === 'queue_master')

  if (!hasQueueMasterRole) {
    redirect('/queue')
  }

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
      <QueueMasterSidebar
        user={{
          email: user.email || '',
          avatarUrl: profile?.avatar_url,
          displayName: profile?.display_name,
        }}
      />

      {/* Main content area - offset for collapsed sidebar on desktop */}
      <div className="md:pl-20">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Queue Master Dashboard</h2>
            <p className="text-sm text-gray-600">Manage queue sessions</p>
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
