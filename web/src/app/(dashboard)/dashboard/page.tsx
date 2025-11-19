import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Dashboard | Rallio',
  description: 'Your Rallio dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Player'

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {firstName}!</h1>
        <p className="text-muted-foreground">
          Ready to find your next game? Let's get you on the court.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <a
          href="/courts"
          className="p-6 border rounded-lg hover:border-primary hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">Find Courts</h3>
          <p className="text-sm text-muted-foreground">
            Discover badminton courts near you
          </p>
        </a>

        <a
          href="/reservations"
          className="p-6 border rounded-lg hover:border-primary hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">My Reservations</h3>
          <p className="text-sm text-muted-foreground">
            View your upcoming bookings
          </p>
        </a>

        <a
          href="/profile"
          className="p-6 border rounded-lg hover:border-primary hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">My Profile</h3>
          <p className="text-sm text-muted-foreground">
            Manage your player profile
          </p>
        </a>
      </div>

      {/* Stats placeholder */}
      <div className="border rounded-lg p-6">
        <h2 className="font-semibold mb-4">Your Stats</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Games Played</p>
          </div>
          <div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Reservations</p>
          </div>
          <div>
            <p className="text-2xl font-bold">--</p>
            <p className="text-sm text-muted-foreground">Skill Rating</p>
          </div>
          <div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Courts Visited</p>
          </div>
        </div>
      </div>
    </div>
  )
}
