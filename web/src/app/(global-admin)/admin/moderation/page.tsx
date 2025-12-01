import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Content Moderation | Admin',
  description: 'Moderate platform content',
}

export default function ModerationPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Content Moderation</h1>
      <p className="text-gray-600">Coming soon...</p>
    </div>
  )
}
