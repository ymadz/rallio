'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import 'react-day-picker/dist/style.css'
import { useCheckoutStore } from '@/stores/checkout-store'
import { getAvailableTimeSlotsAction, validateBookingAvailabilityAction, getVenueMetadataAction } from '@/app/actions/reservations'
import { calculateApplicableDiscounts } from '@/app/actions/discount-actions'
import { cn } from '@/lib/utils'
import { QueueTutorial } from './queue-tutorial'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface TimeSlot {
    time: string
    available: boolean
    price?: number
}

interface QueueSessionModalProps {
    isOpen: boolean
    onClose: () => void
    courtId: string
    courtName: string
    hourlyRate: number
    venueId: string
    venueName: string
    capacity: number
}

export function QueueSessionModal({
    isOpen,
    onClose,
    courtId,
    courtName,
    hourlyRate,
    venueId,
    venueName,
    capacity
}: QueueSessionModalProps) {
    const router = useRouter()
    const { setBookingData, setDiscountDetails, setDiscount, setDownPaymentPercentage } = useCheckoutStore()
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [recurrenceWeeks, setRecurrenceWeeks] = useState<number>(1)
    const [selectedDays, setSelectedDays] = useState<number[]>([])

    // Time slot selection
    const [startSlot, setStartSlot] = useState<TimeSlot | null>(null)
    const [endSlot, setEndSlot] = useState<TimeSlot | null>(null)
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
    const [loading, setLoading] = useState(false)
    const [isBooking, setIsBooking] = useState(false)

    // Queue session settings
    const [mode, setMode] = useState<'casual' | 'competitive'>('casual')
    const [gameFormat, setGameFormat] = useState<'singles' | 'doubles' | 'mixed'>('doubles')
    const [maxPlayers, setMaxPlayers] = useState(8)
    const [costPerGame, setCostPerGame] = useState(50)
    const [isPublic, setIsPublic] = useState(true)

    // UI step: 'schedule' or 'settings'
    const [step, setStep] = useState<'schedule' | 'settings'>('schedule')

    // Pricing state
    const [calculatedPrice, setCalculatedPrice] = useState<{
        original: number
        final: number
        discount: number
        appliedDiscountName?: string
    } | null>(null)
    const [isCalculatingPrice, setIsCalculatingPrice] = useState(false)

    // Validation state
    const [validationState, setValidationState] = useState<{
        valid: boolean
        validating: boolean
        error?: string
    }>({ valid: true, validating: false })

    // Reset selected days when date changes
    useEffect(() => {
        setSelectedDays([selectedDate.getDay()])
    }, [selectedDate])

    // Fetch time slots
    useEffect(() => {
        async function fetchTimeSlots() {
            if (!selectedDate || !isOpen) return
            setLoading(true)
            setStartSlot(null)
            setEndSlot(null)

            try {
                const slots = await getAvailableTimeSlotsAction(courtId, format(selectedDate, 'yyyy-MM-dd'))
                setTimeSlots(slots)
            } catch (error) {
                console.error('Error fetching time slots:', error)
                setTimeSlots([])
            } finally {
                setLoading(false)
            }
        }

        fetchTimeSlots()
    }, [selectedDate, courtId, isOpen])

    // Fetch venue metadata (down payment percentage)
    useEffect(() => {
        async function fetchVenueMetadata() {
            if (!venueId || !isOpen) return

            try {
                const result = await getVenueMetadataAction(venueId)
                if (result.success && result.metadata) {
                    const percentage = parseFloat((result.metadata as any).down_payment_percentage || '20')
                    setDownPaymentPercentage(percentage)
                }
            } catch (error) {
                console.error('Error fetching venue metadata:', error)
            }
        }

        fetchVenueMetadata()
    }, [venueId, isOpen, setDownPaymentPercentage])

    // Helpers
    const getDuration = (): number => {
        if (!startSlot) return 0
        if (!endSlot) return 1
        const startIndex = timeSlots.findIndex(s => s.time === startSlot.time)
        const endIndex = timeSlots.findIndex(s => s.time === endSlot.time)
        if (startIndex === -1 || endIndex === -1) return 0
        return endIndex - startIndex + 1
    }

    const getEndTime = (): string => {
        const targetSlot = endSlot || startSlot
        if (!targetSlot) return ''
        const [hours, minutes] = targetSlot.time.split(':').map(Number)
        const endHour = hours + 1
        return `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }

    const formatTime = (time: string) => {
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

    // Calculate pricing whenever slots or recurrence changes
    useEffect(() => {
        async function calculatePrice() {
            if (!startSlot) {
                setCalculatedPrice(null)
                return
            }

            setIsCalculatingPrice(true)
            const duration = getDuration()
            const endTime = getEndTime()

            // Calculate actual slots that will be created
            const initialStartTime = new Date(selectedDate)
            const [startH, startM] = startSlot.time.split(':')
            initialStartTime.setHours(parseInt(startH), parseInt(startM || '0'), 0, 0)
            const startDayIndex = initialStartTime.getDay()

            const uniqueSelectedDays = selectedDays.length > 0
                ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
                : [startDayIndex]

            let actualSlotCount = 0
            for (let i = 0; i < recurrenceWeeks; i++) {
                for (const dayIndex of uniqueSelectedDays) {
                    actualSlotCount++
                }
            }

            const basePrice = (startSlot.price || hourlyRate) * duration * actualSlotCount

            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd')
                const startDateTime = `${dateStr}T${startSlot.time}:00+08:00`
                const endDateTime = `${dateStr}T${endTime}:00+08:00`

                const result = await calculateApplicableDiscounts({
                    venueId,
                    courtId,
                    startDate: startDateTime,
                    endDate: endDateTime,
                    recurrenceWeeks: Number(recurrenceWeeks),
                    basePrice
                })

                if (result.success) {
                    const discountName = result.discounts.length > 0 ? result.discounts[0].name : 'Seasonal Offer'

                    setCalculatedPrice({
                        original: basePrice,
                        final: result.finalPrice,
                        discount: result.totalDiscount,
                        appliedDiscountName: discountName
                    })
                } else {
                    setCalculatedPrice({
                        original: basePrice,
                        final: basePrice,
                        discount: 0
                    })
                }
            } catch (err) {
                console.error("Price calc error", err)
                setCalculatedPrice({
                    original: basePrice,
                    final: basePrice,
                    discount: 0
                })
            } finally {
                setIsCalculatingPrice(false)
            }
        }

        calculatePrice()
    }, [startSlot, endSlot, recurrenceWeeks, selectedDate, courtId, venueId, hourlyRate, selectedDays])

    // Validate recurring availability
    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        async function validateRecurring() {
            if (!startSlot || (!recurrenceWeeks && selectedDays.length <= 1)) {
                setValidationState({ valid: true, validating: false })
                return
            }

            setValidationState(prev => ({ ...prev, validating: true, valid: true, error: undefined }))

            const endTime = getEndTime()

            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd')
                const startDateTime = `${dateStr}T${startSlot.time}:00+08:00`
                const endDateTime = `${dateStr}T${endTime}:00+08:00`

                const result = await validateBookingAvailabilityAction({
                    courtId,
                    startTimeISO: startDateTime,
                    endTimeISO: endDateTime,
                    recurrenceWeeks,
                    selectedDays
                })

                if (!result.available) {
                    setValidationState({
                        valid: false,
                        validating: false,
                        error: result.error,
                    })
                } else {
                    setValidationState({ valid: true, validating: false })
                }
            } catch (err) {
                console.error("Validation error", err)
                setValidationState({ valid: false, validating: false, error: "Validation failed." })
            }
        }

        timeoutId = setTimeout(validateRecurring, 500)
        return () => clearTimeout(timeoutId)
    }, [startSlot, endSlot, recurrenceWeeks, selectedDays, selectedDate, courtId])

    // Range validation
    const isRangeValid = (start: TimeSlot, end: TimeSlot): boolean => {
        const startIndex = timeSlots.findIndex(s => s.time === start.time)
        const endIndex = timeSlots.findIndex(s => s.time === end.time)
        if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return false
        for (let i = startIndex; i <= endIndex; i++) {
            if (!timeSlots[i].available) return false
        }
        return true
    }

    const handleSlotClick = (clickedSlot: TimeSlot) => {
        if (!clickedSlot.available) return

        if (!startSlot || (startSlot && endSlot)) {
            setStartSlot(clickedSlot)
            setEndSlot(null)
            return
        }

        const startIndex = timeSlots.findIndex(s => s.time === startSlot.time)
        const clickedIndex = timeSlots.findIndex(s => s.time === clickedSlot.time)

        if (clickedIndex < startIndex) {
            setStartSlot(clickedSlot)
            setEndSlot(null)
        } else if (clickedIndex === startIndex) {
            setEndSlot(null)
        } else {
            if (isRangeValid(startSlot, clickedSlot)) {
                setEndSlot(clickedSlot)
            } else {
                setStartSlot(clickedSlot)
                setEndSlot(null)
            }
        }
    }

    const handleContinueToSettings = () => {
        if (startSlot && validationState.valid) {
            setStep('settings')
        }
    }

    const handleBook = () => {
        if (!startSlot || isBooking || !validationState.valid) return

        setIsBooking(true)

        try {
            const duration = getDuration()
            const endTime = getEndTime()

            setBookingData({
                courtId,
                courtName,
                venueId,
                venueName,
                date: selectedDate,
                startTime: startSlot.time,
                endTime: endTime,
                hourlyRate,
                capacity,
                recurrenceWeeks,
                selectedDays,
                isQueueSession: true,
                queueSessionData: {
                    mode,
                    gameFormat,
                    maxPlayers,
                    costPerGame,
                    isPublic,
                },
            })

            // Set discount details if calculated
            if (calculatedPrice) {
                setDiscountDetails({
                    amount: calculatedPrice.discount,
                    type: undefined,
                    reason: calculatedPrice.discount > 0 ? 'Discount applied' : 'Surcharge applied'
                })
            } else {
                setDiscount(0)
            }

            router.push('/checkout')
        } catch (error) {
            console.error('Error setting booking data:', error)
            setIsBooking(false)
        }
    }

    // Styling helpers
    const isSlotSelected = (slot: TimeSlot) => {
        if (!startSlot) return false
        if (startSlot.time === slot.time) return true
        if (endSlot && endSlot.time === slot.time) return true
        return false
    }

    const isSlotInRange = (slot: TimeSlot) => {
        if (!startSlot || !endSlot) return false
        const startIndex = timeSlots.findIndex(s => s.time === startSlot.time)
        const endIndex = timeSlots.findIndex(s => s.time === endSlot.time)
        const currentIndex = timeSlots.findIndex(s => s.time === slot.time)
        return currentIndex > startIndex && currentIndex < endIndex
    }

    if (!isOpen) return null

    const duration = getDuration()
    const disabledDays = { before: new Date() }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                onClick={onClose}
            />

            <QueueTutorial isOpen={isOpen} view={step} />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-6 py-4 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold">{courtName}</h3>
                                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                    Queue Session
                                </span>
                            </div>
                            <p className="text-sm text-white/80 mt-1">
                                {step === 'schedule' ? 'Select time range' : 'Configure game settings'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                        {step === 'schedule' ? (
                            /* Step 1: Schedule Selection */
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Calendar */}
                                <div>
                                    <div id="qm-tour-calendar">
                                        <h4 className="font-semibold text-gray-900 mb-3">Choose Date</h4>
                                        <div className="border border-gray-200 rounded-xl p-4">
                                        <DayPicker
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={(date) => date && setSelectedDate(date)}
                                            disabled={disabledDays}
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
                                    <div id="qm-tour-repeat" className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <Label className="text-sm font-semibold text-gray-900">Repeat Booking</Label>
                                        </div>

                                        <Select
                                            value={recurrenceWeeks.toString()}
                                            onValueChange={(val) => setRecurrenceWeeks(parseInt(val))}
                                        >
                                            <SelectTrigger className="w-full bg-white border-gray-300">
                                                <SelectValue placeholder="Do not repeat" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 Week (One-time)</SelectItem>
                                                <SelectItem value="2">2 Weeks</SelectItem>
                                                <SelectItem value="3">3 Weeks</SelectItem>
                                                <SelectItem value="4">4 Weeks</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {recurrenceWeeks > 1 && (
                                            <div className="mt-2 text-xs text-blue-700 bg-blue-50 px-2 py-1.5 rounded flex items-start gap-1.5 border border-blue-100">
                                                <span className="mt-0.5">ℹ️</span>
                                                <span>
                                                    Session will be created for <strong>{recurrenceWeeks} consecutive weeks</strong> at this time.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Multi-Day Selection */}
                                    {recurrenceWeeks >= 1 && (
                                        <div id="qm-tour-days" className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xl">📅</span>
                                                <Label className="text-sm font-semibold text-gray-900">Include Days</Label>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                                                    const isPrimaryDay = index === selectedDate.getDay()
                                                    const isSelected = selectedDays.includes(index)

                                                    return (
                                                        <button
                                                            key={day}
                                                            disabled={isPrimaryDay}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setSelectedDays(prev => prev.filter(d => d !== index))
                                                                } else {
                                                                    setSelectedDays(prev => [...prev, index].sort())
                                                                }
                                                            }}
                                                            className={cn(
                                                                "px-3 py-1.5 rounded text-xs font-medium border transition-colors",
                                                                isSelected
                                                                    ? "bg-primary text-white border-primary"
                                                                    : "bg-white text-gray-700 border-gray-300 hover:border-primary/50",
                                                                isPrimaryDay && "opacity-60 cursor-not-allowed"
                                                            )}
                                                        >
                                                            {day}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Select additional days to book at the same time slot.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Time Slots */}
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-3">
                                        Select Time Range
                                    </h4>

                                    <div id="qm-tour-time" className="border border-gray-200 rounded-xl overflow-hidden flex flex-col h-[400px]">
                                        {loading ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary" />
                                                <p className="text-sm text-gray-500 mt-3">Loading time slots...</p>
                                            </div>
                                        ) : timeSlots.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-8">
                                                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p className="text-sm text-gray-500">No time slots available</p>
                                                <p className="text-xs text-gray-400 mt-1">Please select another date</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 shrink-0">
                                                    <p className="text-xs text-blue-700">
                                                        {!startSlot ? (
                                                            "Tap a time to start your booking"
                                                        ) : !endSlot ? (
                                                            "Tap another time to end your booking, or book 1 hour"
                                                        ) : (
                                                            `${duration} hours selected`
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
                                                    {timeSlots.map((slot, index) => {
                                                        const isSelected = isSlotSelected(slot)
                                                        const inRange = isSlotInRange(slot)
                                                        const disabled = !slot.available

                                                        return (
                                                            <button
                                                                key={`${slot.time}-${index}`}
                                                                onClick={() => handleSlotClick(slot)}
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
                                                                        <div className={cn(
                                                                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                                                            disabled ? "border-gray-300 bg-gray-200" : isSelected ? "border-white bg-white" : "border-gray-300"
                                                                        )}>
                                                                            {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                                        </div>
                                                                        <div>
                                                                            <p className={cn(
                                                                                "font-medium",
                                                                                isSelected ? "text-white" : disabled ? "text-gray-400" : "text-gray-900"
                                                                            )}>
                                                                                {formatTime(slot.time)} - {formatTime(getNextHour(slot.time))}
                                                                            </p>
                                                                            {disabled && <span className="text-xs text-red-500 font-medium">Reserved</span>}
                                                                        </div>
                                                                    </div>
                                                                    <span className={cn(
                                                                        "text-sm font-semibold",
                                                                        isSelected ? "text-white" : disabled ? "text-gray-400" : "text-gray-700"
                                                                    )}>
                                                                        ₱{slot.price || hourlyRate}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Step 2: Game Settings */
                            <div className="space-y-6">
                                {/* Session Summary */}
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">Session Schedule</h4>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <p><strong>Court:</strong> {courtName}</p>
                                        <p>
                                            <strong>Date:</strong>{' '}
                                            {(() => {
                                                if (selectedDays.length <= 1 && recurrenceWeeks === 1) {
                                                    return format(selectedDate, 'MMM d, yyyy')
                                                }

                                                // Generate exact dates
                                                const initialStartTime = new Date(selectedDate)
                                                const [startH, startM] = (startSlot?.time || "00:00").split(':')
                                                initialStartTime.setHours(parseInt(startH), parseInt(startM || '0'), 0, 0)
                                                const startDayIndex = initialStartTime.getDay()

                                                const uniqueSelectedDays = selectedDays.length > 0
                                                    ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
                                                    : [startDayIndex]

                                                const bookedDates: Date[] = []

                                                for (let i = 0; i < recurrenceWeeks; i++) {
                                                    for (const dayIndex of uniqueSelectedDays) {
                                                        const dayOffset = (dayIndex - startDayIndex + 7) % 7
                                                        const slotStartTime = new Date(initialStartTime.getTime())
                                                        slotStartTime.setDate(slotStartTime.getDate() + (i * 7) + dayOffset)
                                                        bookedDates.push(slotStartTime)
                                                    }
                                                }

                                                bookedDates.sort((a, b) => a.getTime() - b.getTime())

                                                return (
                                                    <div className="mt-2 text-xs">
                                                        <p className="font-medium text-gray-700 mb-1">Booked Dates ({bookedDates.length}):</p>
                                                        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-1.5 bg-white/50 rounded-md border border-primary/10">
                                                            {bookedDates.map((date, idx) => (
                                                                <span key={idx} className="bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md shadow-sm">
                                                                    {format(date, 'MMM d (E)')}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </p>
                                        <p><strong>Time:</strong> {startSlot && formatTime(startSlot.time)} - {formatTime(getEndTime())}</p>
                                        <p><strong>Duration:</strong> {duration} hour{duration > 1 ? 's' : ''}</p>
                                    </div>
                                </div>

                                {/* Session Mode */}
                                <div id="qm-tour-mode">
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

                                {/* Game Format */}
                                <div id="qm-tour-format">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Game Format <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['singles', 'doubles', 'mixed'] as const).map((fmt) => (
                                            <button
                                                key={fmt}
                                                type="button"
                                                onClick={() => setGameFormat(fmt)}
                                                className={`p-4 border-2 rounded-lg text-center transition-all ${gameFormat === fmt
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className="font-semibold text-gray-900 mb-1 capitalize">{fmt}</div>
                                                <div className="text-xs text-gray-600">
                                                    {fmt === 'singles' ? '2 players' : '4 players'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Max Players */}
                                <div id="qm-tour-players">
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

                                {/* Cost Per Game */}
                                <div id="qm-tour-cost">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Cost Per Game (₱) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={costPerGame}
                                        onChange={(e) => setCostPerGame(Number(e.target.value))}
                                        min="0"
                                        step="10"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>

                                {/* Visibility */}
                                <div id="qm-tour-public" className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <div>
                                        <p className="font-medium text-gray-900">Public Session</p>
                                        <p className="text-xs text-gray-500">Allow anyone to find and join</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isPublic}
                                            onChange={(e) => setIsPublic(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
                        <div>
                            {startSlot && (
                                <div className="text-sm">
                                    {/* Validation Error */}
                                    {!validationState.valid && validationState.error && (
                                        <div className="mb-2 bg-red-50 border border-red-200 rounded-lg p-2 text-sm flex items-start gap-2 max-w-sm animate-pulse">
                                            <span className="text-red-500 mt-0.5">⚠️</span>
                                            <div className="flex-1">
                                                <p className="font-semibold text-red-800 text-xs uppercase tracking-wide">Cannot Book</p>
                                                <p className="text-red-700 font-medium leading-tight">{validationState.error}</p>
                                            </div>
                                        </div>
                                    )}
                                    {validationState.validating && (
                                        <div className="mb-2 text-xs text-blue-600 flex items-center gap-1.5">
                                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent" />
                                            Checking availability...
                                        </div>
                                    )}

                                    <p className="text-gray-600">
                                        <span className="font-medium text-gray-900">Selected:</span>{' '}
                                        {(() => {
                                            if (selectedDays.length <= 1 && recurrenceWeeks === 1) {
                                                return format(selectedDate, 'MMM d, yyyy')
                                            }

                                            // Generate exact dates
                                            const initialStartTime = new Date(selectedDate)
                                            const [startH, startM] = startSlot.time.split(':')
                                            initialStartTime.setHours(parseInt(startH), parseInt(startM || '0'), 0, 0)
                                            const startDayIndex = initialStartTime.getDay()

                                            const uniqueSelectedDays = selectedDays.length > 0
                                                ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
                                                : [startDayIndex]

                                            const bookedDates: Date[] = []

                                            for (let i = 0; i < recurrenceWeeks; i++) {
                                                for (const dayIndex of uniqueSelectedDays) {
                                                    const dayOffset = (dayIndex - startDayIndex + 7) % 7
                                                    const slotStartTime = new Date(initialStartTime.getTime())
                                                    slotStartTime.setDate(slotStartTime.getDate() + (i * 7) + dayOffset)
                                                    bookedDates.push(slotStartTime)
                                                }
                                            }

                                            bookedDates.sort((a, b) => a.getTime() - b.getTime())
                                            const formattedDates = bookedDates.map(d => format(d, 'MMM d'))

                                            if (formattedDates.length <= 3) {
                                                return formattedDates.join(', ') + (formattedDates.length > 0 ? `, ${format(bookedDates[0], 'yyyy')}` : '')
                                            } else {
                                                return `${formattedDates[0]}, ${formattedDates[1]} + ${formattedDates.length - 2} more (${format(bookedDates[0], 'yyyy')})`
                                            }
                                        })()}
                                    </p>
                                    <p className="text-gray-600">
                                        {formatTime(startSlot.time)} - {formatTime(getEndTime())}
                                    </p>
                                    {/* Price + Discount inline */}
                                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                                        {isCalculatingPrice ? (
                                            <span className="text-sm font-normal text-gray-400 flex items-center gap-1.5">
                                                <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-300 border-t-primary rounded-full" />
                                                Calculating price...
                                            </span>
                                        ) : calculatedPrice ? (
                                            <>
                                                {Number(calculatedPrice.discount) !== 0 && (
                                                    <span className="text-sm text-gray-400 line-through">₱{Number(calculatedPrice.original || 0).toLocaleString()}</span>
                                                )}
                                                <span className="text-lg font-bold text-primary">₱{Number(calculatedPrice.final || 0).toLocaleString()}</span>
                                                {calculatedPrice.discount !== 0 && calculatedPrice.appliedDiscountName && (
                                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${Number(calculatedPrice.discount) > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                        </svg>
                                                        {calculatedPrice.appliedDiscountName}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            (() => {
                                                const getDisplayBasePrice = () => {
                                                    const initialStartTime = new Date(selectedDate)
                                                    const [startH, startM] = startSlot.time.split(':')
                                                    initialStartTime.setHours(parseInt(startH), parseInt(startM || '0'), 0, 0)
                                                    const startDayIndex = initialStartTime.getDay()
                                                    const uniqueSelectedDays = selectedDays.length > 0
                                                        ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
                                                        : [startDayIndex]

                                                    let actualSlotCount = 0
                                                    for (let i = 0; i < recurrenceWeeks; i++) {
                                                        for (const dayIndex of uniqueSelectedDays) {
                                                            actualSlotCount++
                                                        }
                                                    }
                                                    return Number(hourlyRate * duration * actualSlotCount).toLocaleString()
                                                }
                                                return <span className="text-lg font-bold text-primary">₱{getDisplayBasePrice()}</span>
                                            })()
                                        )}
                                        {Number(recurrenceWeeks) > 1 && <span className="text-xs font-normal text-gray-500">({recurrenceWeeks} weeks)</span>}
                                        {selectedDays.length > 1 && <span className="text-xs font-normal text-gray-500">({selectedDays.length} days/week)</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {step === 'settings' && (
                                <button
                                    onClick={() => setStep('schedule')}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                disabled={isBooking}
                            >
                                Cancel
                            </button>
                            {step === 'schedule' ? (
                                <button
                                    id="qm-tour-next"
                                    onClick={handleContinueToSettings}
                                    disabled={!startSlot || !validationState.valid || validationState.validating || isCalculatingPrice}
                                    className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    Next: Game Settings
                                </button>
                            ) : (
                                <button
                                    id="qm-tour-book"
                                    onClick={handleBook}
                                    disabled={isBooking || isCalculatingPrice}
                                    className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isBooking ? 'Processing...' : `Book Queue Session (${duration} hr${duration > 1 ? 's' : ''})`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
