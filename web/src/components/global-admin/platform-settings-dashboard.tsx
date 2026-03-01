'use client'

import { useState, useEffect } from 'react'
import {
  getAllPlatformSettings,
  updatePlatformFee,
  updateTermsAndConditions,
  updateRefundPolicy,
  updateGeneralSettings,
  updateNotificationSettings,
  updatePaymentSettings
} from '@/app/actions/global-admin-settings-actions'
import {
  Settings,
  DollarSign,
  FileText,
  Bell,
  CreditCard,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Globe,
  Shield,
  Mail,
  Phone,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'

export default function PlatformSettingsDashboard() {
  const [activeTab, setActiveTab] = useState<'general' | 'fees' | 'legal' | 'notifications' | 'payment'>('general')
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form states
  const [platformFee, setPlatformFee] = useState({ percentage: 5, enabled: true, description: '' })
  const [generalSettings, setGeneralSettings] = useState({
    platform_name: '',
    tagline: '',
    maintenance_mode: false,
    contact_email: '',
    contact_phone: ''
  })
  const [termsContent, setTermsContent] = useState('')
  const [refundContent, setRefundContent] = useState('')
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    booking_confirmations: true,
    payment_receipts: true,
    admin_alerts: true
  })
  const [paymentSettings, setPaymentSettings] = useState({
    currency: 'PHP',
    currency_symbol: '₱',
    payment_methods: [] as string[],
    min_booking_amount: 100,
    max_booking_amount: 50000
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await getAllPlatformSettings()
      if (result.success && result.settings) {
        setSettings(result.settings)
        
        // Populate form states
        if (result.settings.platform_fee) {
          setPlatformFee({
            percentage: result.settings.platform_fee.percentage || 5,
            enabled: result.settings.platform_fee.enabled ?? true,
            description: result.settings.platform_fee.description || ''
          })
        }
        
        if (result.settings.general_settings) {
          setGeneralSettings(result.settings.general_settings)
        }
        
        if (result.settings.terms_and_conditions) {
          setTermsContent(result.settings.terms_and_conditions.content || '')
        }
        
        if (result.settings.refund_policy) {
          setRefundContent(result.settings.refund_policy.content || '')
        }
        
        if (result.settings.notification_settings) {
          setNotificationSettings(result.settings.notification_settings)
        }
        
        if (result.settings.payment_settings) {
          setPaymentSettings(result.settings.payment_settings)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSavePlatformFee = async () => {
    setSaving(true)
    try {
      const result = await updatePlatformFee(
        platformFee.percentage,
        platformFee.enabled,
        platformFee.description
      )
      if (result.success) {
        showMessage('success', 'Platform fee updated successfully')
      } else {
        showMessage('error', result.error || 'Failed to update platform fee')
      }
    } catch (error: any) {
      showMessage('error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveGeneralSettings = async () => {
    setSaving(true)
    try {
      const result = await updateGeneralSettings(generalSettings)
      if (result.success) {
        showMessage('success', 'General settings updated successfully')
      } else {
        showMessage('error', result.error || 'Failed to update settings')
      }
    } catch (error: any) {
      showMessage('error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTerms = async () => {
    setSaving(true)
    try {
      const result = await updateTermsAndConditions(termsContent)
      if (result.success) {
        showMessage('success', 'Terms and conditions updated successfully')
      } else {
        showMessage('error', result.error || 'Failed to update terms')
      }
    } catch (error: any) {
      showMessage('error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRefundPolicy = async () => {
    setSaving(true)
    try {
      const result = await updateRefundPolicy(refundContent)
      if (result.success) {
        showMessage('success', 'Refund policy updated successfully')
      } else {
        showMessage('error', result.error || 'Failed to update refund policy')
      }
    } catch (error: any) {
      showMessage('error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSaving(true)
    try {
      const result = await updateNotificationSettings(notificationSettings)
      if (result.success) {
        showMessage('success', 'Notification settings updated successfully')
      } else {
        showMessage('error', result.error || 'Failed to update notifications')
      }
    } catch (error: any) {
      showMessage('error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePaymentSettings = async () => {
    setSaving(true)
    try {
      const result = await updatePaymentSettings(paymentSettings)
      if (result.success) {
        showMessage('success', 'Payment settings updated successfully')
      } else {
        showMessage('error', result.error || 'Failed to update payment settings')
      }
    } catch (error: any) {
      showMessage('error', error.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePaymentMethod = (method: string) => {
    setPaymentSettings(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(method)
        ? prev.payment_methods.filter(m => m !== method)
        : [...prev.payment_methods, method]
    }))
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-600 mt-2">Configure platform-wide settings, fees, and policies</p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'general'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="font-medium">General</span>
          </button>

          <button
            onClick={() => setActiveTab('fees')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'fees'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span className="font-medium">Platform Fees</span>
          </button>

          <button
            onClick={() => setActiveTab('legal')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'legal'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="font-medium">Legal</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'notifications'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="font-medium">Notifications</span>
          </button>

          <button
            onClick={() => setActiveTab('payment')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'payment'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span className="font-medium">Payment</span>
          </button>
        </div>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" />
              Platform Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Platform Name
                </label>
                <input
                  type="text"
                  value={generalSettings.platform_name}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, platform_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Rallio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={generalSettings.tagline}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Find Your Court, Join The Game"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Maintenance Mode</h3>
                  <p className="text-sm text-gray-600">Temporarily disable platform access</p>
                </div>
                <button
                  onClick={() => setGeneralSettings(prev => ({ ...prev, maintenance_mode: !prev.maintenance_mode }))}
                  className={`p-2 rounded-lg transition-colors ${
                    generalSettings.maintenance_mode ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {generalSettings.maintenance_mode ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-600" />
              Contact Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={generalSettings.contact_email}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, contact_email: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="support@rallio.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={generalSettings.contact_phone}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, contact_phone: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="+63 XXX XXX XXXX"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveGeneralSettings}
            disabled={saving}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save General Settings
          </button>
        </div>
      )}

      {/* Platform Fees Tab */}
      {activeTab === 'fees' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              Platform Service Fee
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Enable Platform Fee</h3>
                  <p className="text-sm text-gray-600">Apply service fee to all bookings</p>
                </div>
                <button
                  onClick={() => setPlatformFee(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`p-2 rounded-lg transition-colors ${
                    platformFee.enabled ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {platformFee.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fee Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={platformFee.percentage}
                    onChange={(e) => setPlatformFee(prev => ({ ...prev, percentage: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg font-semibold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">%</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Example: ₱1,000 booking + {platformFee.percentage}% fee = ₱{(1000 * (1 + platformFee.percentage / 100)).toFixed(2)} total
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={platformFee.description}
                  onChange={(e) => setPlatformFee(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Platform service fee description..."
                />
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Fee Application</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Applied to all court bookings and reservations</li>
                  <li>• Displayed in booking fee breakdown</li>
                  <li>• Included in total payment amount</li>
                  <li>• Refund policy applies to platform fee based on cancellation time</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleSavePlatformFee}
            disabled={saving}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Platform Fee
          </button>
        </div>
      )}

      {/* Legal Tab */}
      {activeTab === 'legal' && (
        <div className="space-y-6">
          {/* Terms and Conditions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Terms and Conditions
            </h2>

            <div className="space-y-4">
              <textarea
                value={termsContent}
                onChange={(e) => setTermsContent(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                rows={15}
                placeholder="# Terms and Conditions&#10;&#10;Your terms and conditions content here..."
              />
              <p className="text-sm text-gray-600">
                Supports Markdown formatting. Last updated: {settings?.terms_and_conditions?.last_updated ? new Date(settings.terms_and_conditions.last_updated).toLocaleDateString() : 'Never'}
              </p>
            </div>

            <button
              onClick={handleSaveTerms}
              disabled={saving}
              className="w-full mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Terms and Conditions
            </button>
          </div>

          {/* Refund Policy */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              Refund Policy
            </h2>

            <div className="space-y-4">
              <textarea
                value={refundContent}
                onChange={(e) => setRefundContent(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                rows={15}
                placeholder="# Refund Policy&#10;&#10;Your refund policy content here..."
              />
              <p className="text-sm text-gray-600">
                Supports Markdown formatting. Last updated: {settings?.refund_policy?.last_updated ? new Date(settings.refund_policy.last_updated).toLocaleDateString() : 'Never'}
              </p>
            </div>

            <button
              onClick={handleSaveRefundPolicy}
              disabled={saving}
              className="w-full mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Refund Policy
            </button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600" />
              Notification Channels
            </h2>

            <div className="space-y-3">
              {[
                { key: 'email_notifications', label: 'Email Notifications', desc: 'Send notifications via email' },
                { key: 'sms_notifications', label: 'SMS Notifications', desc: 'Send notifications via SMS' },
                { key: 'push_notifications', label: 'Push Notifications', desc: 'Send push notifications to mobile apps' },
                { key: 'booking_confirmations', label: 'Booking Confirmations', desc: 'Send confirmation for new bookings' },
                { key: 'payment_receipts', label: 'Payment Receipts', desc: 'Send receipts after successful payments' },
                { key: 'admin_alerts', label: 'Admin Alerts', desc: 'Send alerts to admins for important events' }
              ].map((setting) => (
                <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{setting.label}</h3>
                    <p className="text-sm text-gray-600">{setting.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotificationSettings(prev => ({ ...prev, [setting.key]: !prev[setting.key as keyof typeof prev] }))}
                    className={`p-2 rounded-lg transition-colors ${
                      notificationSettings[setting.key as keyof typeof notificationSettings]
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {notificationSettings[setting.key as keyof typeof notificationSettings] ? (
                      <ToggleRight className="w-6 h-6" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveNotifications}
            disabled={saving}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Notification Settings
          </button>
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-600" />
              Payment Configuration
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.currency}
                    onChange={(e) => setPaymentSettings(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.currency_symbol}
                    onChange={(e) => setPaymentSettings(prev => ({ ...prev, currency_symbol: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Methods
                </label>
                <div className="space-y-2">
                  {['gcash', 'paymaya', 'card', 'bank_transfer'].map((method) => (
                    <label key={method} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={paymentSettings.payment_methods.includes(method)}
                        onChange={() => togglePaymentMethod(method)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-gray-900 capitalize">{method.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Booking Amount
                  </label>
                  <input
                    type="number"
                    value={paymentSettings.min_booking_amount}
                    onChange={(e) => setPaymentSettings(prev => ({ ...prev, min_booking_amount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Booking Amount
                  </label>
                  <input
                    type="number"
                    value={paymentSettings.max_booking_amount}
                    onChange={(e) => setPaymentSettings(prev => ({ ...prev, max_booking_amount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSavePaymentSettings}
            disabled={saving}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Payment Settings
          </button>
        </div>
      )}
    </div>
  )
}
