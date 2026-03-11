import { Suspense } from 'react'
import { QueueDashboardClient } from './queue-dashboard-client'

export const metadata = {
  title: 'Queue Dashboard | Rallio',
  description: 'Manage your active queues and join new ones',
}

export default function QueueDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}


      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Suspense fallback={<LoadingSkeleton />}>
          <QueueDashboardClient />
        </Suspense>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 h-40" />
        ))}
      </div>
    </div>
  )
}
