'use server'

import { createClient } from '@/lib/supabase/server'

export interface MatchWithDetails {
  id: string
  matchNumber: number
  gameFormat: string
  teamAPlayers: string[]
  teamBPlayers: string[]
  scoreA: number | null
  scoreB: number | null
  winner: 'team_a' | 'team_b' | 'draw' | null
  status: string
  startedAt: string | null
  completedAt: string | null
  queueSession: {
    id: string
    sessionDate: string
    court: {
      id: string
      name: string
      venue: {
        name: string
      }
    }
  } | null
  // Computed fields
  userTeam: 'team_a' | 'team_b' | null
  userWon: boolean | null
  opponentNames: string[]
  teammateNames: string[]
}

export interface PlayerStats {
  totalGames: number
  wins: number
  losses: number
  draws: number
  winRate: number
  skillLevel: number | null
  gamesThisMonth: number
}

/**
 * Get player's match history with full details
 */
export async function getPlayerMatchHistory(
  userId: string,
  filter: 'all' | 'wins' | 'losses' | 'draws' = 'all'
): Promise<{ matches: MatchWithDetails[]; error?: string }> {
  const supabase = await createClient()

  try {
    // Get all completed matches first
    const { data: allMatches, error: fetchError } = await supabase
      .from('matches')
      .select(`
        id,
        match_number,
        game_format,
        team_a_players,
        team_b_players,
        score_a,
        score_b,
        winner,
        status,
        started_at,
        completed_at,
        queue_session:queue_sessions(
          id,
          session_date,
          court:courts(
            id,
            name,
            venue:venues(
              name
            )
          )
        )
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching matches:', fetchError)
      return { matches: [], error: fetchError.message }
    }

    // Filter matches where user is in either team (client-side filtering)
    const matches = allMatches?.filter((match: any) => {
      const inTeamA = match.team_a_players?.includes(userId)
      const inTeamB = match.team_b_players?.includes(userId)
      return inTeamA || inTeamB
    }) || []

    if (!matches || matches.length === 0) {
      return { matches: [] }
    }

    // Get all unique player IDs from all matches
    const allPlayerIds = new Set<string>()
    matches.forEach((match: any) => {
      match.team_a_players?.forEach((id: string) => allPlayerIds.add(id))
      match.team_b_players?.forEach((id: string) => allPlayerIds.add(id))
    })

    // Fetch all player profiles at once
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(allPlayerIds))

    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || [])

    // Transform matches to include computed fields
    const matchesWithDetails: MatchWithDetails[] = matches
      .map((match: any) => {
        const userOnTeamA = match.team_a_players?.includes(userId)
        const userOnTeamB = match.team_b_players?.includes(userId)
        const userTeam: 'team_a' | 'team_b' | null = userOnTeamA ? 'team_a' : userOnTeamB ? 'team_b' : null

        let userWon: boolean | null = null
        if (match.winner && userTeam) {
          if (match.winner === 'draw') {
            userWon = null
          } else {
            userWon = match.winner === userTeam
          }
        }

        // Get opponent and teammate names
        const teammates = userOnTeamA 
          ? match.team_a_players?.filter((id: string) => id !== userId) || []
          : match.team_b_players?.filter((id: string) => id !== userId) || []
        
        const opponents = userOnTeamA 
          ? match.team_b_players || []
          : match.team_a_players || []

        const teammateNames = teammates.map((id: string) => profileMap.get(id) || 'Unknown Player')
        const opponentNames = opponents.map((id: string) => profileMap.get(id) || 'Unknown Player')

        return {
          id: match.id,
          matchNumber: match.match_number,
          gameFormat: match.game_format,
          teamAPlayers: match.team_a_players || [],
          teamBPlayers: match.team_b_players || [],
          scoreA: match.score_a,
          scoreB: match.score_b,
          winner: match.winner,
          status: match.status,
          startedAt: match.started_at,
          completedAt: match.completed_at,
          queueSession: match.queue_session,
          userTeam,
          userWon,
          opponentNames,
          teammateNames,
        }
      })
      .filter((match: MatchWithDetails) => {
        // Apply filter
        if (filter === 'wins') return match.userWon === true
        if (filter === 'losses') return match.userWon === false
        if (filter === 'draws') return match.winner === 'draw'
        return true // 'all'
      })

    return { matches: matchesWithDetails }
  } catch (error) {
    console.error('Error in getPlayerMatchHistory:', error)
    return { matches: [], error: 'Failed to fetch match history' }
  }
}

/**
 * Get player's overall stats
 */
export async function getPlayerStats(userId: string): Promise<{ stats: PlayerStats | null; error?: string }> {
  const supabase = await createClient()

  try {
    // Get all completed matches
    const { data: allMatches, error: matchError } = await supabase
      .from('matches')
      .select('team_a_players, team_b_players, winner, completed_at')
      .eq('status', 'completed')

    if (matchError) {
      console.error('Error fetching matches for stats:', matchError)
      return { stats: null, error: matchError.message }
    }

    // Filter matches where user is in either team
    const matches = allMatches?.filter((match: any) => {
      const inTeamA = match.team_a_players?.includes(userId)
      const inTeamB = match.team_b_players?.includes(userId)
      return inTeamA || inTeamB
    }) || []

    // Get player's skill level
    const { data: player } = await supabase
      .from('players')
      .select('skill_level')
      .eq('user_id', userId)
      .single()

    if (!matches) {
      return {
        stats: {
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          skillLevel: player?.skill_level || null,
          gamesThisMonth: 0,
        },
      }
    }

    // Calculate stats
    let wins = 0
    let losses = 0
    let draws = 0
    let gamesThisMonth = 0

    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    matches.forEach((match: any) => {
      const userOnTeamA = match.team_a_players?.includes(userId)
      const userTeam = userOnTeamA ? 'team_a' : 'team_b'

      if (match.winner === 'draw') {
        draws++
      } else if (match.winner === userTeam) {
        wins++
      } else if (match.winner) {
        losses++
      }

      // Check if match is from this month
      if (match.completed_at) {
        const completedDate = new Date(match.completed_at)
        if (
          completedDate.getMonth() === currentMonth &&
          completedDate.getFullYear() === currentYear
        ) {
          gamesThisMonth++
        }
      }
    })

    const totalGames = matches.length
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0

    return {
      stats: {
        totalGames,
        wins,
        losses,
        draws,
        winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
        skillLevel: player?.skill_level || null,
        gamesThisMonth,
      },
    }
  } catch (error) {
    console.error('Error in getPlayerStats:', error)
    return { stats: null, error: 'Failed to fetch player stats' }
  }
}
