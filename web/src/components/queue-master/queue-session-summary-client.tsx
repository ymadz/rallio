'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getQueueSessionSummary } from '@/app/actions/queue-actions'
import {
  Calendar,
  Clock,
  Users,
  Trophy,
  DollarSign,
  MapPin,
  Download,
  Printer,
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
} from 'lucide-react'
import { formatCurrency } from '@rallio/shared/utils'
import { format } from 'date-fns'

interface SessionSummary {
  session: {
    id: string
    status: string
    mode: 'casual' | 'competitive'
    gameFormat: 'singles' | 'doubles' | 'mixed'
    costPerGame: number
    startTime: string
    endTime: string
    courtName: string
    venueName: string
    venueId: string
    organizerName: string
    settings?: any
    summary?: {
      totalGames: number
      totalRevenue: number
      totalParticipants: number
      unpaidBalances: number
      closedAt: string
      closedBy: string
      closedReason: string
    }
  }
  participants: Array<{
    id: string
    userId: string
    playerName: string
    avatarUrl?: string
    skillLevel: number
    position: number
    joinedAt: string
    leftAt?: string
    gamesPlayed: number
    gamesWon: number
    status: string
    amountOwed: number
    paymentStatus: string
  }>
  matches: Array<{
    id: string
    matchNumber: number
    startTime: string
    endTime?: string
    status: string
    team1Players: Array<{ id: string; name: string; skillLevel: number }>
    team2Players: Array<{ id: string; name: string; skillLevel: number }>
    team1Score?: number
    team2Score?: number
    winnerTeam?: number
  }>
}

interface Props {
  sessionId: string
}

export function QueueSessionSummaryClient({ sessionId }: Props) {
  const router = useRouter()
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSummary() {
      setLoading(true)
      setError(null)

      const result = await getQueueSessionSummary(sessionId)

      if (result.success && result.summary) {
        setSummary(result.summary)
      } else {
        setError(result.error || 'Failed to load session summary')
      }

      setLoading(false)
    }

    loadSummary()
  }, [sessionId])

  const handlePrint = () => {
    window.print()
  }

  const handleExport = () => {
    if (!summary) return

    // Create CSV data
    const csvData = generateCSV(summary)
    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `queue-session-${sessionId}-summary.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session summary...</p>
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Summary</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const { session, participants, matches } = summary
  const sessionSummary = session.summary

  // Calculate additional stats
  const activeParticipants = participants.filter((p) => p.status !== 'left')
  const unpaidParticipants = participants.filter((p) => p.amountOwed > 0)
  const totalOwed = participants.reduce((sum, p) => sum + p.amountOwed, 0)
  const avgGamesPerPlayer =
    activeParticipants.length > 0
      ? (activeParticipants.reduce((sum, p) => sum + p.gamesPlayed, 0) / activeParticipants.length).toFixed(1)
      : '0'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 print:border-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors print:hidden"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Queue Session Summary</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {session.venueName} - {session.courtName}
                </p>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Session Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(session.startTime), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(session.startTime), 'h:mm a')} -{' '}
                  {format(new Date(session.endTime), 'h:mm a')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Mode</p>
                <p className="font-medium text-gray-900 capitalize">
                  {session.mode} {session.gameFormat}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cost Per Game</p>
                <p className="font-medium text-gray-900">{formatCurrency(session.costPerGame)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>
                Organized by <span className="font-medium text-gray-900">{session.organizerName}</span>
              </span>
            </div>
            {sessionSummary && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                <Clock className="h-4 w-4" />
                <span>
                  Closed {format(new Date(sessionSummary.closedAt), 'MMM d, yyyy h:mm a')} by{' '}
                  {sessionSummary.closedBy}
                  {sessionSummary.closedReason && ` (${sessionSummary.closedReason.replace(/_/g, ' ')})`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            icon={Trophy}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            label="Total Games"
            value={sessionSummary?.totalGames || matches.length}
          />
          <StatCard
            icon={Users}
            iconColor="text-green-600"
            iconBg="bg-green-50"
            label="Total Participants"
            value={sessionSummary?.totalParticipants || participants.length}
            subtitle={`${activeParticipants.length} active`}
          />
          <StatCard
            icon={DollarSign}
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
            label="Total Revenue"
            value={formatCurrency(sessionSummary?.totalRevenue || 0)}
          />
          <StatCard
            icon={AlertCircle}
            iconColor={unpaidParticipants.length > 0 ? 'text-orange-600' : 'text-gray-400'}
            iconBg={unpaidParticipants.length > 0 ? 'bg-orange-50' : 'bg-gray-50'}
            label="Outstanding Balance"
            value={formatCurrency(totalOwed)}
            subtitle={
              unpaidParticipants.length > 0 ? `${unpaidParticipants.length} players` : 'All paid'
            }
          />
        </div>

        {/* Participants Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Participants</h2>
            <p className="text-sm text-gray-500 mt-1">
              {participants.length} total · {activeParticipants.length} completed · Avg{' '}
              {avgGamesPerPlayer} games/player
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skill
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Games
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wins
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Win Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount Owed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {participants.map((participant) => {
                  const winRate =
                    participant.gamesPlayed > 0
                      ? ((participant.gamesWon / participant.gamesPlayed) * 100).toFixed(0)
                      : '0'

                  return (
                    <tr key={participant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            {participant.avatarUrl ? (
                              <img
                                src={participant.avatarUrl}
                                alt={participant.playerName}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-500 font-medium text-sm">
                                  {participant.playerName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {participant.playerName}
                            </div>
                            <div className="text-sm text-gray-500">Position #{participant.position}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Level {participant.skillLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {participant.gamesPlayed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {participant.gamesWon}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{winRate}%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-medium ${
                            participant.amountOwed > 0 ? 'text-orange-600' : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(participant.amountOwed)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PaymentStatusBadge
                          status={participant.paymentStatus}
                          amountOwed={participant.amountOwed}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Match Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Match Results</h2>
            <p className="text-sm text-gray-500 mt-1">{matches.length} matches played</p>
          </div>
          <div className="divide-y divide-gray-200">
            {matches.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No matches recorded for this session</p>
              </div>
            ) : (
              matches.map((match) => (
                <div key={match.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-white text-sm font-medium">
                        {match.matchNumber}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Match #{match.matchNumber}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(match.startTime), 'h:mm a')}
                          {match.endTime && ` - ${format(new Date(match.endTime), 'h:mm a')}`}
                        </p>
                      </div>
                    </div>
                    <MatchStatusBadge status={match.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Team 1 */}
                    <div
                      className={`p-4 rounded-lg ${
                        match.winnerTeam === 1
                          ? 'bg-green-50 border-2 border-green-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-500">Team 1</span>
                        {match.winnerTeam === 1 && <Trophy className="h-4 w-4 text-green-600" />}
                      </div>
                      <div className="space-y-1">
                        {match.team1Players.map((player) => (
                          <div key={player.id} className="flex items-center justify-between">
                            <span className="text-sm text-gray-900">{player.name}</span>
                            <span className="text-xs text-gray-500">L{player.skillLevel}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900">
                        {match.team1Score ?? '-'} : {match.team2Score ?? '-'}
                      </div>
                      {match.status === 'completed' && match.winnerTeam && (
                        <p className="text-sm text-gray-500 mt-1">
                          Team {match.winnerTeam} wins
                        </p>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div
                      className={`p-4 rounded-lg ${
                        match.winnerTeam === 2
                          ? 'bg-green-50 border-2 border-green-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-500">Team 2</span>
                        {match.winnerTeam === 2 && <Trophy className="h-4 w-4 text-green-600" />}
                      </div>
                      <div className="space-y-1">
                        {match.team2Players.map((player) => (
                          <div key={player.id} className="flex items-center justify-between">
                            <span className="text-sm text-gray-900">{player.name}</span>
                            <span className="text-xs text-gray-500">L{player.skillLevel}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Outstanding Payments Alert */}
        {unpaidParticipants.length > 0 && (
          <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-900 mb-2">
                  Outstanding Payments Required
                </h3>
                <p className="text-sm text-orange-800 mb-4">
                  {unpaidParticipants.length} participant{unpaidParticipants.length !== 1 ? 's' : ''}{' '}
                  still owe a total of {formatCurrency(totalOwed)}. Please follow up for payment.
                </p>
                <div className="space-y-2">
                  {unpaidParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between bg-white rounded-lg p-3"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {participant.playerName}
                      </span>
                      <span className="text-sm font-semibold text-orange-600">
                        {formatCurrency(participant.amountOwed)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper Components
function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  subtitle,
}: {
  icon: any
  iconColor: string
  iconBg: string
  label: string
  value: string | number
  subtitle?: string
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function PaymentStatusBadge({ status, amountOwed }: { status: string; amountOwed: number }) {
  if (amountOwed === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3" />
        Paid
      </span>
    )
  }

  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertCircle className="h-3 w-3" />
        Partial
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
      <XCircle className="h-3 w-3" />
      Unpaid
    </span>
  )
}

function MatchStatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3" />
        Completed
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <TrendingUp className="h-3 w-3" />
        In Progress
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      {status}
    </span>
  )
}

// CSV Export Helper
function generateCSV(summary: SessionSummary): string {
  const { session, participants, matches } = summary

  let csv = 'Queue Session Summary\n\n'

  // Session Info
  csv += 'Session Information\n'
  csv += `Venue,${session.venueName}\n`
  csv += `Court,${session.courtName}\n`
  csv += `Mode,${session.mode} ${session.gameFormat}\n`
  csv += `Date,${format(new Date(session.startTime), 'MMM d, yyyy')}\n`
  csv += `Time,${format(new Date(session.startTime), 'h:mm a')} - ${format(new Date(session.endTime), 'h:mm a')}\n`
  csv += `Cost Per Game,${formatCurrency(session.costPerGame)}\n`
  csv += `Organizer,${session.organizerName}\n\n`

  // Participants
  csv += 'Participants\n'
  csv += 'Name,Position,Skill Level,Games Played,Games Won,Win Rate,Amount Owed,Payment Status\n'
  participants.forEach((p) => {
    const winRate = p.gamesPlayed > 0 ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(0) : '0'
    csv += `${p.playerName},${p.position},${p.skillLevel},${p.gamesPlayed},${p.gamesWon},${winRate}%,${formatCurrency(p.amountOwed)},${p.paymentStatus}\n`
  })

  csv += '\nMatches\n'
  csv += 'Match #,Team 1 Players,Team 1 Score,Team 2 Players,Team 2 Score,Winner,Status\n'
  matches.forEach((m) => {
    const team1Names = m.team1Players.map((p) => p.name).join(' & ')
    const team2Names = m.team2Players.map((p) => p.name).join(' & ')
    const winner = m.winnerTeam ? `Team ${m.winnerTeam}` : 'N/A'
    csv += `${m.matchNumber},"${team1Names}",${m.team1Score ?? 'N/A'},"${team2Names}",${m.team2Score ?? 'N/A'},${winner},${m.status}\n`
  })

  return csv
}
