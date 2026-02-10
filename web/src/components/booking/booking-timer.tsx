'use client'

import { useEffect, useState } from 'react'
import { differenceInMinutes, differenceInSeconds } from 'date-fns'
import { Clock } from 'lucide-react'
import { useServerTime } from '@/hooks/use-server-time'

interface BookingTimerProps {
    endTime: string
}

export function BookingTimer({ endTime }: BookingTimerProps) {
    const { date: serverDate } = useServerTime()
    const [timeLeft, setTimeLeft] = useState('')

    useEffect(() => {
        if (!serverDate) return

        const end = new Date(endTime)
        // serverDate is already a Date object representing the simulated "now"
        const diffInSecs = differenceInSeconds(end, serverDate)

        if (diffInSecs <= 0) {
            setTimeLeft('Ending soon...')
            return
        }

        const hours = Math.floor(diffInSecs / 3600)
        const minutes = Math.floor((diffInSecs % 3600) / 60)
        const seconds = diffInSecs % 60

        if (hours > 0) {
            setTimeLeft(`${hours}h ${minutes}m remaining`)
        } else {
            setTimeLeft(`${minutes}m ${seconds}s remaining`)
        }
    }, [endTime, serverDate])

    if (!serverDate) return null

    return (
        <div className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full animate-pulse">
            <Clock className="w-4 h-4" />
            <span>{timeLeft}</span>
        </div>
    )
}
