'use client'

import { useState, useMemo, useEffect } from 'react'
import { Calendar as CalendarIcon, Clock, User, Phone, CheckCircle, XCircle } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getVenueCourts } from '@/app/actions/court-admin-actions'
import { cn } from '@/lib/utils'

interface Reservation {
    id: string
    court: {
        id: string
        name: string
        venue: {
            id: string
            name: string
        }
    }
    user: {
        id: string
        display_name?: string
        first_name?: string
        last_name?: string
        phone?: string
    }
    start_time: string
    end_time: string
    status: string
    metadata?: any
    // other fields omitted for brevity
}

interface Court {
    id: string
    name: string
    venue_id: string
    venues: {
        name: string
    }
    operating_hours: any
}

interface CourtAdminCalendarProps {
    reservations: Reservation[]
    onSelectReservation?: (reservation: any) => void
}

export function CourtAdminCalendar({ reservations, onSelectReservation }: CourtAdminCalendarProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const courts = useMemo(() => {
        const uniqueCourts = new Map<string, Court>()
        reservations.forEach(r => {
            if (!uniqueCourts.has(r.court.id)) {
                uniqueCourts.set(r.court.id, {
                    id: r.court.id,
                    name: r.court.name,
                    venue_id: r.court.venue.id,
                    venues: { name: r.court.venue.name },
                    operating_hours: null
                })
            }
        })
        return Array.from(uniqueCourts.values())
    }, [reservations])

    const [selectedCourtId, setSelectedCourtId] = useState<string>('all')

    // Generate slots for a day (6:00 AM to 11:00 PM for simplicity, or based on reservations)
    const timeSlots = useMemo(() => {
        const slots = []
        for (let i = 6; i <= 23; i++) {
            slots.push(`${i.toString().padStart(2, '0')}:00`)
        }
        return slots
    }, [])

    const getReservationsForDateAndCourt = (date: Date, courtId: string) => {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        return reservations.filter((r) => {
            const rDate = new Date(r.start_time)
            const isRightDate = rDate >= startOfDay && rDate <= endOfDay
            const isRightCourt = courtId === 'all' || r.court.id === courtId
            const isNotCancelled = !['cancelled', 'rejected'].includes(r.status)
            return isRightDate && isRightCourt && isNotCancelled
        })
    }

    const dailyReservations = useMemo(
        () => getReservationsForDateAndCourt(selectedDate, selectedCourtId),
        [reservations, selectedDate, selectedCourtId]
    )

    const formatTime = (time: string): string => {
        const [hours, minutes] = time.split(':').map(Number)
        const period = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours % 12 || 12
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    }

    const getSlotStatus = (timeSlot: string, courtId: string) => {
        // Find if there is a reservation for this slot on this court
        const [slotHour, slotMin] = timeSlot.split(':').map(Number)

        const reservation = dailyReservations.find(r => {
            if (r.court.id !== courtId) return false

            const rStart = new Date(r.start_time)
            const rEnd = new Date(r.end_time)

            const slotTime = new Date(selectedDate)
            slotTime.setHours(slotHour, slotMin, 0, 0)

            return slotTime >= rStart && slotTime < rEnd
        })

        return reservation
    }

    const courtsToDisplay = selectedCourtId === 'all'
        ? courts
        : courts.filter(c => c.id === selectedCourtId)



    // Constants for grid Math
    const START_HOUR = 6 // 6 AM
    const END_HOUR = 23 // 11 PM
    const TOTAL_HOURS = END_HOUR - START_HOUR + 1
    const COLUMN_WIDTH = 160 // px per hour

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Top Bar: Controls */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 border border-input rounded-md px-3 py-1.5 shadow-sm bg-white">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium whitespace-nowrap">
                            {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {/* We use a simple native date picker input here to save immense space over the Shadcn Calendar for this view type, 
                            or we can just wrap the Shadcn calendar in a Popover. For admin speed, let's keep it visible but compact. */}
                        <input
                            type="date"
                            value={selectedDate.toISOString().split('T')[0]}
                            onChange={(e) => e.target.value && setSelectedDate(new Date(e.target.value))}
                            className="text-sm border-none outline-none bg-transparent cursor-pointer text-gray-500 w-[20px]"
                        />
                    </div>

                    <div className="w-[200px]">
                        <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="All Courts" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Courts</SelectItem>
                                {courts.map(court => (
                                    <SelectItem key={court.id} value={court.id}>
                                        {court.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> Confirmed</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div> Pending</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Ongoing</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-gray-200"></div> Available</div>
                </div>
            </div>

            {/* Grid Container */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar max-h-[700px]">
                    <div className="min-w-max relative" style={{ width: `calc(150px + ${TOTAL_HOURS * COLUMN_WIDTH}px)` }}>

                        {/* Header Row: Time Slots */}
                        <div className="flex sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 h-10 shadow-sm">
                            {/* Top Left Empty Corner */}
                            <div className="w-[150px] sticky left-0 z-30 bg-gray-50 border-r border-gray-200 flex-shrink-0"></div>

                            {/* Time Columns */}
                            <div className="flex flex-1 relative">
                                {timeSlots.map((time) => (
                                    <div
                                        key={time}
                                        className="h-10 border-r border-gray-200 flex items-center justify-center text-xs font-medium text-gray-500 flex-shrink-0"
                                        style={{ width: `${COLUMN_WIDTH}px` }}
                                    >
                                        {formatTime(time)}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Body: Courts as Rows */}
                        {courtsToDisplay.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 absolute w-full left-0">No courts found.</div>
                        ) : (
                            <div className="flex flex-col relative z-10 bg-white">
                                {courtsToDisplay.map((court, courtIndex) => {
                                    return (
                                        <div key={court.id} className="flex border-b border-gray-100 group hover:bg-gray-50/50 transition-colors min-h-[110px]">
                                            {/* Court Name (Sticky Left) */}
                                            <div className="w-[150px] sticky left-0 z-20 bg-white group-hover:bg-gray-50/90 border-r border-gray-200 flex-shrink-0 flex flex-col justify-center px-4 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                                                <span className="font-semibold text-sm text-gray-900 truncate">{court.name}</span>
                                                <span className="text-xs text-gray-500 truncate">{court.venues?.name}</span>
                                            </div>

                                            {/* Court Timeline Area */}
                                            <div className="flex-1 relative py-2">
                                                {/* Background Grid Lines rendering hourly slots for visual alignment */}
                                                <div className="absolute inset-0 flex pointer-events-none">
                                                    {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                                                        <div key={i} className="h-full border-r border-gray-100 flex-shrink-0" style={{ width: `${COLUMN_WIDTH}px` }} />
                                                    ))}
                                                </div>

                                                {/* Foreground: Render Reservations specific to this court and day as absolute positioned blocks */}
                                                {dailyReservations
                                                    .filter(r => r.court.id === court.id)
                                                    .map(res => {
                                                        const resStart = new Date(res.start_time)
                                                        const resEnd = new Date(res.end_time)

                                                        // Convert times to hours relative to START_HOUR
                                                        const startDecimal = resStart.getHours() + (resStart.getMinutes() / 60)
                                                        const endDecimal = resEnd.getHours() + (resEnd.getMinutes() / 60)

                                                        // Ensure block doesn't flow off grid
                                                        const boundedStart = Math.max(START_HOUR, startDecimal)
                                                        const boundedEnd = Math.min(END_HOUR + 1, endDecimal)

                                                        // Calculate position and width
                                                        const leftOffset = (boundedStart - START_HOUR) * COLUMN_WIDTH
                                                        const width = (boundedEnd - boundedStart) * COLUMN_WIDTH

                                                        // Skip if completely outside grid hours
                                                        if (width <= 0 || boundedEnd <= START_HOUR || boundedStart >= END_HOUR + 1) return null

                                                        // Determine styles based on status
                                                        const effectiveStatus = res.status === 'pending_payment' ? 'pending' : res.status
                                                        let statusClass = "bg-blue-100/80 border-blue-300 text-blue-900 hover:bg-blue-100"
                                                        let dotClass = "bg-blue-500"

                                                        if (effectiveStatus === 'confirmed' || effectiveStatus === 'completed') {
                                                            statusClass = "bg-green-100/80 border-green-300 text-green-900 hover:bg-green-100"
                                                            dotClass = "bg-green-500"
                                                        } else if (effectiveStatus === 'pending') {
                                                            statusClass = "bg-yellow-100/80 border-yellow-300 text-yellow-900 hover:bg-yellow-100"
                                                            dotClass = "bg-yellow-500"
                                                        } else if (effectiveStatus === 'ongoing') {
                                                            statusClass = "bg-purple-100/80 border-purple-300 text-purple-900 hover:bg-purple-100 ring-1 ring-purple-400"
                                                            dotClass = "bg-purple-500"
                                                        } else if (effectiveStatus === 'cancelled') {
                                                            statusClass = "bg-red-50/80 border-red-200 text-red-900 opacity-60 hover:opacity-100 hover:bg-red-100"
                                                            dotClass = "bg-red-500"
                                                        }

                                                        const customerName = res.user?.display_name ||
                                                            `${res.user?.first_name || ''} ${res.user?.last_name || ''}`.trim() ||
                                                            'Customer'

                                                        return (
                                                            <div
                                                                key={res.id}
                                                                className={cn(
                                                                    "absolute top-2.5 bottom-2.5 rounded-lg border shadow-sm p-2 flex flex-col overflow-hidden transition-all cursor-pointer group hover:shadow-md z-10",
                                                                    statusClass
                                                                )}
                                                                style={{
                                                                    left: `${leftOffset}px`,
                                                                    width: `${width - 4}px`, // -4px for a small gap between adjacent blocks
                                                                }}
                                                                title={`${customerName} - ${formatTime(resStart.toTimeString().substring(0, 5))} to ${formatTime(resEnd.toTimeString().substring(0, 5))}`}
                                                                onClick={() => {
                                                                    if (onSelectReservation) {
                                                                        onSelectReservation(res)
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <div className={cn("w-2 h-2 rounded-full shrink-0", dotClass)} />
                                                                        <span className="font-semibold text-xs truncate leading-none">{customerName}</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-medium opacity-70 shrink-0 capitalize">{effectiveStatus}</span>
                                                                </div>
                                                                <div className="text-[10px] font-medium opacity-80 mt-auto truncate flex items-center gap-1">
                                                                    <Clock className="w-3 h-3 shrink-0" />
                                                                    {formatTime(resStart.toTimeString().substring(0, 5))} - {formatTime(resEnd.toTimeString().substring(0, 5))}
                                                                </div>

                                                                {/* Hover/Expand affordance overlay if block is very small */}
                                                                {width < 100 && (
                                                                    <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
                                                                        <span className="bg-white px-2 py-1 rounded text-xs shadow-sm font-medium whitespace-nowrap">View</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}

                                                {/* Highlight Current Time if viewing Today */}
                                                {selectedDate.toDateString() === new Date().toDateString() && (() => {
                                                    const now = new Date()
                                                    const currentDecimal = now.getHours() + (now.getMinutes() / 60)
                                                    if (currentDecimal >= START_HOUR && currentDecimal <= END_HOUR + 1) {
                                                        const currentLeft = (currentDecimal - START_HOUR) * COLUMN_WIDTH
                                                        return (
                                                            <div
                                                                className="absolute top-0 bottom-0 pointer-events-none z-20 border-l-2 border-primary/50"
                                                                style={{ left: `${currentLeft}px` }}
                                                            >
                                                                {courtIndex === 0 && (
                                                                    <div className="absolute top-[-10px] left-[-4px] w-2 h-2 rounded-full bg-primary shadow-[0_0_4px_rgba(13,148,136,0.6)]" />
                                                                )}
                                                            </div>
                                                        )
                                                    }
                                                    return null
                                                })()}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
