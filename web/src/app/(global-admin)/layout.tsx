import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GlobalAdminSidebar from '@/components/global-admin/global-admin-sidebar'
import { NotificationBell } from '@/components/notifications/notification-bell'

export default async function GlobalAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify global_admin role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner (name)')
    .eq('user_id', user.id)

  const isGlobalAdmin = roles?.some((r: any) => r.roles?.name === 'global_admin')
  
  if (!isGlobalAdmin) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalAdminSidebar user={{ email: user.email || '', displayName: user.user_metadata?.display_name }} />
      
      {/* Main content area - offset for collapsed sidebar on desktop */}
      <div className="md:pl-20">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Global Administration</h2>
            <p className="text-sm text-gray-600">Platform management and oversight</p>
          </div>
          <NotificationBell />
        </header>
        <main className="min-h-screen pb-16 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  )
}
