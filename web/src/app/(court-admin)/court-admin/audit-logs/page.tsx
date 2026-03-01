import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import {
    ClipboardList,
    Search,
    User,
    Activity,
    Database,
    Clock,
    Info
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AuditLogsPage() {
    const supabase = await createClient()

    // Fetch audit logs with profile info
    const { data: logs, error } = await supabase
        .from('audit_logs')
        .select(`
      *,
      profile:profiles(display_name, first_name, last_name, email)
    `)
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    Error loading audit logs: {error.message}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-primary" />
                        Audit Logs
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Track significant actions across the platform
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        Timestamp
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-2">
                                        <User className="w-3 h-3" />
                                        User
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-3 h-3" />
                                        Action
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-3 h-3" />
                                        Resource
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center gap-2">
                                        <Info className="w-3 h-3" />
                                        Details
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {logs && logs.length > 0 ? (
                                logs.map((log) => {
                                    const profile = log.profile as any
                                    const displayName = profile
                                        ? profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
                                        : 'System/Unknown'

                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">
                                                    {format(new Date(log.created_at), 'MMM d, yyyy')}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {format(new Date(log.created_at), 'h:mm:ss a')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                                                {displayName}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-medium text-gray-900 uppercase">
                                                    {log.resource_type}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                    {log.resource_id.slice(0, 8)}...
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="max-w-xs overflow-hidden text-ellipsis text-[10px] text-gray-600 font-mono">
                                                    {JSON.stringify(log.new_values || log.old_values || {}, null, 2)}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No audit logs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function getActionColor(action: string) {
    if (action.includes('created') || action.includes('joined') || action.includes('approved')) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-100'
    }
    if (action.includes('cancelled') || action.includes('rejected') || action.includes('left')) {
        return 'bg-red-50 text-red-700 border-red-100'
    }
    if (action.includes('rescheduled') || action.includes('pending')) {
        return 'bg-amber-50 text-amber-700 border-amber-100'
    }
    return 'bg-blue-50 text-blue-700 border-blue-100'
}
