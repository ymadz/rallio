'use client'

import { useMyQueues } from '@/hooks/use-queue'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Hook to get active queue count for navbar badge
 */
export function useQueueBadge() {
  const { queues } = useMyQueues()
  const activeCount = queues.filter(q => q.status === 'active' || q.status === 'waiting').length

  return {
    count: activeCount,
    hasQueues: activeCount > 0,
  }
}

/**
 * Hook to check if we should show queue badge based on current route
 */
export function useShouldShowQueueBadge() {
  const pathname = usePathname()
  const [shouldShow, setShouldShow] = useState(true)

  useEffect(() => {
    // Don't show badge on queue pages themselves to reduce clutter
    setShouldShow(!pathname?.startsWith('/queue'))
  }, [pathname])

  return shouldShow
}
