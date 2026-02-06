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
  const getSkillTier = (level: number | null) => {
    if (!level) return 'UNRANKED'
    if (level <= 3) return 'BEGINNER'
    if (level <= 6) return 'INTERMEDIATE'
    if (level <= 8) return 'ADVANCED'
    return 'ELITE'
  }

  // Calculate win rate
  const totalGames = player?.total_games_played || 0
  const wins = player?.total_wins || 0
  const losses = player?.total_losses || 0
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

  // Format member since date
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-500 mt-1">View and manage your player profile</p>
        </div>
      </header>

      {/* Profile Content */}
      <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - User Info & Stats */}
          <div className="lg:col-span-4 space-y-6">
            {/* User Info Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-medium text-gray-400">
                      {fullName.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
                    {player?.verified_player && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>
                  {profile?.display_name && profile.display_name !== fullName && (
                    <p className="text-sm text-gray-500 mb-1">@{profile.display_name}</p>
                  )}
                  <p className="text-sm text-gray-500">Plays in Zamboanga City, Philippines</p>
                  <p className="text-xs text-gray-400 mt-1">Member since {memberSince}</p>
                </div>
                <div className="flex gap-2 mt-4 w-full">
                  <Link
                    href="/profile/edit"
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium text-center"
                  >
                    Edit Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium text-center"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            </div>

            {/* Statistics Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{totalGames}</p>
                  <p className="text-xs text-gray-500 mt-1">Games Played</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{wins}</p>
                  <p className="text-xs text-gray-500 mt-1">Wins</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{losses}</p>
                  <p className="text-xs text-gray-500 mt-1">Losses</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{winRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">Win Rate</p>
                </div>
              </div>
            </div>

            {/* Skill & Rating Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Skill & Rating</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Skill Level</span>
                    <span className="text-sm font-bold text-gray-900">
                      {player?.skill_level ? `${player.skill_level}/10` : 'Unranked'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${!player?.skill_level ? 'bg-gray-300' : 'bg-primary'}`}
                      style={{ width: `${player?.skill_level ? (player.skill_level / 10) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">ELO Rating</span>
                    <span className="text-sm font-bold text-gray-900">{player?.rating || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${!player?.skill_level ? 'bg-gray-100 text-gray-600' :
                      player.skill_level <= 3 ? 'bg-green-100 text-green-800' :
                        player.skill_level <= 6 ? 'bg-blue-100 text-blue-800' :
                          player.skill_level <= 8 ? 'bg-amber-100 text-amber-800' :
                            'bg-purple-100 text-purple-800'
                      }`}>
                      {getSkillTier(player?.skill_level || null)}
                    </span>
                  </div>
                </div>

                {player?.average_rating && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-600">Average Rating:</span>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-900">{player.average_rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Personal Info Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Personal Information</h3>
              <div className="space-y-3 text-sm">
                {profile?.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-900">{profile.email}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-gray-900">{profile.phone}</span>
                  </div>
                )}
                {player?.birth_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Birth Date</span>
                    <span className="text-gray-900">{new Date(player.birth_date).toLocaleDateString()}</span>
                  </div>
                )}
                {player?.gender && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gender</span>
                    <span className="text-gray-900 capitalize">{player.gender}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Bio, Play Styles, Recent Activity */}
          <div className="lg:col-span-8 space-y-6">
            {/* Bio */}
            {player?.bio && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">About</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{player.bio}</p>
              </div>
            )}

            {/* Play Styles */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Play Styles</h3>
              <div className="flex flex-wrap gap-2">
                {playStyles.length > 0 ? (
                  playStyles.map((style: string) => (
                    <span
                      key={style}
                      className="px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full"
                    >
                      {style.trim()}
                    </span>
                  ))
                ) : (
                  <div className="text-center w-full py-8">
                    <p className="text-gray-400 text-sm mb-3">No play styles set yet</p>
                    <Link
                      href="/profile/edit"
                      className="inline-block px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                      Add Play Styles
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Matches */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Recent Matches</h3>
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm mb-3">No match history yet</p>
                <p className="text-gray-400 text-xs mb-4">Join a queue to start playing!</p>
                <Link
                  href="/queue"
                  className="inline-block px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm"
                >
                  Join Queue
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  )
}
