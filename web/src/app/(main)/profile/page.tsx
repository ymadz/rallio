import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = {
  title: 'Profile | Rallio',
  description: 'Your player profile',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get profile and player data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', user?.id)
    .single()

  const fullName = [profile?.first_name, profile?.middle_initial, profile?.last_name]
    .filter(Boolean)
    .join(' ') || profile?.display_name || 'Player'

  const playStyles = player?.play_style?.split(',').filter(Boolean) || []

  // Map skill level to tier
  const getSkillTier = (level: number) => {
    if (level <= 3) return 'BEGINNER'
    if (level <= 6) return 'INTERMEDIATE'
    if (level <= 8) return 'ADVANCED'
    return 'ELITE'
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      </header>

      {/* Profile Content */}
      <div className="p-6 max-w-3xl">
        {/* User Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-medium text-gray-400">
                  {fullName.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Name</p>
              <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
              <p className="text-sm text-gray-500">Plays in Zamboanga City, Philippines</p>
              <div className="flex gap-2 mt-3">
                <Link
                  href="/profile/edit"
                  className="px-4 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                >
                  Edit
                </Link>
                <Link
                  href="/settings"
                  className="px-4 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                >
                  Settings
                </Link>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">{player?.total_games_played || 0}</p>
              <p className="text-xs text-gray-500">Queue Matches</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">{player?.total_wins || 0}</p>
              <p className="text-xs text-gray-500">Won Matches</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">{player?.skill_level || 1}</p>
              <p className="text-xs text-gray-500">Skill Level</p>
            </div>
          </div>
        </div>

        {/* Player Badges */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Player Badges</h3>
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center"
              >
                {/* Placeholder for badge */}
              </div>
            ))}
          </div>
        </div>

        {/* Play Styles */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Play Styles</h3>
          <div className="flex flex-wrap gap-2">
            {playStyles.length > 0 ? (
              playStyles.map((style) => (
                <span
                  key={style}
                  className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full uppercase"
                >
                  {style.trim()}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No play styles set</span>
            )}
          </div>
        </div>

        {/* Skill Level */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Skill Level</h3>
          <span className="px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
            {getSkillTier(player?.skill_level || 1)}
          </span>
        </div>

        {/* Recent Queue Sessions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Queueing's</h3>
          <div className="space-y-3">
            {/* Placeholder matches - will be replaced with real data */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <span className="text-sm">🏸</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">Phoenix Badminton</p>
              </div>
              <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded font-medium">LOST</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <span className="text-sm">🏸</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">S&R Badminton</p>
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded font-medium">WON</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
