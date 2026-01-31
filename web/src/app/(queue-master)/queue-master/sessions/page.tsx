import { Metadata } from 'next'
import { QueueMasterDashboard } from '@/components/queue-master/queue-master-dashboard'

export const metadata: Metadata = {
    title: 'Sessions | Queue Master Dashboard | Rallio',
    description: 'View and manage all your queue sessions',
}

export default function SessionsPage() {
    return <QueueMasterDashboard />
}
