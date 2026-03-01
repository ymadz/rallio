'use client'

import { useState, useEffect } from 'react'
import {
  DollarSign,
  Clock,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  Calendar,
  Users,
  Sun,
  Moon,
  Zap,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react'
import { getVenueCourts, updateCourtPricing } from '@/app/actions/court-admin-court-actions'

interface PricingRule {
  id: string
  courtName: string
  type: 'standard' | 'peak' | 'offpeak' | 'weekend' | 'special'
  rate: number
  timeRange?: string
  days?: string
  description: string
}

interface Court {
  id: string
  name: string
  baseRate: number
  peakRate: number
  weekendRate: number
}

interface PricingManagementProps {
  venueId: string
}

export function PricingManagement({ venueId }: PricingManagementProps) {
  const [activeTab, setActiveTab] = useState<'courts' | 'rules'>('courts')
  const [courts, setCourts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCourt, setEditingCourt] = useState<any>(null)
  const [newRate, setNewRate] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadCourts()
  }, [venueId])

  const loadCourts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getVenueCourts(venueId)
      if (!result.success) {
        throw new Error(result.error)
      }
      setCourts(result.courts || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load courts')
    } finally {
      setIsLoading(false)
    }
  }

  const avgBaseRate = courts.length > 0
    ? Math.round(courts.reduce((sum, c) => sum + (c.hourly_rate || 0), 0) / courts.length)
    : 0

  const handleEditPrice = (court: any) => {
    setEditingCourt(court)
    setNewRate(court.hourly_rate || 0)
    setShowEditModal(true)
  }

  const handleSavePrice = async () => {
    if (!editingCourt) return
    setIsSubmitting(true)
    try {
      const result = await updateCourtPricing(editingCourt.id, newRate)
      if (!result.success) {
        throw new Error(result.error)
      }
      await loadCourts()
      setShowEditModal(false)
      setEditingCourt(null)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRuleTypeInfo = (type: string) => {
    switch (type) {
      case 'peak':
        return { icon: TrendingUp, color: 'bg-red-100 text-red-700 border-red-200', label: 'Peak Hours' }
      case 'offpeak':
        return { icon: Sun, color: 'bg-green-100 text-green-700 border-green-200', label: 'Off-Peak' }
      case 'weekend':
        return { icon: Calendar, color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Weekend' }
      case 'special':
        return { icon: Zap, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Special' }
      default:
        return { icon: DollarSign, color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Standard' }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pricing Management</h1>
        <p className="text-gray-600">Configure court rates and dynamic pricing rules</p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Error Loading Pricing</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadCourts}
              className="mt-3 text-sm text-red-700 hover:text-red-900 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && courts.length === 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
          <DollarSign className="w-12 h-12 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-primary/80 mb-2">No Courts Yet</h3>
          <p className="text-sm text-primary/70 mb-4">
            Add courts to your venue to start configuring pricing.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {!isLoading && !error && courts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg. Base Rate</p>
                <p className="text-xl font-bold text-gray-900">₱{avgBaseRate}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Courts</p>
                <p className="text-xl font-bold text-gray-900">{courts.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Min Rate</p>
                <p className="text-xl font-bold text-gray-900">
                  ₱{courts.length > 0 ? Math.min(...courts.map(c => c.hourly_rate || 0)) : 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Max Rate</p>
                <p className="text-xl font-bold text-gray-900">
                  ₱{courts.length > 0 ? Math.max(...courts.map(c => c.hourly_rate || 0)) : 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {!isLoading && !error && courts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-2 mb-6 inline-flex gap-2">
          <button
            onClick={() => setActiveTab('courts')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'courts'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>Court Rates</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'rules'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Pricing Rules</span>
            </div>
          </button>
        </div>
      )}

      {/* Court Rates Tab */}
      {activeTab === 'courts' && !isLoading && !error && courts.length > 0 && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Court Pricing</h2>
              <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Edit className="w-4 h-4" />
                <span>Bulk Edit</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Court
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hourly Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {courts.map((court) => (
                    <tr key={court.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{court.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 capitalize">{court.court_type || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          ₱{court.hourly_rate || 0}/hr
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${court.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                          }`}>
                          {court.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleEditPrice(court)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4 text-gray-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Tips */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <h3 className="font-semibold text-primary/80 mb-2">💡 Pricing Tips</h3>
            <ul className="text-sm text-primary/70 space-y-1">
              <li>• Set competitive rates based on your location and facilities</li>
              <li>• Use peak pricing during high-demand hours (evenings, weekends)</li>
              <li>• Offer discounts during off-peak hours to maximize court utilization</li>
              <li>• Review and adjust pricing monthly based on booking patterns</li>
            </ul>
          </div>
        </div>
      )}

      {/* Pricing Rules Tab */}
      {activeTab === 'rules' && !isLoading && !error && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Dynamic Pricing Rules</h2>
              <p className="text-sm text-gray-500 mt-1">Automatic pricing based on time and day (Coming Soon)</p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors opacity-50 cursor-not-allowed" disabled>
              <Plus className="w-4 h-4" />
              <span>Add Rule</span>
            </button>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
            <Clock className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-primary/80 mb-2">Dynamic Pricing Coming Soon</h3>
            <p className="text-sm text-primary/70">
              Set up advanced pricing rules based on time, day, and demand. This feature will be available in a future update.
            </p>
          </div>

          {/* Priority Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">Planned Features</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Peak hour pricing (evenings, weekends)</li>
                  <li>• Off-peak discounts for better utilization</li>
                  <li>• Special event pricing</li>
                  <li>• Seasonal rate adjustments</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Price Modal */}
      {showEditModal && editingCourt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Pricing</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Court</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900 font-medium">
                  {editingCourt.name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Rate</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-600">
                  ₱{editingCourt.hourly_rate}/hour
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Hourly Rate (₱) *</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={newRate}
                  onChange={(e) => setNewRate(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm text-primary/70">
                  This will update the base hourly rate for {editingCourt.name}. The change will be reflected immediately for new bookings.
                </p>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrice}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
