import { Metadata } from 'next'
import { QueueMasterDashboard } from '@/components/queue-master/queue-master-dashboard'

export const metadata: Metadata = {
  title: 'Queue Master Dashboard | Rallio',
  description: 'Manage your queue sessions and organize matches',
}

export default function QueueMasterPage() {
  return <QueueMasterDashboard />
}
