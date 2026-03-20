'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { formatTo12Hour } from '@/lib/utils'
import { getAvailableTimeSlotsAction, checkCartAvailabilityAction } from '@/app/actions/reservations'
import { useCheckoutStore } from '@/stores/checkout-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AlertTriangle, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

interface Court {
  id: string
  name: string
  description: string | null
  surface_type: string
  court_type: string
  capacity: number
  hourly_rate: number
  is_active: boolean
}

interface TimeSlot {
  time: string
  available: boolean
  price?: number
}

interface SelectedCell {
  courtId: string
  time: string
}

type RepeatMode = 'none' | 'weekly' | 'custom'

interface VenueScheduleGridProps {
  courts: Court[]
  venueId: string
  venueName: string
}

function to12Hour(time: string) {
  return formatTo12Hour(time)
}

function nextHour(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const next = hours + 1
  return `${next.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return format(d, 'yyyy-MM-dd')
}

function shortDate(dateStr: string): string {
  return format(new Date(dateStr + 'T00:00:00'), 'MMM d')
}

export function VenueScheduleGrid({ courts, venueId, venueName }: VenueScheduleGridProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [slotsByCourt, setSlotsByCourt] = useState<Record<string, TimeSlot[]>>({})
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none')
  const [repeatWeeks, setRepeatWeeks] = useState(1)
  const [additionalDates, setAdditionalDates] = useState<string[]>([])
  const [isBooking, setIsBooking] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [validatingConflicts, setValidatingConflicts] = useState(false)
  const [activeConflicts, setActiveConflicts] = useState<any[]>([])
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [pendingCartItems, setPendingCartItems] = useState<any[]>([])

  const { bookingCart, setBookingCart, setDiscountDetails, setConflictingSlots } = useCheckoutStore()

  useEffect(() => {
    async function load() {
      if (!selectedDate || courts.length === 0) return
      setLoading(true)
      setSelectedCells([])

      try {
        const results = await Promise.all(
          courts.map(async (court) => {
            const slots = await getAvailableTimeSlotsAction(court.id, selectedDate)
            return { courtId: court.id, slots }
          })
        )

        const map: Record<string, TimeSlot[]> = {}
        for (const result of results) {
          map[result.courtId] = result.slots
        }

        setSlotsByCourt(map)
      } catch (error) {
        setSlotsByCourt({})
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [selectedDate, courts])

  const allDatesToBook = useMemo(() => {
    if (repeatMode === 'none') return [selectedDate]
    if (repeatMode === 'weekly') {
      const dates: string[] = []
      for (let i = 0; i < repeatWeeks; i++) {
        dates.push(addDays(selectedDate, i * 7))
      }
      return dates
    }
    return Array.from(new Set([selectedDate, ...additionalDates])).sort()
  }, [selectedDate, repeatMode, repeatWeeks, additionalDates])

  // Reactive Conflict Detection
  useEffect(() => {
    const checkConflicts = async () => {
      if (selectedCells.length === 0) {
        setActiveConflicts([])
        return
      }

      setValidatingConflicts(true)
      try {
        const cartItemsForCheck: any[] = []
        for (const date of allDatesToBook) {
          for (const cell of selectedCells) {
            cartItemsForCheck.push({
              courtId: cell.courtId,
              date: new Date(`${date}T${cell.time}:00`),
              startTime: cell.time,
              endTime: nextHour(cell.time),
              recurrenceWeeks: 1
            })
          }
        }

        const result = await checkCartAvailabilityAction(cartItemsForCheck)
        setActiveConflicts(result.conflicts || [])
      } catch (error) {
        console.error('Reactive validation failed:', error)
      } finally {
        setValidatingConflicts(false)
      }
    }

    const timer = setTimeout(checkConflicts, 400)
    return () => clearTimeout(timer)
  }, [selectedCells, allDatesToBook])

  const allTimes = useMemo(() => {
    const times = new Set<string>()
    Object.values(slotsByCourt).forEach((slots) => {
      slots.forEach((slot) => times.add(slot.time))
    })
    return Array.from(times).sort((a, b) => a.localeCompare(b))
  }, [slotsByCourt])

  const selectedTotal = useMemo(() => {
    return selectedCells.reduce((sum, cell) => {
      const court = courts.find((c) => c.id === cell.courtId)
      const slot = slotsByCourt[cell.courtId]?.find((s) => s.time === cell.time)
      return sum + Number(slot?.price || court?.hourly_rate || 0)
    }, 0)
  }, [selectedCells, courts, slotsByCourt])

  const validSlotCount = Math.max(0, (selectedCells.length * allDatesToBook.length) - activeConflicts.length)
  const accurateTotalEstimate = selectedCells.reduce((sum, cell) => {
    const court = courts.find((c) => c.id === cell.courtId)
    const slot = slotsByCourt[cell.courtId]?.find((s) => s.time === cell.time)
    const rate = Number(slot?.price || court?.hourly_rate || 0)
    
    const cellConflicts = activeConflicts.filter(c => c.courtId === cell.courtId && c.startTime === cell.time)
    const validDatesForCell = Math.max(0, allDatesToBook.length - cellConflicts.length)
    
    return sum + (rate * validDatesForCell)
  }, 0)

  const isSelected = (courtId: string, time: string) =>
    selectedCells.some((cell) => cell.courtId === courtId && cell.time === time)

  const isCellConflicted = (courtId: string, time: string) =>
    activeConflicts.some((c) => c.courtId === courtId && c.startTime === time)

  const toggleCell = (courtId: string, time: string) => {
    const slot = slotsByCourt[courtId]?.find((s) => s.time === time)
    if (!slot?.available) return

    setSelectedCells((prev) => {
      const exists = prev.some((cell) => cell.courtId === courtId && cell.time === time)
      if (exists) {
        return prev.filter((cell) => !(cell.courtId === courtId && cell.time === time))
      }
      return [...prev, { courtId, time }]
    })
  }

  const handleBookNow = async () => {
    if (selectedCells.length === 0 || isBooking || isChecking) {
      setNotice('Select at least one available slot first.')
      return
    }

    setIsBooking(true)
    const cartItems: any[] = []

    for (const date of allDatesToBook) {
      const dateCellsByCourt: Record<string, string[]> = {}
      for (const cell of selectedCells) {
        if (!dateCellsByCourt[cell.courtId]) dateCellsByCourt[cell.courtId] = []
        dateCellsByCourt[cell.courtId].push(cell.time)
      }

      for (const courtId in dateCellsByCourt) {
        const court = courts.find((c) => c.id === courtId)
        if (!court) continue

        const times = dateCellsByCourt[courtId].sort()
        const blocks: Array<{ start: string; end: string }> = []
        let currentBlock = { start: times[0], end: nextHour(times[0]) }

        for (let i = 1; i < times.length; i++) {
          const time = times[i]
          if (time === currentBlock.end) {
            currentBlock.end = nextHour(time)
          } else {
            blocks.push(currentBlock)
            currentBlock = { start: time, end: nextHour(time) }
          }
        }
        blocks.push(currentBlock)

        for (const block of blocks) {
          cartItems.push({
            courtId: court.id,
            courtName: court.name,
            venueId,
            venueName,
            date: new Date(`${date}T${block.start}:00`),
            startTime: block.start,
            endTime: block.end,
            hourlyRate: court.hourly_rate,
            capacity: court.capacity,
            recurrenceWeeks: 1,
          })
        }
      }
    }

    if (cartItems.length === 0) {
      setNotice('No valid slots to book.')
      setIsBooking(false)
      return
    }

    setIsChecking(true)
    try {
      const result = await checkCartAvailabilityAction(cartItems.map(item => ({
        courtId: item.courtId,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        recurrenceWeeks: 1
      })))

      if (!result.available && result.conflicts.length > 0) {
        setConflicts(result.conflicts)
        setPendingCartItems(cartItems)
        setConflictModalOpen(true)
        setIsChecking(false)
        setIsBooking(false)
        return
      }
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setIsChecking(false)
    }

    confirmBooking(cartItems, [])
  }

  const confirmBooking = (items: any[], conflictList: any[]) => {
    setIsBooking(true)
    
    // Filter out items that match a conflict in the conflictList
    const validItems = items.filter(item => {
      const itemDateStr = format(item.date, 'yyyy-MM-dd')
      const hasConflict = conflictList.some(c => 
        c.courtId === item.courtId && 
        c.startTime === item.startTime && 
        (c.dateISO === itemDateStr || c.date === format(item.date, 'MMM d, yyyy'))
      )
      return !hasConflict
    })

    setBookingCart(validItems)
    setConflictingSlots(conflictList)
    setDiscountDetails({ amount: 0, type: undefined, reason: undefined, discounts: [] })
    router.push('/checkout')
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  const shiftSelectedDate = (days: number) => {
    const nextDate = addDays(selectedDate, days)
    if (nextDate < today) return
    setSelectedDate(nextDate)
    setAdditionalDates((prev) => prev.filter((d) => d !== nextDate))
  }

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 md:p-6">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">Quick Multi-Court Booking</h3>
          <p className="text-sm text-gray-600">Select slots across courts. Use repeat options to book multiple days.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{repeatMode === 'none' ? 'Date' : 'Starting Date'}</span>
          <div className="flex items-center rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => shiftSelectedDate(-1)}
              disabled={selectedDate <= today}
              className="h-9 w-9 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="relative h-9 border-l border-r border-gray-200">
              <CalendarIcon className="h-4 w-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="venue-schedule-date"
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  const newDate = event.target.value
                  setSelectedDate(newDate)
                  setAdditionalDates((prev) => prev.filter((d) => d !== newDate))
                }}
                min={today}
                className="h-full w-[138px] bg-white text-sm text-gray-700 pl-8 pr-2 focus:outline-none"
                aria-label="Select date"
              />
            </div>

            <button
              type="button"
              onClick={() => shiftSelectedDate(1)}
              className="h-9 w-9 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50"
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Recurrence options */}
      <div className="flex flex-wrap items-start gap-y-3 gap-x-3 pb-4 border-b border-gray-100 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">Repeat:</span>
          {(['none', 'weekly', 'custom'] as RepeatMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setRepeatMode(mode)
                if (mode === 'none') setAdditionalDates([])
              }}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                repeatMode === mode
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:bg-primary/5',
              ].join(' ')}
            >
              {mode === 'none' ? 'No Repeat' : mode === 'weekly' ? 'Repeat Weekly' : 'Custom Dates'}
            </button>
          ))}
        </div>

        {repeatMode === 'weekly' && (
          <div className="flex items-center gap-2 w-full flex-wrap">
            <span className="text-sm text-gray-600">for</span>
            <select
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} weeks
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              ({allDatesToBook.length} dates:{' '}
              {allDatesToBook.slice(0, 4).map(shortDate).join(', ')}
              {allDatesToBook.length > 4 ? ` +${allDatesToBook.length - 4} more` : ''})
            </span>
          </div>
        )}

        {repeatMode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 w-full">
            <span className="text-xs text-gray-500 font-medium">Dates:</span>
            <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
              {shortDate(selectedDate)} (base)
            </span>
            {additionalDates.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full"
              >
                {shortDate(d)}
                <button
                  onClick={() => setAdditionalDates((prev) => prev.filter((x) => x !== d))}
                  className="ml-0.5 hover:text-red-500 font-bold leading-none"
                  aria-label={`Remove ${d}`}
                >
                  ×
                </button>
              </span>
            ))}
            <label className="cursor-pointer">
              <span className="text-xs text-primary font-medium border border-primary rounded-full px-2.5 py-1 hover:bg-primary/5 transition-colors">
                + Add date
              </span>
              <input
                type="date"
                min={today}
                className="sr-only"
                onChange={(e) => {
                  const val = e.target.value
                  if (val && val !== selectedDate && !additionalDates.includes(val)) {
                    setAdditionalDates((prev) => [...prev, val].sort())
                  }
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* Multi-date info banner */}
      {allDatesToBook.length > 1 && (
        <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <span className="shrink-0">ℹ️</span>
          <span>
            <strong>Multi-date mode:</strong> Availability shown is for{' '}
            <strong>{shortDate(selectedDate)}</strong>. Selected slots will be added for all{' '}
            <strong>{allDatesToBook.length} dates</strong>:{' '}
            {allDatesToBook.map(shortDate).join(', ')}.
          </span>
        </div>
      )}

      {notice && (
        <div className="mb-4 text-xs text-primary bg-primary/10 border border-primary/20 rounded px-3 py-2">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading schedule...</div>
      ) : allTimes.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">No time slots available for this date.</div>
      ) : (
        <>
          {/* Desktop/MatrixMatrix */}
          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">Time</th>
                  {courts.map((court) => (
                    <th key={court.id} className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 min-w-[160px]">
                      <div className="leading-tight">
                        <p>{court.name}</p>
                        <p className="text-xs font-normal text-gray-500">₱{court.hourly_rate}/hr</p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTimes.map((time) => (
                  <tr key={time} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap">
                      {to12Hour(time)} - {to12Hour(nextHour(time))}
                    </td>
                    {courts.map((court) => {
                      const slot = slotsByCourt[court.id]?.find((item) => item.time === time)
                      const available = !!slot?.available
                      const selected = isSelected(court.id, time)
                      const conflicted = selected && isCellConflicted(court.id, time)

                      return (
                        <td key={`${court.id}-${time}`} className="px-2 py-2">
                          <button
                            onClick={() => toggleCell(court.id, time)}
                            disabled={!available}
                            className={[
                              'w-full relative rounded-md px-2 py-2 text-xs font-medium transition-colors border flex flex-col items-center justify-center gap-0.5 overflow-hidden',
                              selected
                                ? conflicted 
                                  ? 'bg-amber-50 text-amber-700 border-amber-300' 
                                  : 'bg-primary text-white border-primary'
                                : available
                                  ? 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:bg-primary/5'
                                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed',
                            ].join(' ')}
                          >
                            {!available && (
                              <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
                                <div className="w-[140%] h-[1px] bg-gray-400 rotate-[25deg] transform" />
                                <div className="w-[140%] h-[1px] bg-gray-400 rotate-[-25deg] transform absolute" />
                              </div>
                            )}
                             <span>{selected ? (conflicted ? 'Conflicted' : 'Selected') : available ? 'Available' : (slot ? 'Booked' : 'Closed')}</span>
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile layout */}
          <div className="md:hidden space-y-3">
            {allTimes.map((time) => (
              <div key={time} className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">{to12Hour(time)} - {to12Hour(nextHour(time))}</p>
                <div className="grid grid-cols-2 gap-2">
                  {courts.map((court) => {
                    const slot = slotsByCourt[court.id]?.find((item) => item.time === time)
                    const available = !!slot?.available
                    const selected = isSelected(court.id, time)
                    const conflicted = selected && isCellConflicted(court.id, time)

                    return (
                      <button
                        key={`${court.id}-${time}`}
                        onClick={() => toggleCell(court.id, time)}
                        disabled={!available}
                        className={[
                          'rounded-md px-2 py-2 text-xs font-medium border text-left flex flex-col relative overflow-hidden',
                          selected
                            ? conflicted 
                              ? 'bg-amber-50 text-amber-700 border-amber-300' 
                              : 'bg-primary text-white border-primary'
                            : available
                              ? 'bg-white text-gray-700 border-gray-300'
                              : 'bg-gray-100 text-gray-400 border-gray-200',
                        ].join(' ')}
                      >
                        {!available && (
                          <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
                            <div className="w-[140%] h-[1px] bg-gray-400 rotate-[25deg] transform" />
                            <div className="w-[140%] h-[1px] bg-gray-400 rotate-[-25deg] transform absolute" />
                          </div>
                        )}
                        <p className="font-semibold truncate">{court.name}</p>
                        <p className="text-[10px] opacity-90">{selected ? (conflicted ? 'Conflicted' : 'Selected') : available ? 'Available' : (slot ? 'Booked' : 'Closed')}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Selected Slots: {selectedCells.length}
            {allDatesToBook.length > 1 && (
              <span className="text-gray-500 font-normal ml-1">
                × {allDatesToBook.length} dates = {selectedCells.length * allDatesToBook.length} bookings
              </span>
            )}
            {activeConflicts.length > 0 && (
              <span className="text-amber-600 font-medium ml-2">
                ({activeConflicts.length} conflicted)
              </span>
            )}
          </p>
          <p className="text-xs text-gray-600">
            Estimated subtotal:{' '}
            {allDatesToBook.length > 1 ? (
              <>
                <span className="line-through text-gray-400 mr-1">₱{(selectedTotal * allDatesToBook.length).toFixed(2)}</span>
                <span className="font-semibold text-gray-800">₱{accurateTotalEstimate.toFixed(2)}</span>
                <span className="text-gray-400 ml-1">({validSlotCount} valid slots)</span>
              </>
            ) : (
              <span>₱{accurateTotalEstimate.toFixed(2)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {validatingConflicts && <span className="text-[10px] text-gray-400 animate-pulse">Checking conflicts...</span>}
          <button
            onClick={() => setSelectedCells([])}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleBookNow}
            disabled={selectedCells.length === 0 || isBooking || isChecking || (activeConflicts.length === selectedCells.length * allDatesToBook.length)}
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm",
              activeConflicts.length > 0 && activeConflicts.length < selectedCells.length * allDatesToBook.length
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-primary text-white hover:bg-primary/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            ].join(" ")}
          >
            {isChecking ? 'Checking...' : isBooking ? 'Booking...' : 
             (activeConflicts.length === selectedCells.length * allDatesToBook.length && selectedCells.length > 0) ? 'All Slots Conflicted' :
             activeConflicts.length > 0 ? 'Review Conflicts' : 
             `Book Now (${validSlotCount} slot${validSlotCount !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>

      <Dialog open={conflictModalOpen} onOpenChange={setConflictModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <DialogTitle className="text-xl text-center">Conflict Resolution</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Some selected slots are unavailable. Review the valid slots below.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                Unavailable Slots (Excluded):
              </p>
              <ul className="space-y-1 max-h-[140px] overflow-y-auto">
                {conflicts.map((c, i) => (
                  <li key={i} className="text-[11px] text-amber-700 flex items-center gap-2">
                    <span className="shrink-0 w-1 h-1 rounded-full bg-amber-400" />
                    <span className="font-semibold">{c.date}</span> • {to12Hour(c.startTime)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">
                Valid Slots (To be Booked):
              </p>
              <p className="text-xs text-green-700 mb-3">
                Total: <span className="font-bold">{validSlotCount} sessions</span> • 
                Subtotal: <span className="font-bold">₱{accurateTotalEstimate.toFixed(2)}</span>
              </p>
              <p className="text-[11px] text-green-600 italic">
                Only these slots will be added to your booking summary.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <button
              onClick={() => setConflictModalOpen(false)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel / Adjust
            </button>
            <button
              onClick={() => confirmBooking(pendingCartItems, conflicts)}
              disabled={validSlotCount === 0}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              Confirm & Book Now
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
