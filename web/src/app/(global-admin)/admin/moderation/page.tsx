import { Metadata } from 'next'
import ModerationDashboard from '@/components/global-admin/moderation-dashboard'

export const metadata: Metadata = {
  title: 'Content Moderation | Admin',
  description: 'Moderate platform content',
}

export default function ModerationPage() {
  return <ModerationDashboard />
}
