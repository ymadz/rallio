import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createQueueSession } from '@/app/actions/queue-actions'
import { getAvailableTimeSlotsAction, validateBookingAvailabilityAction, type TimeSlot } from '@/app/actions/reservations'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Clock, Users, DollarSign, Settings, Loader2, ArrowLeft, CheckCircle, Info, TrendingUp, Target } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [courtId, setCourtId] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [startTime, setStartTime] = useState('') // Format: "HH:00"
  const [duration, setDuration] = useState(1) // hours (dynamic now)
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(1)
  const [selectedDays, setSelectedDays] = useState<number[]>([]) // [0-6] for Sun-Sat
  const [mode, setMode] = useState<'casual' | 'competitive'>('casual')
  const [gameFormat, setGameFormat] = useState<'singles' | 'doubles' | 'mixed'>('doubles')
  const [maxPlayers, setMaxPlayers] = useState(12)
  const [costPerGame, setCostPerGame] = useState(50)
  const [isPublic, setIsPublic] = useState(true)

  // Validation state
  const [validationState, setValidationState] = useState<{
    valid: boolean
    validating: boolean
    error?: string
    conflictDate?: string
  }>({ valid: true, validating: false })

  // Reset selected days when date changes
  useEffect(() => {
    if (startDate) {
      setSelectedDays([startDate.getDay()])
    }
  }, [startDate])

  const handleTimeSelect = (clickedSlot: TimeSlot) => {
    if (!clickedSlot.available) return

    if (!startTime) {
      setStartTime(clickedSlot.time)
      setDuration(1)
      return
    }

    const startHour = parseInt(startTime.split(':')[0])
    const clickedHour = parseInt(clickedSlot.time.split(':')[0])

    if (clickedHour < startHour) {
      // New start time
      setStartTime(clickedSlot.time)
      setDuration(1)
    } else if (clickedHour === startHour) {
      // Deselect / Reset to 1 hour
      setDuration(1)
    } else {
      // Extend duration
      // Check validity of range
      const startIndex = timeSlots.findIndex(s => s.time === startTime)
      const clickedIndex = timeSlots.findIndex(s => s.time === clickedSlot.time)

      // Verify no reserved slots in between
      let valid = true
      for (let i = startIndex; i <= clickedIndex; i++) {
        if (!timeSlots[i].available) {
          valid = false
          break
        }
      }

      if (valid) {
        setDuration(clickedHour - startHour + 1)
      } else {
        // If invalid range, just set new start time
        setStartTime(clickedSlot.time)
        setDuration(1)
      }
    }
  }

  // Helpers for styling matching AvailabilityModal
  const isSlotSelected = (slot: TimeSlot) => {
    if (!startTime) return false
    const startHour = parseInt(startTime.split(':')[0])
    const slotHour = parseInt(slot.time.split(':')[0])

    // Start slot is selected
    if (slot.time === startTime) return true

    // End slot is selected (if duration > 1)
    const endHour = startHour + duration - 1
    if (slotHour === endHour) return true

    return false
  }

  const isSlotInRange = (slot: TimeSlot) => {
    if (!startTime || duration <= 2) return false
    const startHour = parseInt(startTime.split(':')[0])
    const endHour = startHour + duration - 1
    const slotHour = parseInt(slot.time.split(':')[0])

    return slotHour > startHour && slotHour < endHour
  }

  const formatSlotTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const getNextHour = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const nextHour = hours + 1
    return `${nextHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // UI state
  const [venues, setVenues] = useState<Venue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])

  // Load venues and courts on mount
  useEffect(() => {
    loadVenuesAndCourts()

    // Set default date to today
    const now = new Date()
    setStartDate(now)
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
      if (err.name === 'AbortError' || err.message === 'The operation was aborted') return
      setError(err.message || 'Failed to load venues')
    } finally {
      setIsLoading(false)
    }
  }

  // Load time slots when court or date changes
  useEffect(() => {
    const fetchTimeSlots = async () => {
      if (!courtId || !startDate) {
        setTimeSlots([])
        return
      }

      setIsLoadingSlots(true)
      try {
        const slots = await getAvailableTimeSlotsAction(courtId, format(startDate, 'yyyy-MM-dd'))
        setTimeSlots(slots)
      } catch (err) {
        console.error('Error fetching time slots:', err)
      } finally {
        setIsLoadingSlots(false)
      }
    }

    fetchTimeSlots()
  }, [courtId, startDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (!courtId) throw new Error('Please select a court')
      if (!startTime) throw new Error('Please select a start time')
      if (!startDate) return

      setIsSubmitting(true)
      setError(null)

      // Create Date objects for start and end
      const startDateTime = new Date(startDate)
      const [hours, minutes] = startTime.split(':').map(Number)
      startDateTime.setHours(hours, minutes, 0, 0)

      const endDateTime = new Date(startDate)
      endDateTime.setHours(hours + duration, minutes, 0, 0)

      if (startDateTime < new Date()) {
        throw new Error('Start time cannot be in the past')
      }

      // Check availability for all weeks
      const availability = await validateBookingAvailabilityAction({
        courtId,
        startTimeISO: startDateTime.toISOString(),
        endTimeISO: endDateTime.toISOString(),
        recurrenceWeeks
      })

      if (!availability.available) {
        throw new Error(availability.error || 'Selected time is not available')
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
        recurrenceWeeks,
        selectedDays: selectedDays.length > 0 ? selectedDays : undefined
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
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
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
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Schedule</h3>
                  <p className="text-sm text-gray-600">Select date and time range</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Calendar & Recurrence */}
                  <div>
                    {/* Calendar */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3 block text-sm">Choose Date <span className="text-red-500">*</span></h4>
                      <div className="border border-gray-200 rounded-xl p-4 w-fit bg-white">
                        <DayPicker
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            if (date) {
                              setStartDate(date)
                              setStartTime('') // Reset time
                              setDuration(1)
                            }
                          }}
                          disabled={(date) => {
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            return date < today
                          }}
                          className="mx-auto"
                          modifiersClassNames={{
                            selected: 'bg-primary text-white hover:bg-primary',
                            today: 'font-bold text-primary',
                          }}
                        />

                        {/* Legend */}
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded" />
                            <span className="text-gray-600">Available</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-4 h-4 bg-gray-100 text-gray-400 flex items-center justify-center rounded text-[10px]">✕</div>
                            <span className="text-gray-600">Reserved / Unavailable</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-4 h-4 bg-primary rounded" />
                            <span className="text-gray-600">Selected</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recurrence */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <label className="text-sm font-semibold text-gray-900">Repeat Booking</label>
                      </div>

                      <select
                        value={recurrenceWeeks}
                        onChange={(e) => setRecurrenceWeeks(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-sm"
                      >
                        {[1, 2, 3, 4, 8].map((weeks) => (
                          <option key={weeks} value={weeks}>
                            {weeks === 1 ? 'One-time session' : `${weeks} Weeks`}
                          </option>
                        ))}
                      </select>

                      {recurrenceWeeks > 1 && (
                        <div className="mt-2 text-xs text-blue-700 bg-blue-50 px-2 py-1.5 rounded flex items-start gap-1.5 border border-blue-100">
                          <Info className="w-3 h-3 mt-0.5" />
                          <span>
                            Session will occur for <strong>{recurrenceWeeks} consecutive weeks</strong>.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Time Slots */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 text-sm">Select Time Range <span className="text-red-500">*</span></h4>
                      {duration > 1 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                          {duration} hours selected
                        </span>
                      )}
                    </div>

                    {!startDate ? (
                      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500 h-[400px] flex items-center justify-center">
                        <p className="text-sm">Select a date to see available times</p>
                      </div>
                    ) : isLoadingSlots ? (
                      <div className="flex items-center justify-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 h-[400px]">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <span className="text-sm text-gray-500">Checking availability...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col h-[400px]">
                        <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 shrink-0">
                          <p className="text-xs text-blue-700">
                            {!startTime ? "Tap a time to start" : "Tap another time to extend, or click start again to reset"}
                          </p>
                        </div>

                        <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
                          {timeSlots.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                              <p className="text-sm text-gray-500">No time slots available</p>
                            </div>
                          ) : (
                            timeSlots.map((slot, index) => {
                              const isSelected = isSlotSelected(slot)
                              const inRange = isSlotInRange(slot)
                              const disabled = !slot.available

                              return (
                                <button
                                  type="button"
                                  key={`${slot.time}-${index}`}
                                  onClick={() => handleTimeSelect(slot)}
                                  disabled={disabled}
                                  className={cn(
                                    "w-full px-4 py-3 text-left transition-all",
                                    disabled && "bg-gray-100 cursor-not-allowed opacity-60",
                                    isSelected && "bg-primary text-white",
                                    inRange && "bg-primary/10 text-primary-900",
                                    !disabled && !isSelected && !inRange && "hover:bg-gray-50"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      {/* Radio Circle */}
                                      <div className={cn(
                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                        disabled ? "border-gray-300 bg-gray-200" : isSelected ? "border-white bg-white" : "border-gray-300"
                                      )}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                      </div>

                                      <div>
                                        <p className={cn(
                                          "font-medium text-sm",
                                          isSelected ? "text-white" : disabled ? "text-gray-400" : "text-gray-900"
                                        )}>
                                          {formatSlotTime(slot.time)} - {formatSlotTime(getNextHour(slot.time))}
                                        </p>
                                        {disabled && <span className="text-[10px] text-red-500 font-medium uppercase">Reserved</span>}
                                      </div>
                                    </div>
                                    {/* Price/Selected Indicator */}
                                    <span className={cn(
                                      "text-xs font-semibold",
                                      isSelected ? "text-white" : disabled ? "text-gray-400" : "text-gray-700"
                                    )}>
                                      {isSelected || inRange ? 'Selected' : `₱${slot.price || selectedCourt?.hourly_rate || '-'}`}
                                    </span>
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
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
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        {startDate ? format(startDate, 'MMM d, yyyy') : '--'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {startTime || '--:--'} ({duration}h)
                      </div>
                      {recurrenceWeeks > 1 && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                          <TrendingUp className="w-4 h-4" />
                          {recurrenceWeeks} weekly sessions
                        </div>
                      )}
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
      </div >
    </div >
  )
}
