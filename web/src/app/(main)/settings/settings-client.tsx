'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateNotificationPreferencesAction, changePasswordAction, deleteAccountAction } from '@/app/actions/settings-actions'
import { createClient } from '@/lib/supabase/client'

interface SettingsClientProps {
  profile: any
  player: any
  notificationPrefs: any
}

export function SettingsClient({ profile, player, notificationPrefs }: SettingsClientProps) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<'notifications' | 'privacy'>('notifications')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    email_enabled: notificationPrefs?.email_enabled ?? true,
    push_enabled: notificationPrefs?.push_enabled ?? true,
    sms_enabled: notificationPrefs?.sms_enabled ?? false,
    reservation_reminders: notificationPrefs?.reservation_reminders ?? true,
    queue_notifications: notificationPrefs?.queue_notifications ?? true,
    payment_notifications: notificationPrefs?.payment_notifications ?? true,
    rating_requests: notificationPrefs?.rating_requests ?? true,
    promotional_emails: notificationPrefs?.promotional_emails ?? false,
  })

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSaveNotifications = async () => {
    setIsSaving(true)
    setMessage(null)

    const result = await updateNotificationPreferencesAction(notifications)

    if (result.success) {
      setMessage({ type: 'success', text: 'Notification preferences saved successfully!' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save preferences' })
    }

    setIsSaving(false)
  }

  const handleDownloadData = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setMessage({ type: 'error', text: 'Not authenticated' })
        setIsSaving(false)
        return
      }

      // Fetch all user data
      const [profileRes, playerRes, bookingsRes, notifRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('players').select('*').eq('user_id', user.id).single(),
        supabase.from('reservations').select('*').eq('user_id', user.id),
        supabase.from('notification_preferences').select('*').eq('user_id', user.id).single(),
      ])

      const exportData = {
        profile: profileRes.data,
        player: playerRes.data,
        bookings: bookingsRes.data,
        notifications: notifRes.data,
        exportedAt: new Date().toISOString(),
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rallio-data-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setMessage({ type: 'success', text: 'Your data has been downloaded!' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to export data' })
    }

    setIsSaving(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    // Validate passwords
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setIsChangingPassword(true)

    const result = await changePasswordAction({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })

    if (result.success) {
      setShowPasswordModal(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setMessage({ type: 'success', text: 'Password changed successfully!' })
    } else {
      setPasswordError(result.error || 'Failed to change password')
    }

    setIsChangingPassword(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm')
      return
    }

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteAccountAction(deleteConfirmation)

    if (result.success) {
      // Redirect to home page after deletion
      router.push('/')
    } else {
      setDeleteError(result.error || 'Failed to delete account')
      setIsDeleting(false)
    }
  }

  const sections = [
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'privacy', label: 'Privacy & Security', icon: '🔒' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}


      {/* Main Content */}
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 bg-white p-1 rounded-xl border border-gray-200 w-fit">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${activeSection === section.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <span className="text-base">{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </div>

          {/* Content Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6">
              {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                  {message.type === 'success' ? (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="text-sm">{message.text}</span>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'notifications' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Notification Preferences</h2>
                    <p className="text-gray-500 text-sm">Choose how you want to be notified about updates</p>
                  </div>

                  {/* Channel Preferences */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-primary rounded-full"></span>
                      Notification Channels
                    </h3>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">Email Notifications</p>
                          <p className="text-xs text-gray-500">Receive notifications via email</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.email_enabled}
                          onChange={() => handleNotificationChange('email_enabled')}
                          className="w-5 h-5 text-primary rounded focus:ring-primary"
                        />
                      </label>

                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">Push Notifications</p>
                          <p className="text-xs text-gray-500">Receive push notifications on your device</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.push_enabled}
                          onChange={() => handleNotificationChange('push_enabled')}
                          className="w-5 h-5 text-primary rounded focus:ring-primary"
                        />
                      </label>

                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">SMS Notifications</p>
                          <p className="text-xs text-gray-500">Receive notifications via text message</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.sms_enabled}
                          onChange={() => handleNotificationChange('sms_enabled')}
                          className="w-5 h-5 text-primary rounded focus:ring-primary"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Feature-Specific Notifications */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-primary rounded-full"></span>
                      What to Notify Me About
                    </h3>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">Reservation Reminders</p>
                          <p className="text-xs text-gray-500">Get reminded about upcoming bookings</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.reservation_reminders}
                          onChange={() => handleNotificationChange('reservation_reminders')}
                          className="w-5 h-5 text-primary rounded focus:ring-primary"
                        />
                      </label>

                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">Queue Notifications</p>
                          <p className="text-xs text-gray-500">Get notified about queue turns and matches</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.queue_notifications}
                          onChange={() => handleNotificationChange('queue_notifications')}
                          className="w-5 h-5 text-primary rounded focus:ring-primary"
                        />
                      </label>

                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">Payment Notifications</p>
                          <p className="text-xs text-gray-500">Get notified about payment confirmations</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.payment_notifications}
                          onChange={() => handleNotificationChange('payment_notifications')}
                          className="w-5 h-5 text-primary rounded focus:ring-primary"
                        />
                      </label>

                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">Rating Requests</p>
                          <p className="text-xs text-gray-500">Get asked to rate courts and players</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.rating_requests}
                          onChange={() => handleNotificationChange('rating_requests')}
                          className="w-5 h-5 text-primary rounded focus:ring-primary"
                        />
                      </label>

                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">Promotional Emails</p>
                          <p className="text-xs text-gray-500">Receive special offers and updates</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.promotional_emails}
                          onChange={() => handleNotificationChange('promotional_emails')}
                          className="w-5 h-5 text-primary rounded focus:ring-primary"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <button
                      onClick={handleSaveNotifications}
                      disabled={isSaving}
                      className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow"
                    >
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Privacy Section */}
              {activeSection === 'privacy' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Privacy & Security</h2>
                    <p className="text-gray-500 text-sm">Manage your privacy settings and security options</p>
                  </div>

                  {/* Security */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-primary rounded-full"></span>
                      Security
                    </h3>
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-700">Change Password</p>
                          <p className="text-xs text-gray-500">Update your account password</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-700">Active Sessions</p>
                          <p className="text-xs text-gray-500">Manage where you're logged in</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Data & Privacy */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-primary rounded-full"></span>
                      Data & Privacy
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={handleDownloadData}
                        disabled={isSaving}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-700">Download Your Data</p>
                          <p className="text-xs text-gray-500">Export your profile and activity data</p>
                        </div>
                        {isSaving ? (
                          <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div>
                    <h3 className="text-sm font-semibold text-red-600 mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-red-600 rounded-full"></span>
                      Danger Zone
                    </h3>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full flex items-center justify-between px-4 py-3 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-600"
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium">Delete Account</p>
                        <p className="text-xs text-red-500">Permanently delete your account and all data</p>
                      </div>
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Info Note */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Some security features are managed through your authentication provider (Supabase Auth).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                  setPasswordError('')
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false)
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                    setPasswordError('')
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Changing...
                    </>
                  ) : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-600">Delete Account</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                  setDeleteError('')
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                <p className="text-sm text-red-700 font-medium mb-2">⚠️ This action cannot be undone!</p>
                <p className="text-sm text-red-600">
                  Deleting your account will permanently remove:
                </p>
                <ul className="text-sm text-red-600 list-disc list-inside mt-2 space-y-1">
                  <li>Your profile and personal information</li>
                  <li>All booking history and reservations</li>
                  <li>Queue participation records</li>
                  <li>Reviews and ratings you've made</li>
                </ul>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                To confirm deletion, type <span className="font-mono font-bold text-red-600">DELETE</span> below:
              </p>

              {deleteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-3">
                  {deleteError}
                </div>
              )}

              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                  setDeleteError('')
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
