import { Metadata } from 'next'
import UserManagement from '@/components/global-admin/user-management'

export const metadata: Metadata = {
  title: 'User Management | Admin',
  description: 'Manage platform users, roles, and permissions',
}

export default function UsersPage() {
  return <UserManagement />
}
