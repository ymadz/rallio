'use client'

import { useEffect, useState } from 'react'
import { useServerTime } from '@/hooks/use-server-time'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DevTimeToolbar() {
    const { date, offsetMs, updateOffset, refresh, isLoading } = useServerTime()
    const [isOpen, setIsOpen] = useState(false)
    const [customDate, setCustomDate] = useState('')

    // Don't render in production (double check, though layout should handle this)
    if (process.env.NODE_ENV === 'production') return null

    const handleAddOffset = (minutes: number) => {
        const additionalMs = minutes * 60 * 1000
        updateOffset(offsetMs + additionalMs)
    }

    const handleReset = () => {
        updateOffset(0)
    }

    const handleCustomDateSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!customDate) return

        const targetTime = new Date(customDate).getTime()
        if (isNaN(targetTime)) return

        const newOffset = targetTime - Date.now()
        updateOffset(newOffset)
    }

    if (!isOpen) {
        return (
            <Button
                variant="outline"
                size="sm"
                className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg bg-background border-primary/20 hover:border-primary"
                onClick={() => setIsOpen(true)}
            >
                <Clock className="w-4 h-4 mr-2" />
                {date ? date.toLocaleTimeString() : 'Loading...'}
            </Button>
        )
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-lg shadow-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-primary" />
                    Time Travel
                </h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Simulated Time</div>
                <div className="text-2xl font-mono font-medium text-primary">
                    {date ? date.toLocaleTimeString() : 'Syncing...'}
                </div>
                <div className="text-xs text-muted-foreground">
                    {date ? date.toLocaleDateString() : ''}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleAddOffset(15)} disabled={isLoading}>
                    +15m
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAddOffset(60)} disabled={isLoading}>
                    +1h
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAddOffset(24 * 60)} disabled={isLoading}>
                    +1 Day
                </Button>
                <Button variant="destructive" size="sm" onClick={handleReset} disabled={isLoading}>
                    Reset (Real Now)
                </Button>
            </div>

            <form onSubmit={handleCustomDateSubmit} className="flex gap-2">
                <Input
                    type="datetime-local"
                    className="h-8 text-xs"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                />
                <Button type="submit" size="sm" variant="secondary" className="h-8">
                    Go
                </Button>
            </form>

            <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                <span>Offset: {(offsetMs / 1000 / 60).toFixed(1)} min</span>
                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => refresh()}>
                    <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                </Button>
            </div>
        </div>
    )
}
