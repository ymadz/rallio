import { Metadata } from 'next'
import GlobalAdminDashboard from '@/components/global-admin/global-admin-dashboard'

export const metadata: Metadata = {
  title: 'Admin Dashboard | Rallio',
  description: 'Global administration dashboard',
}

export default function AdminDashboardPage() {
  return <GlobalAdminDashboard />
}
