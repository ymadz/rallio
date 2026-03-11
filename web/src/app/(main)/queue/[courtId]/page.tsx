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


      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8">
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
