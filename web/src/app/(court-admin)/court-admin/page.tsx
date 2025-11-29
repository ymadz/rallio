import { Metadata } from 'next'
import { CourtAdminDashboard } from '@/components/court-admin/court-admin-dashboard'

export const metadata: Metadata = {
  title: 'Court Admin Dashboard | Rallio',
  description: 'Manage your venues, courts, and reservations',
}

export default function CourtAdminPage() {
  return <CourtAdminDashboard />
}
