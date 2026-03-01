import { Suspense } from 'react'
import { QueueDashboardClient } from './queue-dashboard-client'

export const metadata = {
  title: 'Queue Dashboard | Rallio',
  description: 'Manage your active queues and join new ones',
}

export default function QueueDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}


      {/* Content */}
      <div className="p-6 max-w-4xl mx-auto">
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
