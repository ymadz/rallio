'use client'

import { useEffect, useState } from 'react'
import {
  getAuditLogs,
  getAuditStats,
  getActionTypes,
  getTargetTypes,
  getAdminList,
  exportAuditLogs,
  type AuditLog,
  type GetAuditLogsParams,
} from '@/app/actions/global-admin-audit-actions'
import {
  Activity,
  Filter,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  FileText,
  TrendingUp,
  Clock,
  Shield,
} from 'lucide-react'

export default function AuditLogsViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  // Filter options
  const [actionTypes, setActionTypes] = useState<string[]>([])
  const [targetTypes, setTargetTypes] = useState<string[]>([])
  const [adminList, setAdminList] = useState<any[]>([])

  // Filter state
  const [filters, setFilters] = useState<GetAuditLogsParams>({
    page: 1,
    limit: 50,
  })

  // UI state
  const [showFilters, setShowFilters] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadLogs()
  }, [filters])

  const loadInitialData = async () => {
    try {
      const [statsResult, actionsResult, targetsResult, adminsResult] = await Promise.all([
        getAuditStats(),
        getActionTypes(),
        getTargetTypes(),
        getAdminList(),
      ])

      if (statsResult.success) setStats((statsResult as any).stats)
      if (actionsResult.success) setActionTypes((actionsResult as any).actionTypes || [])
      if (targetsResult.success) setTargetTypes((targetsResult as any).targetTypes || [])
      if (adminsResult.success) setAdminList((adminsResult as any).admins || [])
    } catch (err: any) {
      console.error('Error loading initial data:', err)
    }
  }

  const loadLogs = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await getAuditLogs(filters)

      if (result.success) {
        setLogs((result as any).logs || [])
        setPagination((result as any).pagination || {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
        })
      } else {
        setError(result.error || 'Failed to load audit logs')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const result = await exportAuditLogs(filters)

      if (result.success && (result as any).csv) {
        // Create download link
        const blob = new Blob([(result as any).csv], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = (result as any).filename || `audit-logs-${new Date().toISOString()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        setError(result.error || 'Failed to export logs')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setExportLoading(false)
    }
  }

  const updateFilter = (key: keyof GetAuditLogsParams, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }))
  }

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
    })
  }

  const goToPage = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'text-green-600 bg-green-50'
    if (action.includes('delete') || action.includes('remove')) return 'text-red-600 bg-red-50'
    if (action.includes('update') || action.includes('edit')) return 'text-blue-600 bg-blue-50'
    if (action.includes('ban') || action.includes('suspend')) return 'text-orange-600 bg-orange-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track all administrative actions and system changes
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exportLoading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {exportLoading ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Logs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalLogs.toLocaleString()}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Last 24 Hours</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.logsLast24h.toLocaleString()}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Last 7 Days</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.logsLast7d.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Admins</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.topAdmins?.length || 0}
                </p>
              </div>
              <Shield className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Top Actions & Admins */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Actions (7 days)</h3>
            <div className="space-y-2">
              {stats.topActions?.map((action: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{action.action}</span>
                  <span className="font-semibold text-gray-900">{action.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Most Active Admins (7 days)</h3>
            <div className="space-y-2">
              {stats.topAdmins?.map((admin: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{admin.full_name}</span>
                  <span className="font-semibold text-gray-900">{admin.count} actions</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-900"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search actions..."
                  value={filters.searchTerm || ''}
                  onChange={(e) => updateFilter('searchTerm', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                value={filters.actionType || ''}
                onChange={(e) => updateFilter('actionType', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Actions</option>
                {actionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Type
              </label>
              <select
                value={filters.targetType || ''}
                onChange={(e) => updateFilter('targetType', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Targets</option>
                {targetTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Admin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin
              </label>
              <select
                value={filters.adminId || ''}
                onChange={(e) => updateFilter('adminId', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Admins</option>
                {adminList.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => updateFilter('startDate', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => updateFilter('endDate', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Admin
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Target
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    Loading audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {log.admin?.full_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {log.admin?.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {log.target_type ? (
                        <div>
                          <div className="font-medium">{log.target_type}</div>
                          {log.target_id && (
                            <div className="text-xs text-gray-500 font-mono">
                              {log.target_id.slice(0, 8)}...
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLog(log)
                        }}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} logs
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Audit Log Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Timestamp</label>
                <p className="text-sm text-gray-900 mt-1">{formatDate(selectedLog.created_at)}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Admin</label>
                <p className="text-sm text-gray-900 mt-1">
                  {selectedLog.admin?.full_name} ({selectedLog.admin?.email})
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Action Type</label>
                <p className="text-sm text-gray-900 mt-1">{selectedLog.action_type}</p>
              </div>
              {selectedLog.target_type && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Target Type</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedLog.target_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Target ID</label>
                    <p className="text-sm text-gray-900 mt-1 font-mono">{selectedLog.target_id}</p>
                  </div>
                </>
              )}
              {selectedLog.old_value && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Old Value</label>
                  <pre className="text-xs text-gray-900 mt-1 bg-gray-50 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedLog.old_value, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.new_value && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">New Value</label>
                  <pre className="text-xs text-gray-900 mt-1 bg-gray-50 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedLog.new_value, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.ip_address && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">IP Address</label>
                  <p className="text-sm text-gray-900 mt-1 font-mono">{selectedLog.ip_address}</p>
                </div>
              )}
              {selectedLog.user_agent && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">User Agent</label>
                  <p className="text-xs text-gray-700 mt-1 break-all">{selectedLog.user_agent}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
