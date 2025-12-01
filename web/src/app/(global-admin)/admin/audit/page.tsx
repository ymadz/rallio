import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audit Logs | Admin',
  description: 'Admin activity audit trail',
}

export default function AuditPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Audit Logs</h1>
      <p className="text-gray-600">Coming soon...</p>
    </div>
  )
}
