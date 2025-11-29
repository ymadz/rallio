import { Metadata } from 'next'
import { SessionManagementClient } from '@/components/queue-master/session-management-client'

export const metadata: Metadata = {
  title: 'Manage Session | Rallio',
  description: 'Monitor and manage your queue session',
}

interface Props {
  params: Promise<{
    id: string
  }>
}

export default async function SessionManagementPage({ params }: Props) {
  const { id } = await params
  return <SessionManagementClient sessionId={id} />
}
