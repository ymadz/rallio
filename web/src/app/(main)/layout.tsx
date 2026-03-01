import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { UserHeader } from '@/components/layout/user-header'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
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
      <SidebarNav
        user={{
          email: user.email || '',
          avatarUrl: profile?.avatar_url,
          displayName: profile?.display_name,
        }}
      />

      {/* Main content area - offset for collapsed sidebar on desktop */}
      <div className="md:pl-20">
        <UserHeader
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
        <main className="min-h-screen pb-16 md:pb-0">{children}</main>
      </div>
    </div>
  )
}
