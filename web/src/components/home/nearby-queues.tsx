'use client'

import Link from 'next/link'
import { useNearbyQueues } from '@/hooks/use-queue'
import { Spinner } from '@/components/ui/spinner'

export function NearbyQueues() {
  const { queues, isLoading } = useNearbyQueues()

  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex items-center justify-center">
        <Spinner className="text-primary" />
        <span className="ml-2 text-sm text-gray-500">Loading active queues...</span>
      </div>
    )
  }

  // Don't render the section if there are no active queues
  if (queues.length === 0) {
    return null
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Active Queues Nearby</h2>
          <p className="text-xs text-gray-500 mt-0.5">Join a game in progress</p>
        </div>
        <Link href="/queue" className="text-sm font-medium text-primary hover:text-primary/80">
          See all
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {queues.map((queue) => (
          <Link
            key={queue.id}
            href={`/queue/${queue.courtId}`}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{queue.courtName}</h3>
                <p className="text-sm text-gray-500 truncate">{queue.venueName}</p>
              </div>
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${queue.status === 'active' ? 'bg-green-100 text-green-700' :
                  queue.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                }`}>
                {queue.status === 'active' ? 'Live' :
                  queue.status === 'waiting' ? 'Open' :
                    'Completed'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="text-gray-600">
                  {queue.players.filter(p => p.status === 'waiting').length} waiting
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600">~{queue.estimatedWaitTime} min</span>
              </div>
            </div>

            {queue.currentMatch && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Current match: {queue.currentMatch.players.join(' vs ')}
                </p>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
