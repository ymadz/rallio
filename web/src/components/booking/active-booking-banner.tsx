import { createClient } from '@/lib/supabase/server'
import { getServerNow } from '@/lib/time-server'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BookingTimer } from './booking-timer'
import { MapPin } from 'lucide-react'

export async function ActiveBookingBanner() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Get current server time
    const now = await getServerNow()
    const nowIso = now.toISOString()

    // Fetch ONE active 'ongoing' booking
    const { data: booking } = await supabase
        .from('reservations')
        .select(`
            id,
            start_time,
            end_time,
            court:courts(
                name,
                venue:venues(name)
            )
        `)
        .eq('user_id', user.id)
        .in('status', ['ongoing', 'confirmed'])
        .lte('start_time', nowIso)
        .gte('end_time', nowIso)
        .single() // We assume only one active booking at a time for MVP

    if (!booking) return null

    // Map the joined data safely
    // Supabase types might be tricky with deep joins, so we cast specific fields if needed
    // But basic select logic usually returns correct structure.
    const courtName = (booking.court as any)?.name || 'Unknown Court'
    const venueName = (booking.court as any)?.venue?.name || 'Unknown Venue'

    return (
        <Card className="mb-6 p-4 border-primary/50 bg-gradient-to-r from-primary/5 to-transparent border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center animate-bounce">
                        <span className="text-2xl">🏸</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-foreground">Happening Now!</h3>
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span className="text-sm">{venueName} • {courtName}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <BookingTimer endTime={booking.end_time} />
                    <Button size="sm" variant="default" className="gap-2">
                        <Link href={`/bookings/${booking.id}`}>
                            View Details
                        </Link>
                    </Button>
                </div>
            </div>
        </Card>
    )
}
