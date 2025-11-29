'use client'

import { Circle, Play, CheckCircle, Calendar } from 'lucide-react'

interface MatchStatusBadgeProps {
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  size?: 'sm' | 'md'
  className?: string
}

const statusConfig = {
  scheduled: {
    label: 'Scheduled',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Calendar,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: Play,
  },
  completed: {
    label: 'Completed',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: Circle,
  },
}

export function MatchStatusBadge({
  status,
  size = 'sm',
  className = ''
}: MatchStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.scheduled
  const Icon = config.icon

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2.5 py-1'
    : 'text-sm px-3 py-1.5'

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full font-medium border
        ${config.color}
        ${sizeClasses}
        ${className}
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}
