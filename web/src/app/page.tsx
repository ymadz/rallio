import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check if profile is completed
    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_completed')
      .eq('id', user.id)
      .single()

    if (profile?.profile_completed) {
      redirect('/home')
    } else {
      redirect('/setup-profile')
    }
  }

  redirect('/login')
}
