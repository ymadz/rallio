import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/layout/sidebar-nav'

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
    .select('display_name, avatar_url')
    .eq('id', user.id)
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
        <main className="min-h-screen pb-16 md:pb-0">{children}</main>
      </div>
    </div>
  )
}
