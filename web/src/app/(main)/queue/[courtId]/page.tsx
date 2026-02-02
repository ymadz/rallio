import { Suspense } from 'react'
import { QueueDetailsClient } from './queue-details-client'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

interface QueuePageProps {
  params: Promise<{ courtId: string }>
}

export async function generateMetadata({ params }: QueuePageProps) {
  return {
    title: 'Queue | Rallio',
    description: 'Join the queue and wait for your turn',
  }
}

export default async function QueuePage({ params }: QueuePageProps) {
  const { courtId } = await params

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Breadcrumbs */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-3 h-16">
            <Link
              href="/queue"
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to queue dashboard"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/queue" className="text-gray-500 hover:text-gray-700 transition-colors">
                Queue
              </Link>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-900 font-semibold">Court Queue</span>
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl pb-24 md:pb-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <QueueDetailsClient courtId={courtId} />
        </Suspense>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    </div>
  )
}
