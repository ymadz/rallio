'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Building2,
  AlertCircle,
  CheckCircle,
  X,
  Loader2
} from 'lucide-react'
import { getVenueAvailability, getBlockedDates, updateOperatingHours, addBlockedDate, removeBlockedDate } from '@/app/actions/court-admin-availability-actions'
import { getVenueCourts } from '@/app/actions/court-admin-court-actions'

interface TimeSlot {
  id: string
  day: string
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface BlockedDate {
  id: string
  courtName: string
  date: string
  reason: string
  type: 'maintenance' | 'event' | 'holiday' | 'other'
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface AvailabilityManagementProps {
  venueId: string
}

export function AvailabilityManagement({ venueId }: AvailabilityManagementProps) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'blocked'>('schedule')
  const [timeSlots, setTimeSlots] = useState<any[]>([])
  const [blockedDates, setBlockedDates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showHoursModal, setShowHoursModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [courts, setCourts] = useState<any[]>([])
  const [operatingHours, setOperatingHours] = useState<Record<string, { open: string; close: string; isOpen: boolean }>>({
    monday: { open: '09:00', close: '22:00', isOpen: true },
    tuesday: { open: '09:00', close: '22:00', isOpen: true },
    wednesday: { open: '09:00', close: '22:00', isOpen: true },
    thursday: { open: '09:00', close: '22:00', isOpen: true },
    friday: { open: '09:00', close: '22:00', isOpen: true },
    saturday: { open: '09:00', close: '22:00', isOpen: true },
    sunday: { open: '09:00', close: '22:00', isOpen: true },
  })
  const [blockForm, setBlockForm] = useState({
    courtId: '',
    startDate: '',
    endDate: '',
    reason: '',
    blockType: 'maintenance' as 'maintenance' | 'holiday' | 'private_event' | 'other'
  })

  useEffect(() => {
    loadData()
  }, [venueId])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [availResult, blockedResult, courtsResult] = await Promise.all([
        getVenueAvailability(venueId),
        getBlockedDates(venueId),
        getVenueCourts(venueId)
      ])

      if (availResult.success) {
        // If venue has opening hours set, use those
        if (availResult.openingHours && typeof availResult.openingHours === 'object' && !Array.isArray(availResult.openingHours)) {
          const hours: any = {}
          const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
          daysOfWeek.forEach(day => {
            const venueDay = availResult.openingHours[day]
            if (venueDay) {
              hours[day] = {
                open: venueDay.open || '09:00',
                close: venueDay.close || '22:00',
                isOpen: true
              }
            } else {
              hours[day] = { open: '09:00', close: '22:00', isOpen: false }
            }
          })
          setOperatingHours(hours)
        }
      }
      if (blockedResult.success) {
        setBlockedDates(blockedResult.blockedDates || [])
      }
      if (courtsResult.success) {
        setCourts(courtsResult.courts || [])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load availability')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveHours = async () => {
    setIsSubmitting(true)
    try {
      const schedule: any = {}
      Object.keys(operatingHours).forEach(day => {
        const hours = operatingHours[day]
        schedule[day] = hours.isOpen ? { open: hours.open, close: hours.close } : null
      })

      const result = await updateOperatingHours(venueId, schedule)
      if (!result.success) {
        throw new Error(result.error)
      }
      await loadData()
      setShowHoursModal(false)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const result = await addBlockedDate(venueId, {
        courtId: blockForm.courtId || undefined,
        startDate: blockForm.startDate,
        endDate: blockForm.endDate || blockForm.startDate,
        reason: blockForm.reason,
        blockType: blockForm.blockType
      })
      if (!result.success) {
        throw new Error(result.error)
      }
      await loadData()
      setShowAddModal(false)
      setBlockForm({
        courtId: '',
        startDate: '',
        endDate: '',
        reason: '',
        blockType: 'maintenance'
      })
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Remove this blocked date?')) return
    try {
      const result = await removeBlockedDate(venueId, blockId)
      if (!result.success) {
        throw new Error(result.error)
      }
      await loadData()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'maintenance': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'event': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'holiday': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Availability Management</h1>
        <p className="text-gray-600">Manage court schedules and blocked dates</p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Error Loading Availability</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadData}
              className="mt-3 text-sm text-red-700 hover:text-red-900 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      {!isLoading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl p-2 mb-6 inline-flex gap-2">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'schedule'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Operating Hours</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('blocked')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'blocked'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Blocked Dates ({blockedDates.length})</span>
            </div>
          </button>
        </div>
      )}

      {/* Operating Hours Tab */}
      {activeTab === 'schedule' && !isLoading && !error && (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Operating Hours</h3>
                <p className="text-sm text-blue-700">
                  Set your default operating hours for each day of the week. These will apply to all courts unless specified otherwise.
                </p>
              </div>
            </div>
          </div>

          {/* Time Slots Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Weekly Schedule</h2>
              <button
                onClick={() => setShowHoursModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Set Operating Hours</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Day
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opening Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Closing Time
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
                  {Object.keys(operatingHours).map((day) => {
                    const hours = operatingHours[day]
                    return (
                      <tr key={day} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 capitalize">{day}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{hours.isOpen ? hours.open : '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{hours.isOpen ? hours.close : '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {hours.isOpen ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-green-100 text-green-700 border-green-200 text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              <span>Open</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-red-100 text-red-700 border-red-200 text-xs font-medium">
                              <X className="w-3 h-3" />
                              <span>Closed</span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setShowHoursModal(true)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Dates Tab */}
      {activeTab === 'blocked' && !isLoading && !error && (
        <div className="space-y-6">
          {/* Add Blocked Date Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Blocked Dates</h2>
              <p className="text-sm text-gray-500 mt-1">Manage dates when courts are unavailable</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Blocked Date</span>
            </button>
          </div>

          {/* Empty State */}
          {blockedDates.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
              <Calendar className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-blue-900 mb-2">No Blocked Dates</h3>
              <p className="text-sm text-blue-700">
                You haven&apos;t blocked any dates yet. Add blocked dates for maintenance, holidays, or special events.
              </p>
            </div>
          ) : (
            /* Blocked Dates List */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {blockedDates.map((blocked) => (
                <div
                  key={blocked.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium capitalize ${getTypeColor(blocked.block_type || blocked.type)}`}>
                      {blocked.block_type || blocked.type}
                    </span>
                    <button
                      onClick={() => handleDeleteBlock(blocked.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{blocked.court_name || blocked.courtName || 'All Courts'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">
                        {new Date(blocked.start_date || blocked.date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-sm text-gray-600">{blocked.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Custom Hours Modal */}
      {showHoursModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Set Operating Hours</h3>
              <button
                onClick={() => setShowHoursModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="flex gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
                <span className="text-sm font-medium text-gray-700 flex items-center">Quick Actions:</span>
                <button
                  onClick={() => {
                    const monday = operatingHours['monday'];
                    const newHours = { ...operatingHours };
                    Object.keys(newHours).forEach(day => {
                      newHours[day] = { ...monday };
                    });
                    setOperatingHours(newHours);
                  }}
                  className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Copy Mon to All
                </button>
                <button
                  onClick={() => {
                    const monday = operatingHours['monday'];
                    const newHours = { ...operatingHours };
                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
                      newHours[day] = { ...monday };
                    });
                    setOperatingHours(newHours);
                  }}
                  className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Weekdays
                </button>
                <button
                  onClick={() => {
                    const saturday = operatingHours['saturday'];
                    const newHours = { ...operatingHours };
                    ['saturday', 'sunday'].forEach(day => {
                      newHours[day] = { ...saturday };
                    });
                    setOperatingHours(newHours);
                  }}
                  className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Weekends
                </button>
              </div>

              {Object.keys(operatingHours).map(day => (
                <div key={day} className="flex items-center gap-4 pb-3 border-b">
                  <input
                    type="checkbox"
                    checked={operatingHours[day].isOpen}
                    onChange={(e) => setOperatingHours({
                      ...operatingHours,
                      [day]: { ...operatingHours[day], isOpen: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="w-24 font-medium capitalize">{day}</span>
                  {operatingHours[day].isOpen ? (
                    <>
                      <input
                        type="time"
                        value={operatingHours[day].open}
                        onChange={(e) => setOperatingHours({
                          ...operatingHours,
                          [day]: { ...operatingHours[day], open: e.target.value }
                        })}
                        className="px-3 py-2 border rounded-lg"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={operatingHours[day].close}
                        onChange={(e) => setOperatingHours({
                          ...operatingHours,
                          [day]: { ...operatingHours[day], close: e.target.value }
                        })}
                        className="px-3 py-2 border rounded-lg"
                      />
                    </>
                  ) : (
                    <span className="text-gray-500">Closed</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4 mt-4 border-t">
              <button
                onClick={() => setShowHoursModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHours}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : 'Save Hours'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Blocked Date Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Blocked Date</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddBlock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Court (Optional)</label>
                <select
                  value={blockForm.courtId}
                  onChange={(e) => setBlockForm({ ...blockForm, courtId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Courts</option>
                  {courts.map(court => (
                    <option key={court.id} value={court.id}>{court.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={blockForm.startDate}
                  onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={blockForm.endDate}
                  onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  required
                  value={blockForm.blockType}
                  onChange={(e) => setBlockForm({ ...blockForm, blockType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="holiday">Holiday</option>
                  <option value="private_event">Private Event</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea
                  required
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Explain why this date is blocked..."
                />
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </span>
                  ) : 'Add Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
