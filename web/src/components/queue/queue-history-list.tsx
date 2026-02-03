'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ArrowRight, Calendar, Clock, MapPin, Trophy } from 'lucide-react'
import Link from 'next/link'

interface QueueHistoryItem {
    id: string
    courtName: string
    venueName: string
    status: string
    date: string
    joinedAt: string
    leftAt: string | null
    gamesPlayed: number
    gamesWon: number
    totalCost: number
    paymentStatus: string
    userStatus: string
}

interface HistoryListProps {
    history: QueueHistoryItem[]
}

export function QueueHistoryList({ history }: HistoryListProps) {
    if (!history || history.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="bg-primary/5 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No History Yet</h3>
                <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                    Your past queue sessions will appear here after you complete them.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {history.map((item) => (
                <Card key={item.id} className="p-4 transition-all hover:bg-accent/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                        {/* Main Info */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{item.venueName}</h3>
                                <Badge variant={item.userStatus === 'left' ? 'secondary' : 'outline'}>
                                    {item.userStatus === 'left' ? 'Left Early' : 'Completed'}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {format(new Date(item.date), 'MMM d, yyyy')}
                                </div>
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {item.courtName}
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                                <p className="text-muted-foreground text-xs uppercase font-medium">Games</p>
                                <p className="font-semibold text-lg">{item.gamesPlayed}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-muted-foreground text-xs uppercase font-medium">Won</p>
                                <p className="font-semibold text-lg text-primary">{item.gamesWon}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-muted-foreground text-xs uppercase font-medium">Paid</p>
                                <p className="font-semibold text-lg">₱{item.totalCost.toFixed(0)}</p>
                            </div>
                        </div>

                        {/* Action */}
                        <div className="md:ml-4">
                            {/* Future: Link to detailed stats page */}
                            {/* <Link href={`/queue/history/${item.id}`}> */}
                            <div className="opacity-50 cursor-not-allowed">
                                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                            </div>
                            {/* </Link> */}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    )
}
