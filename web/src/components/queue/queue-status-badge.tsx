'use client'

import { StatusBadge } from '@/components/shared/status-badge'

interface QueueStatusBadgeProps {
  status: 'waiting' | 'active' | 'completed' | 'open' | 'live'
  size?: 'sm' | 'md' | 'lg'
}

export function QueueStatusBadge({ status, size = 'md' }: QueueStatusBadgeProps) {
  return <StatusBadge status={status} size={size} />
}
