import { Metadata } from 'next'
import { QueueSessionSummaryClient } from '@/components/queue-master/queue-session-summary-client'

export const metadata: Metadata = {
  title: 'Session Summary | Rallio',
  description: 'View comprehensive queue session summary with participants, matches, and payments',
}

interface Props {
  params: Promise<{
    id: string
  }>
}

export default async function SessionSummaryPage({ params }: Props) {
  const { id } = await params
  return <QueueSessionSummaryClient sessionId={id} />
}
