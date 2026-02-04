'use client'

import { cn } from '@/lib/utils'
import { Check, Lock } from 'lucide-react'

export interface TimeSlot {
    time: string // HH:mm format
    available: boolean
    price?: number
}

interface SessionTimePickerProps {
    slots: TimeSlot[]
    selectedTime?: string
    duration: number
    onSelectTime: (time: string) => void
    disabled?: boolean
    className?: string
}

export function SessionTimePicker({
    slots,
    selectedTime,
    duration,
    onSelectTime,
    disabled = false,
    className,
}: SessionTimePickerProps) {

    // Helper to format time from 24h to 12h format
    const formatSlotTime = (startTimeStr: string) => {
        const [hours, minutes] = startTimeStr.split(':').map(Number)
        const startPeriod = hours >= 12 ? 'PM' : 'AM'
        const startHour = hours % 12 || 12

        // We just show Start Time here because the end time depends on selection
        return `${startHour}:${minutes.toString().padStart(2, '0')} ${startPeriod}`
    }

    // Helper to check if a range starting at 'time' is fully available
    const isRangeAvailable = (startTime: string) => {
        const startHour = parseInt(startTime.split(':')[0])
        for (let i = 0; i < duration; i++) {
            const h = startHour + i
            const timeString = `${h.toString().padStart(2, '0')}:00`
            const slot = slots.find(s => s.time === timeString)
            if (!slot || !slot.available) return false
        }
        return true
    }

    if (slots.length === 0) {
        return (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                No time slots available for this day.
            </div>
        )
    }

    return (
        <div className={cn("space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar", className)}>
            {slots.map((slot) => {
                // Calculate logic for range highlighting
                const slotHour = parseInt(slot.time.split(':')[0])
                let isInRange = false
                let isStart = false

                if (selectedTime) {
                    const startHour = parseInt(selectedTime.split(':')[0])
                    const endHour = startHour + duration

                    if (slotHour === startHour) isStart = true
                    if (slotHour >= startHour && slotHour < endHour) isInRange = true
                }

                // Check availability
                // For the start slot, we check the FULL duration
                // For other slots, we just show their individual availability?
                // Actually, if we are in "selection mode", the user might click a later slot.
                // The `isRangeAvailable` helper checks if a duration starts from this slot.
                // But visually we want to show if this specific slot is available.
                const available = slot.available
                const canSelect = available && !disabled

                return (
                    <button
                        key={slot.time}
                        type="button"
                        disabled={!canSelect}
                        onClick={() => onSelectTime(slot.time)}
                        className={cn(
                            "w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group text-left",
                            isInRange
                                ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20"
                                : canSelect
                                    ? "bg-white border-gray-200 hover:border-primary/50 hover:bg-gray-50"
                                    : "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            {/* Radio-style Circular Indicator */}
                            <div className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                isInRange
                                    ? "border-primary bg-white"
                                    : canSelect
                                        ? "border-gray-300 group-hover:border-primary"
                                        : "border-gray-200 bg-gray-50"
                            )}>
                                {isInRange && (
                                    <div className={cn("w-3 h-3 rounded-full bg-primary", !isStart && "opacity-50")} />
                                )}
                            </div>

                            <div>
                                <div className={cn(
                                    "font-semibold text-sm",
                                    isInRange ? "text-primary" : canSelect ? "text-gray-900" : "text-gray-400"
                                )}>
                                    {formatSlotTime(slot.time)}
                                </div>
                                {!available && (
                                    <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                                        Reserved
                                    </div>
                                )}
                                {isStart && duration > 1 && (
                                    <div className="text-[11px] text-primary font-medium mt-0.5">
                                        Starts here • {duration} hours
                                    </div>
                                )}
                            </div>
                        </div>

                        {slot.price !== undefined && (
                            <div className={cn(
                                "font-bold text-sm",
                                isInRange ? "text-primary" : canSelect ? "text-gray-900" : "text-gray-400"
                            )}>
                                ₱{slot.price}
                            </div>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
