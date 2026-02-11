/**
 * Queue Session Status Utilities
 * 
 * Standardized status definitions used across all UIs:
 * - Queue Master Dashboard
 * - Player Queue Dashboard  
 * - Court Admin Reservations
 * 
 * LIFECYCLE:
 * pending_payment → upcoming → open → active → completed
 */

import { 
  Clock, 
  PlayCircle, 
  PauseCircle, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  Calendar,
  type LucideIcon 
} from 'lucide-react'

export type QueueSessionStatus = 
  | 'pending_payment'  // Waiting for payment
  | 'upcoming'         // Paid, > 2h before start
  | 'open'             // Within 2h of start, players can join
  | 'active'           // Currently running
  | 'completed'        // Finished
  | 'paused'           // Temporarily paused
  | 'cancelled'        // Cancelled
  | 'rejected'         // Court Admin rejected
  // Legacy statuses (for backwards compatibility)
  | 'draft'
  | 'pending_approval'
  | 'closed'

/**
 * Hours before start_time when session transitions from 'upcoming' to 'open'
 */
export const OPEN_BEFORE_START_HOURS = 2

/**
 * Display configuration for each status
 */
export const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: 'clock' | 'play' | 'pause' | 'check' | 'x' | 'dollar' | 'calendar'
  canJoin: boolean
}> = {
  pending_payment: {
    label: 'Pending Payment',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    icon: 'dollar',
    canJoin: false,
  },
  upcoming: {
    label: 'Upcoming',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
    icon: 'calendar',
    canJoin: false,
  },
  open: {
    label: 'Open',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    icon: 'clock',
    canJoin: true,
  },
  active: {
    label: 'Active',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    icon: 'play',
    canJoin: true,
  },
  completed: {
    label: 'Completed',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    icon: 'check',
    canJoin: false,
  },
  paused: {
    label: 'Paused',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
    icon: 'pause',
    canJoin: false,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    icon: 'x',
    canJoin: false,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    icon: 'x',
    canJoin: false,
  },
  // Legacy mappings
  closed: {
    label: 'Completed',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    icon: 'check',
    canJoin: false,
  },
  draft: {
    label: 'Draft',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: 'clock',
    canJoin: false,
  },
  pending_approval: {
    label: 'Pending Approval',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    icon: 'clock',
    canJoin: false,
  },
}

/**
 * Get the display configuration for a status
 */
export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.upcoming
}

/**
 * Get the CSS classes for a status badge
 */
export function getStatusBadgeClasses(status: string): string {
  const config = getStatusConfig(status)
  return `${config.bgColor} ${config.color} ${config.borderColor}`
}

/**
 * Get the display label for a status
 */
export function getStatusLabel(status: string): string {
  return getStatusConfig(status).label
}

/**
 * Get the icon component for a status
 */
export function getStatusIcon(status: string): LucideIcon {
  const config = getStatusConfig(status)
  switch (config.icon) {
    case 'clock': return Clock
    case 'play': return PlayCircle
    case 'pause': return PauseCircle
    case 'check': return CheckCircle
    case 'x': return XCircle
    case 'dollar': return DollarSign
    case 'calendar': return Calendar
    default: return Clock
  }
}

/**
 * Check if players can join a session based on its status
 */
export function canPlayersJoin(status: string): boolean {
  return getStatusConfig(status).canJoin
}

/**
 * Calculate what status a session SHOULD have based on current time
 * This is used for time-based auto-transitions
 */
export function calculateExpectedStatus(
  currentStatus: string,
  startTime: Date,
  endTime: Date,
  now: Date
): QueueSessionStatus {
  // Terminal states - don't change
  if (['cancelled', 'rejected', 'completed', 'closed'].includes(currentStatus)) {
    return currentStatus === 'closed' ? 'completed' : currentStatus as QueueSessionStatus
  }

  // Waiting for payment - don't auto-transition
  if (currentStatus === 'pending_payment') {
    return 'pending_payment'
  }

  // Paused - don't auto-transition (Queue Master controls this)
  if (currentStatus === 'paused') {
    // But if end_time passed while paused, complete it
    if (endTime < now) {
      return 'completed'
    }
    return 'paused'
  }

  // Time-based transitions for paid sessions
  const msUntilStart = startTime.getTime() - now.getTime()
  const hoursUntilStart = msUntilStart / (1000 * 60 * 60)

  // Past end_time → completed
  if (endTime < now) {
    return 'completed'
  }

  // Between start and end → active
  if (startTime <= now && endTime > now) {
    return 'active'
  }

  // Within 2 hours of start → open
  if (hoursUntilStart <= OPEN_BEFORE_START_HOURS) {
    return 'open'
  }

  // More than 2 hours before start → upcoming
  return 'upcoming'
}

/**
 * Helper to format time until session opens
 */
export function getTimeUntilOpen(startTime: Date, now: Date): string {
  const openTime = new Date(startTime.getTime() - OPEN_BEFORE_START_HOURS * 60 * 60 * 1000)
  const msUntilOpen = openTime.getTime() - now.getTime()
  
  if (msUntilOpen <= 0) return 'Now'
  
  const hours = Math.floor(msUntilOpen / (1000 * 60 * 60))
  const minutes = Math.floor((msUntilOpen % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Check if a session is in a "finished" state
 */
export function isSessionFinished(status: string): boolean {
  return ['completed', 'closed', 'cancelled', 'rejected'].includes(status)
}

/**
 * Check if a session is in an "active" state (not finished, not pending)
 */
export function isSessionActive(status: string): boolean {
  return ['upcoming', 'open', 'active', 'paused'].includes(status)
}

/**
 * Check if a session is awaiting payment
 */
export function isAwaitingPayment(status: string): boolean {
  return status === 'pending_payment'
}
