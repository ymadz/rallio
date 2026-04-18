import { Suspense } from 'react'
import { MatchTrackerClient } from './match-tracker-client'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

interface MatchPageProps {
  params: Promise<{ courtId: string; matchId: string }>
}

export async function generateMetadata({ params }: MatchPageProps) {
  return {
    title: 'Match Tracker | Rallio',
    description: 'Track your live match progress',
  }
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { courtId, matchId } = await params

  return (
    <div className="min-h-screen bg-white">
      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl pb-24 md:pb-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <MatchTrackerClient courtId={courtId} matchId={matchId} />
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
