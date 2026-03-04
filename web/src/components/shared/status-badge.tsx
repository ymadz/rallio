import * as React from 'react'
import { Activity, Clock, CheckCircle, XCircle, RefreshCw, AlertCircle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatusValue =
    // Base statuses
    | 'pending' | 'waiting' | 'upcoming'
    | 'open' | 'confirmed' | 'processing'
    | 'live' | 'active' | 'ongoing'
    | 'completed' | 'succeeded' | 'refunded'
    | 'failed' | 'cancelled' | 'rejected'
    // Derived or specific 
    | 'pending_payment' | 'partially_paid' | 'pending_refund'

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    status: StatusValue | string
    label?: string // Optional override for the display label
    size?: 'sm' | 'md' | 'lg'
}

export function StatusBadge({
    status,
    label: customLabel,
    size = 'md',
    className,
    ...props
}: StatusBadgeProps) {
    // Normalize status to handle any custom strings passed, falling back to gray
    const normalizedStatus = status?.toString().toLowerCase() || 'unknown'

    // Default config structure
    let Icon = Clock
    let bgClass = 'bg-gray-100'
    let textClass = 'text-gray-700'
    let borderClass = 'border-gray-200'
    let iconClass = 'text-gray-500'
    let spin = false
    let defaultLabel = normalizedStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

    // Mappings
    if (['pending', 'waiting', 'pending_payment', 'partially_paid', 'pending_refund', 'upcoming', 'pending_reschedule'].includes(normalizedStatus)) {
        Icon = normalizedStatus === 'pending_reschedule' ? Calendar : Clock
        bgClass = 'bg-yellow-50'
        textClass = 'text-yellow-700'
        borderClass = 'border-yellow-200'
        iconClass = 'text-yellow-500'

        if (normalizedStatus === 'waiting') defaultLabel = 'Waiting'
        else if (normalizedStatus === 'pending_payment') defaultLabel = 'Awaiting Payment'
        else if (normalizedStatus === 'partially_paid') defaultLabel = 'Partially Paid'
        else if (normalizedStatus === 'pending_refund') defaultLabel = 'Pending Refund'
        else if (normalizedStatus === 'pending_reschedule') defaultLabel = 'Pending Reschedule'
    }
    else if (['processing'].includes(normalizedStatus)) {
        Icon = RefreshCw
        bgClass = 'bg-blue-50'
        textClass = 'text-blue-700'
        borderClass = 'border-blue-200'
        iconClass = 'text-blue-500'
        spin = true
    }
    else if (['open', 'confirmed'].includes(normalizedStatus)) {
        Icon = CheckCircle
        bgClass = 'bg-blue-50'
        textClass = 'text-blue-700'
        borderClass = 'border-blue-200'
        iconClass = 'text-blue-500'
    }
    else if (['live', 'active', 'ongoing'].includes(normalizedStatus)) {
        Icon = Activity
        bgClass = 'bg-green-50'
        textClass = 'text-green-700'
        borderClass = 'border-green-200'
        iconClass = 'text-green-500'

        if (normalizedStatus === 'live') defaultLabel = 'Live Now'
    }
    else if (['completed', 'succeeded'].includes(normalizedStatus)) {
        Icon = CheckCircle
        bgClass = 'bg-emerald-50'
        textClass = 'text-emerald-700'
        borderClass = 'border-emerald-200'
        iconClass = 'text-emerald-500'
    }
    else if (['failed', 'cancelled', 'rejected'].includes(normalizedStatus)) {
        Icon = XCircle
        bgClass = 'bg-red-50'
        textClass = 'text-red-700'
        borderClass = 'border-red-200'
        iconClass = 'text-red-500'
    }
    else if (['refunded'].includes(normalizedStatus)) {
        Icon = CheckCircle
        bgClass = 'bg-gray-100'
        textClass = 'text-gray-700'
        borderClass = 'border-gray-200'
        iconClass = 'text-gray-500'
    }

    const label = customLabel || defaultLabel

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs sm:text-sm',
        lg: 'px-3 py-1.5 text-sm sm:text-base',
    }

    const iconSizes = {
        sm: 'w-3 h-3',
        md: 'w-3.5 h-3.5',
        lg: 'w-4 h-4',
    }

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1.5 font-medium rounded-full border shadow-sm w-fit transition-colors',
                bgClass,
                textClass,
                borderClass,
                sizeClasses[size],
                className
            )}
            {...props}
        >
            <Icon className={cn(iconSizes[size], iconClass, spin && 'animate-spin')} />
            <span className="whitespace-nowrap leading-none pt-px">{label}</span>
        </div>
    )
}
