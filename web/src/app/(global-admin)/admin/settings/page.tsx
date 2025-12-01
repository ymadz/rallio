import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings | Admin',
  description: 'Platform settings and configuration',
}

export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Platform Settings</h1>
      <p className="text-gray-600">Coming soon...</p>
    </div>
  )
}
