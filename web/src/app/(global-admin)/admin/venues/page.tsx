import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Venue Management | Admin',
  description: 'Manage and approve venues',
}

export default function VenuesPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Venue Management</h1>
      <p className="text-gray-600">Coming soon...</p>
    </div>
  )
}
