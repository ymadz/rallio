/**
 * Queue Session Status Utilities
 * 
 * Standardized status definitions used across all UIs:
 * - Queue Master Dashboard
 * - Player Queue Dashboard  
 * - Court Admin Reservations
 * 
 * LIFECYCLE:
 * pending_payment → open → active → completed
 * 
 * Terminal states: completed, cancelled
 */

import {
  Clock,
  PlayCircle,
  CheckCircle,
  XCircle,
  DollarSign,
  type LucideIcon
} from 'lucide-react'

export type QueueSessionStatus =
  | 'pending_payment'  // Waiting for payment (cash or e-wallet)
  | 'open'             // Paid, players can join (within join window)
  | 'active'           // Currently running (start_time has passed)
  | 'completed'        // Finished (end_time passed or QM manually closed)
  | 'cancelled'        // Cancelled by QM or auto-cancelled (missed deadline)

/**
 * Hours before start_time when players can join the session.
 * Players see the session but can only join within this window.
 */
export const OPEN_BEFORE_START_HOURS = 12

/**
 * Display configuration for each status
 */
export const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: 'clock' | 'play' | 'check' | 'x' | 'dollar'
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
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    icon: 'x',
    canJoin: false,
  },
  // Legacy fallback — old rows that still have 'closed' in DB
  closed: {
    label: 'Completed',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    icon: 'check',
    canJoin: false,
  },
  // Legacy statuses — map to closest current equivalent
  draft: {
    label: 'Pending Payment',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    icon: 'dollar',
    canJoin: false,
  },
  pending_approval: {
    label: 'Pending Payment',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    icon: 'dollar',
    canJoin: false,
  },
  upcoming: {
    label: 'Open',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    icon: 'clock',
    canJoin: true,
  },
  paused: {
    label: 'Active',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    icon: 'play',
    canJoin: false,
  },
}

/**
 * Get the display configuration for a status
 */
export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending_payment
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
    case 'check': return CheckCircle
    case 'x': return XCircle
    case 'dollar': return DollarSign
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
 * Calculate what status a session SHOULD have based on current time.
 * Used for time-based auto-transitions (cron + inline corrections).
 */
export function calculateExpectedStatus(
  currentStatus: string,
  startTime: Date,
  endTime: Date,
  now: Date
): QueueSessionStatus {
  // Terminal states — don't change
  if (['cancelled', 'completed'].includes(currentStatus)) {
    // Legacy: treat 'closed' as 'completed'
    return currentStatus === 'closed' ? 'completed' : currentStatus as QueueSessionStatus
  }

  // Waiting for payment — don't auto-transition
  if (currentStatus === 'pending_payment') {
    return 'pending_payment'
  }

  // Time-based transitions for paid sessions (open, active)
  // Past end_time → completed
  if (endTime < now) {
    return 'completed'
  }

  // Between start and end → active
  if (startTime <= now && endTime > now) {
    return 'active'
  }

  // Before start → open
  return 'open'
}

/**
 * Helper to format time until session opens for joining
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
  return ['completed', 'closed', 'cancelled'].includes(status)
}

/**
 * Check if a session is in an "active" state (not finished, not pending)
 */
export function isSessionActive(status: string): boolean {
  return ['open', 'active'].includes(status)
}

/**
 * Check if a session is awaiting payment
 */
export function isAwaitingPayment(status: string): boolean {
  return status === 'pending_payment'
}

/**
 * Check if a player can join based on time window.
 * Players can only join within OPEN_BEFORE_START_HOURS of start_time.
 */
export function isWithinJoinWindow(startTime: Date, now: Date): boolean {
  const msUntilStart = startTime.getTime() - now.getTime()
  const hoursUntilStart = msUntilStart / (1000 * 60 * 60)
  return hoursUntilStart <= OPEN_BEFORE_START_HOURS
}
