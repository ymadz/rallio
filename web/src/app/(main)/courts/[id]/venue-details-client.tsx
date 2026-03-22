'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QueueSessionModal } from '@/components/venue/queue-session-modal'
import { VenueScheduleGrid } from '@/components/venue/venue-schedule-grid'
import { EmptyCourtsState } from '@/components/courts/empty-courts-state'
import { createClient } from '@/lib/supabase/client'


interface Court {
  id: string
  name: string
  description: string | null
  surface_type: string
  court_type: string
  capacity: number
  hourly_rate: number
  is_active: boolean
}

interface VenueDetailsClientProps {
  courts: Court[]
  venueId: string
  venueName: string
  discounts?: {
    rules: any[]
    holidays: any[]
  }
}

export function VenueDetailsClient({ courts, venueId, venueName, discounts }: VenueDetailsClientProps) {
  const router = useRouter()
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false)
  const [queueSessionData, setQueueSessionData] = useState<{
    courts: Court[];
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null)
  const [isQueueMaster, setIsQueueMaster] = useState(false)


  // Check if user has queue_master role
  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', user.id)

      const roleNames = roles?.map((r: any) => r.roles?.name) || []
      setIsQueueMaster(roleNames.includes('queue_master'))
    }

    checkRole()
  }, [])

  const handleOpenQueueModal = (
    selectedCourts: Court[],
    selectedDate: string,
    startTime: string,
    endTime: string
  ) => {
    setQueueSessionData({ courts: selectedCourts, date: selectedDate, startTime, endTime })
    setIsQueueModalOpen(true)
  }

  // Show empty state if no courts available
  if (courts.length === 0) {
    return <EmptyCourtsState venueName={venueName} />
  }

  return (
    <>
      <div className="mb-6">
        <VenueScheduleGrid 
          courts={courts} 
          venueId={venueId} 
          venueName={venueName} 
          isQueueMaster={isQueueMaster}
          onQueueClick={handleOpenQueueModal}
        />
      </div>

      {/* Queue Session Modal */}
      {queueSessionData && (
        <QueueSessionModal
          isOpen={isQueueModalOpen}
          onClose={() => {
            setIsQueueModalOpen(false)
            setQueueSessionData(null)
          }}
          courts={queueSessionData.courts}
          hourlyRate={queueSessionData.courts[0]?.hourly_rate || 0}
          venueId={venueId}
          venueName={venueName}
          capacity={Math.min(...queueSessionData.courts.map(c => c.capacity))}
          preselectedDate={queueSessionData.date}
          preselectedStartTime={queueSessionData.startTime}
          preselectedEndTime={queueSessionData.endTime}
        />
      )}
    </>
  )
}
