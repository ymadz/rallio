'use client'

import { useState, useEffect } from 'react'
import { adminGetRefundsAction, adminProcessRefundAction } from '@/app/actions/refund-actions'
import { createClient } from '@/lib/supabase/client'
import {
  Undo2,
  Filter,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  DollarSign,
  TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Refund {
  id: string
  amount: number
  currency: string
  status: string
  reason: string
  reason_code: string
  notes?: string
  created_at: string
  processed_at?: string
  profiles?: {
    first_name?: string
    last_name?: string
    email?: string
  }
  reservations?: {
    id: string
    start_time: string
    end_time: string
    courts?: {
      name: string
      venues?: {
        name: string
      }
    }
  }
}

export function GlobalAdminRefundManagement() {
  const supabase = createClient()
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [filteredRefunds, setFilteredRefunds] = useState<Refund[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    loadRefunds()
    setupRealtimeSubscription()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [refunds, statusFilter, searchQuery])

  const loadRefunds = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await adminGetRefundsAction({ limit: 100 })
      if (!result.success) {
        throw new Error(result.error)
      }
      setRefunds(result.refunds || [])
      setTotal(result.total || 0)
    } catch (err: any) {
      setError(err.message || 'Failed to load refunds')
    } finally {
      setIsLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('global-admin-refunds')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'refunds',
        },
        () => {
          loadRefunds()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const applyFilters = () => {
    let filtered = [...refunds]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r => {
        const customerName = `${r.profiles?.first_name || ''} ${r.profiles?.last_name || ''}`.trim()
        const courtName = r.reservations?.courts?.name || ''
        const venueName = r.reservations?.courts?.venues?.name || ''

        return (
          customerName.toLowerCase().includes(query) ||
          courtName.toLowerCase().includes(query) ||
          venueName.toLowerCase().includes(query) ||
          r.profiles?.email?.toLowerCase().includes(query)
        )
      })
    }

    setFilteredRefunds(filtered)
  }

  const handleProcessRefund = async (refundId: string, action: 'approve' | 'reject') => {
    setProcessingId(refundId)
    try {
      const result = await adminProcessRefundAction(refundId, action, adminNotes)
      if (result.success) {
        loadRefunds()
        setShowDetailModal(false)
        setAdminNotes('')
      } else {
        alert(result.error || `Failed to ${action} refund`)
      }
    } catch (err: any) {
      alert(err.message || `Failed to ${action} refund`)
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return 'bg-green-100 text-green-700 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'failed': return 'bg-red-100 text-red-700 border-red-200'
      case 'cancelled': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded': return <CheckCircle className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'failed': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const statusCounts = {
    all: refunds.length,
    pending: refunds.filter(r => r.status === 'pending').length,
    processing: refunds.filter(r => r.status === 'processing').length,
    succeeded: refunds.filter(r => r.status === 'succeeded').length,
    failed: refunds.filter(r => ['failed', 'cancelled'].includes(r.status)).length,
  }

  const totalRefundedAmount = refunds
    .filter(r => r.status === 'succeeded')
    .reduce((sum, r) => sum + r.amount, 0)

  const pendingRefundAmount = refunds
    .filter(r => ['pending', 'processing'].includes(r.status))
    .reduce((sum, r) => sum + r.amount, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Refunds</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={loadRefunds}>Try Again</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Undo2 className="w-7 h-7" />
            Platform Refunds
          </h1>
          <p className="text-gray-600 mt-1">Manage all refund requests across the platform</p>
        </div>
        <Button onClick={loadRefunds} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Refunds', count: statusCounts.all, color: 'bg-gray-100 text-gray-700', icon: Undo2 },
          { label: 'Pending', count: statusCounts.pending, color: 'bg-yellow-100 text-yellow-700', icon: Clock },
          { label: 'Processing', count: statusCounts.processing, color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
          { label: 'Completed', count: statusCounts.succeeded, color: 'bg-green-100 text-green-700', icon: CheckCircle },
        ].map((stat) => (
          <Card key={stat.label} className={`p-4 ${stat.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className="w-4 h-4" />
              <p className="text-sm font-medium">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold">{stat.count}</p>
          </Card>
        ))}
        
        <Card className="p-4 bg-green-50 text-green-700">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4" />
            <p className="text-sm font-medium">Total Refunded</p>
          </div>
          <p className="text-2xl font-bold">₱{(totalRefundedAmount / 100).toLocaleString()}</p>
        </Card>

        <Card className="p-4 bg-orange-50 text-orange-700">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4" />
            <p className="text-sm font-medium">Pending Amount</p>
          </div>
          <p className="text-2xl font-bold">₱{(pendingRefundAmount / 100).toLocaleString()}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer, court, or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="succeeded">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Refunds List */}
      {filteredRefunds.length === 0 ? (
        <Card className="p-12 text-center">
          <Undo2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Refunds Found</h3>
          <p className="text-gray-600">
            {statusFilter !== 'all' 
              ? `No refunds with status "${statusFilter}"`
              : 'No refund requests on the platform yet'}
          </p>
        </Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue / Court</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRefunds.map((refund) => (
                <tr key={refund.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {refund.profiles?.first_name} {refund.profiles?.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{refund.profiles?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{refund.reservations?.courts?.venues?.name}</p>
                      <p className="text-sm text-gray-500">{refund.reservations?.courts?.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-gray-900">₱{(refund.amount / 100).toFixed(2)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(refund.status)}`}>
                      {getStatusIcon(refund.status)}
                      {refund.status.charAt(0).toUpperCase() + refund.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-gray-600">{formatDate(refund.created_at)}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRefund(refund)
                        setShowDetailModal(true)
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRefund && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Refund Details</h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedRefund.status)}`}>
                  {getStatusIcon(selectedRefund.status)}
                  {selectedRefund.status.charAt(0).toUpperCase() + selectedRefund.status.slice(1)}
                </span>
              </div>

              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Refund Amount</span>
                <span className="text-lg font-bold text-gray-900">₱{(selectedRefund.amount / 100).toFixed(2)}</span>
              </div>

              {/* Customer */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Customer</h4>
                <p className="text-gray-700">{selectedRefund.profiles?.first_name} {selectedRefund.profiles?.last_name}</p>
                <p className="text-sm text-gray-500">{selectedRefund.profiles?.email}</p>
              </div>

              {/* Booking Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Booking Details</h4>
                <p className="text-gray-700">{selectedRefund.reservations?.courts?.venues?.name}</p>
                <p className="text-sm text-gray-500">{selectedRefund.reservations?.courts?.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedRefund.reservations?.start_time && formatDate(selectedRefund.reservations.start_time)}
                </p>
              </div>

              {/* Reason */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Reason</h4>
                <p className="text-gray-700">{selectedRefund.reason || 'No reason provided'}</p>
              </div>

              {/* Admin Notes (for pending refunds) */}
              {selectedRefund.status === 'pending' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Notes (optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this decision..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedRefund(null)
                  setAdminNotes('')
                }}
              >
                Close
              </Button>
              
              {selectedRefund.status === 'pending' && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleProcessRefund(selectedRefund.id, 'reject')}
                    disabled={processingId === selectedRefund.id}
                  >
                    {processingId === selectedRefund.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Reject
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleProcessRefund(selectedRefund.id, 'approve')}
                    disabled={processingId === selectedRefund.id}
                  >
                    {processingId === selectedRefund.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
