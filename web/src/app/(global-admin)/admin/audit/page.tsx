import AuditLogsViewer from '@/components/global-admin/audit-logs-viewer'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audit Logs | Admin',
  description: 'Admin activity audit trail',
}

export default function AuditPage() {
  return (
    <div className="p-8">
      <AuditLogsViewer />
    </div>
  )
}
