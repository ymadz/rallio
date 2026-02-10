'use client'

import { Activity, Clock, CheckCircle } from 'lucide-react'

interface QueueStatusBadgeProps {
  status: 'waiting' | 'active' | 'completed' | 'upcoming' | 'live'
  size?: 'sm' | 'md' | 'lg'
}

export function QueueStatusBadge({ status, size = 'md' }: QueueStatusBadgeProps) {
  const config = {
    waiting: {
      icon: Clock,
      label: 'Waiting',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      iconClassName: 'text-yellow-600',
    },
    upcoming: {
      icon: Clock,
      label: 'Upcoming',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
      iconClassName: 'text-blue-600',
    },
    live: {
      icon: Activity,
      label: 'Live Now',
      className: 'bg-green-100 text-green-700 border-green-200',
      iconClassName: 'text-green-600',
    },
    active: {
      icon: Activity,
      label: 'Active',
      className: 'bg-green-100 text-green-700 border-green-200',
      iconClassName: 'text-green-600',
    },
    completed: {
      icon: CheckCircle,
      label: 'Completed',
      className: 'bg-gray-100 text-gray-700 border-gray-200',
      iconClassName: 'text-gray-600',
    },
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const { icon: Icon, label, className, iconClassName } = config[status]

  return (
    <div className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${className} ${sizeClasses[size]}`}>
      <Icon className={`${iconSizes[size]} ${iconClassName}`} />
      <span>{label}</span>
    </div>
  )
}
