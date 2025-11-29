import { Metadata } from 'next'
import { SessionAnalyticsDashboard } from '@/components/queue-master/session-analytics-dashboard'

export const metadata: Metadata = {
  title: 'Analytics | Queue Master',
  description: 'View session analytics and performance insights',
}

export default function AnalyticsPage() {
  return <SessionAnalyticsDashboard />
}
