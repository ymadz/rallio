'use client'

import { useState, useEffect } from 'react'

interface ServerTimeData {
    now: string
    offsetMs: number
    realTime: string
}

export function useServerTime() {
    const [date, setDate] = useState<Date | null>(null)
    const [offsetMs, setOffsetMs] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(true)

    const fetchTime = async () => {
        try {
            const res = await fetch('/api/dev/time')
            if (!res.ok) return
            const data: ServerTimeData = await res.json()

            const serverTime = new Date(data.now)
            setDate(serverTime)
            setOffsetMs(data.offsetMs)
            setIsLoading(false)
        } catch (error) {
            console.error('Failed to fetch server time', error)
            setIsLoading(false)
        }
    }

    // Poll for time updates every 5 seconds to keep UI roughly in sync
    // and check for external changes (other tabs/devices)
    useEffect(() => {
        fetchTime()
        const interval = setInterval(fetchTime, 5000)
        return () => clearInterval(interval)
    }, [])

    // Local ticker to update the displayed time every second based on last known offset
    useEffect(() => {
        if (!date) return

        const tick = setInterval(() => {
            setDate(prev => prev ? new Date(prev.getTime() + 1000) : null)
        }, 1000)

        return () => clearInterval(tick)
    }, [date])

    const updateOffset = async (newOffsetMs: number) => {
        try {
            setIsLoading(true)
            const res = await fetch('/api/dev/time', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ offsetMs: newOffsetMs }),
            })

            if (res.ok) {
                // Immediate refetch to confirm
                await fetchTime()
            }
        } catch (error) {
            console.error('Failed to update offset', error)
        } finally {
            setIsLoading(false)
        }
    }

    return {
        date,
        offsetMs,
        updateOffset,
        refresh: fetchTime,
        isLoading
    }
}
