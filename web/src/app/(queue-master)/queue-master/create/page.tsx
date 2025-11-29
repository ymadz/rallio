import { Metadata } from 'next'
import { CreateSessionForm } from '@/components/queue-master/create-session-form'

export const metadata: Metadata = {
  title: 'Create Queue Session | Rallio',
  description: 'Create a new queue session for walk-in players',
}

export default function CreateSessionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Queue Session</h1>
          <p className="text-gray-600 mt-1">Set up a new queue session for walk-in players</p>
        </div>

        <CreateSessionForm />
      </div>
    </div>
  )
}
