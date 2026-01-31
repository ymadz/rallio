'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createQueueSession } from '@/app/actions/queue-actions'
import { getAvailableTimeSlotsAction, type TimeSlot } from '@/app/actions/reservations'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, Users, DollarSign, Settings, Loader2, ArrowLeft, CheckCircle, Info, TrendingUp, Target } from 'lucide-react'
import Link from 'next/link'
import { SessionTimePicker } from './session-time-picker'

interface Venue {
  id: string
  name: string
  courts: Court[]
}

interface Court {
  id: string
  name: string
  venue_id: string
  capacity?: number
  hourly_rate?: number
}

export function CreateSessionForm() {
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [courtId, setCourtId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('') // Format: "HH:00"
  const [duration, setDuration] = useState(3) // hours
  const [mode, setMode] = useState<'casual' | 'competitive'>('casual')
  const [gameFormat, setGameFormat] = useState<'singles' | 'doubles' | 'mixed'>('doubles')
  const [maxPlayers, setMaxPlayers] = useState(12)
  const [costPerGame, setCostPerGame] = useState(50)
  const [isPublic, setIsPublic] = useState(true)

  // UI state
  const [venues, setVenues] = useState<Venue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])

  // Load venues and courts on mount
  useEffect(() => {
    loadVenuesAndCourts()

    // Set default date to today
    const now = new Date()
    setStartDate(now.toISOString().split('T')[0])
  }, [])

  const loadVenuesAndCourts = async () => {
    setIsLoading(true)
    try {
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select(`
          id,
          name,
          courts!inner (
            id,
            name,
            venue_id,
            capacity,
            hourly_rate,
            is_active
          )
        `)
        .eq('is_active', true)
        .eq('is_verified', true)
        .eq('courts.is_active', true)
        .order('name')

      if (venuesError) throw venuesError
      setVenues(venuesData || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load venues')
    } finally {
      setIsLoading(false)
    }
  }

  // Load time slots when court or date changes
  useEffect(() => {
    if (!courtId || !startDate) {
      setTimeSlots([])
      return
    }

    const loadSlots = async () => {
      setIsLoadingSlots(true)
      try {
        const slots = await getAvailableTimeSlotsAction(courtId, startDate)
        setTimeSlots(slots)
      } catch (err) {
        console.error('Error loading time slots:', err)
        setError('Failed to load available time slots')
      } finally {
        setIsLoadingSlots(false)
      }
    }

    loadSlots()
  }, [courtId, startDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (!courtId) throw new Error('Please select a court')
      if (!startTime) throw new Error('Please select a start time')
      if (!startDate) throw new Error('Please select a date')

      // Combine date and time
      const startDateTime = new Date(`${startDate}T${startTime}`)
      const endDateTime = new Date(startDateTime)
      endDateTime.setHours(endDateTime.getHours() + duration)

      if (startDateTime < new Date()) {
        throw new Error('Start time cannot be in the past')
      }

      // Create session
      const result = await createQueueSession({
        courtId,
        startTime: startDateTime,
        endTime: endDateTime,
        mode,
        gameFormat,
        maxPlayers,
        costPerGame,
        isPublic,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create session')
      }

      // Handle approval requirement
      if (result.requiresApproval) {
        alert('✅ Session created! It will be visible once the venue owner approves it. You\'ll be notified of their decision.')
        router.push('/queue-master/sessions')
      } else {
        router.push(`/queue-master/sessions/${result.session?.id}`)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Get selected court details
  const selectedCourt = venues
    .flatMap(v => v.courts || [])
    .find(c => c.id === courtId)

  const selectedVenue = venues.find(v =>
    v.courts?.some(c => c.id === courtId)
  )

  // Calculate estimated revenue
  const estimatedGamesPerPlayer = duration * 2 // Rough estimate: 2 games per hour
  const estimatedRevenue = maxPlayers * estimatedGamesPerPlayer * costPerGame

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-primary/10 to-blue-50 border border-primary/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Queue System Overview</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Create a walk-in session where players can join, play multiple games with automatic rotation,
                    and pay based on games played. You'll manage match assignments and keep games flowing smoothly.
                  </p>
                </div>
              </div>
            </div>

            {/* Court Selection */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Court Selection</h3>
                  <p className="text-sm text-gray-600">Choose the venue and court</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Court <span className="text-red-500">*</span>
                </label>
                <select
                  value={courtId}
                  onChange={(e) => setCourtId(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Choose a court...</option>
                  {venues.map((venue) => (
                    <optgroup key={venue.id} label={venue.name}>
                      {venue.courts?.map((court: Court) => (
                        <option key={court.id} value={court.id}>
                          {court.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Schedule</h3>
                  <p className="text-sm text-gray-600">Set the session date and time</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (hours) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      {[1, 2, 3, 4, 5, 6].map(h => (
                        <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Time Picker List */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Start Time {duration > 1 && <span className="text-primary">({duration}-hour session)</span>} <span className="text-red-500">*</span>
                  </label>

                  {isLoadingSlots ? (
                    <div className="flex items-center justify-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-sm text-gray-500">Checking court availability...</span>
                      </div>
                    </div>
                  ) : courtId && startDate ? (
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                      <SessionTimePicker
                        slots={timeSlots}
                        selectedTime={startTime}
                        duration={duration}
                        onSelectTime={setStartTime}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
                      <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a court and date to see available times</p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-2 italic px-1">
                    * Grayed out slots represent existing reservations on this court.
                  </p>
                </div>
              </div>
            </div>

            {/* Game Settings */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Game Settings</h3>
                  <p className="text-sm text-gray-600">Configure game format and mode</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Session Mode <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('casual')}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${mode === 'casual'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="font-semibold text-gray-900 mb-1">Casual</div>
                      <div className="text-xs text-gray-600">Just for fun, no ranking impact</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('competitive')}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${mode === 'competitive'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="font-semibold text-gray-900 mb-1">Competitive</div>
                      <div className="text-xs text-gray-600">Affects player ELO ratings</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Game Format <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['singles', 'doubles', 'mixed'].map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => setGameFormat(format as any)}
                        className={`p-4 border-2 rounded-lg text-center transition-all ${gameFormat === format
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="font-semibold text-gray-900 mb-1 capitalize">{format}</div>
                        <div className="text-xs text-gray-600">
                          {format === 'singles' ? '2 players' : '4 players'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Capacity & Pricing */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Capacity & Pricing</h3>
                  <p className="text-sm text-gray-600">Set player limits and pricing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Players <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="range"
                    min="4"
                    max="20"
                    step="2"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">4 players</span>
                    <span className="text-lg font-bold text-primary">{maxPlayers} players</span>
                    <span className="text-sm text-gray-600">20 players</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cost Per Game (₱) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={costPerGame}
                      onChange={(e) => setCostPerGame(Number(e.target.value))}
                      required
                      min="0"
                      step="10"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Visibility */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <div>
                  <div className="font-medium text-gray-900">Public Session</div>
                  <div className="text-sm text-gray-600">Allow anyone to join this queue</div>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-6 border-t border-gray-200">
              <Link
                href="/queue-master"
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4 inline mr-2" />
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !courtId || !startTime}
                className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Session...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Create Session
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Session Summary
              </h3>

              {!courtId ? (
                <div className="text-center py-8 text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a court to see summary</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">COURT</p>
                    <p className="font-medium text-gray-900">{selectedCourt?.name}</p>
                    <p className="text-sm text-gray-600">{selectedVenue?.name}</p>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">SCHEDULE</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {startDate}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {startTime || '--:--'} ({duration}h)
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">MODE & FORMAT</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded">{mode}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded">{gameFormat}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">PRICING</p>
                    <p className="text-lg font-bold text-gray-900">₱{costPerGame} <span className="text-xs font-normal text-gray-500">/ game</span></p>
                  </div>
                </div>
              )}
            </div>

            {courtId && costPerGame > 0 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <h4 className="font-semibold text-gray-900">Estimated Revenue</h4>
                </div>
                <p className="text-3xl font-bold text-green-700">₱{estimatedRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-gray-600 mt-2">Based on {maxPlayers} players × ~{estimatedGamesPerPlayer} games</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
