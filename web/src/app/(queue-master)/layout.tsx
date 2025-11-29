import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QueueMasterSidebar } from '@/components/queue-master/queue-master-sidebar'

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
    .select('display_name, avatar_url')
    .eq('id', user.id)
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
        <main className="min-h-screen pb-16 md:pb-0">{children}</main>
      </div>
    </div>
  )
}
