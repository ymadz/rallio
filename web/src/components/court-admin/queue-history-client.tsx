'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Search,
    Download,
    Calendar,
    Clock,
    PhilippinePeso,
    Trophy
} from 'lucide-react'
import { getStatusBadgeClasses, getStatusLabel, getStatusIcon, type QueueSessionStatus } from '@/lib/queue-status'

interface QueueHistoryClientProps {
    initialSessions: any[]
    venues: any[] // {id, name}
}

export function QueueHistoryClient({ initialSessions, venues }: QueueHistoryClientProps) {
    const [sessions, setSessions] = useState(initialSessions)
    const [selectedVenue, setSelectedVenue] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Filter logic
    const filteredSessions = sessions.filter(session => {
        // Venue Filter
        if (selectedVenue !== 'all' && session.venueName !== selectedVenue) return false

        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return (
                session.venueName.toLowerCase().includes(query) ||
                session.courtName.toLowerCase().includes(query) ||
                session.organizerName.toLowerCase().includes(query)
            )
        }
        return true
    })

    // Stats Calculation
    const totalRevenue = filteredSessions.reduce((acc, curr) => acc + (curr.totalRevenue || 0), 0)
    const totalGames = filteredSessions.reduce((acc, curr) => acc + (curr.totalGames || 0), 0)
    const totalSessions = filteredSessions.length

    const getStatusBadge = (status: string) => {
        const Icon = getStatusIcon(status as QueueSessionStatus)
        return (
            <Badge 
                variant="secondary" 
                className={`${getStatusBadgeClasses(status as QueueSessionStatus)} hover:opacity-80`}
            >
                <Icon className="w-3 h-3 mr-1" />
                {getStatusLabel(status as QueueSessionStatus)}
            </Badge>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-full">
                            <Clock className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Sessions</p>
                            <h3 className="text-2xl font-bold text-gray-900">{totalSessions}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full">
                            <PhilippinePeso className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-full">
                            <Trophy className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Games</p>
                            <h3 className="text-2xl font-bold text-gray-900">{totalGames}</h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters Bar */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by venue, court, or organizer..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            />
                        </div>
                    </div>

                    {/* Venue Filter */}
                    <div className="w-full sm:w-[250px]">
                        <Select
                            value={selectedVenue}
                            onValueChange={(val) => setSelectedVenue(val)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Filter by Venue" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Venues</SelectItem>
                                {venues.map(v => (
                                    <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Export Button */}
                    <button className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                        <Download className="w-4 h-4" />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                            <tr>
                                <th className="px-6 py-4">Date & Time</th>
                                <th className="px-6 py-4">Venue Info</th>
                                <th className="px-6 py-4">Organizer</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Games</th>
                                <th className="px-6 py-4 text-right">Revenue</th>
                                <th className="px-6 py-4">Closed By</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredSessions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                                <Calendar className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <p className="text-gray-900 font-medium">No sessions found</p>
                                            <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">
                                                {format(new Date(session.startTime), 'MMM d, yyyy')}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {format(new Date(session.startTime), 'h:mm a')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{session.venueName}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{session.courtName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-600">
                                                    {session.organizerName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-gray-700">{session.organizerName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(session.status)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-medium text-gray-900">{session.totalGames}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-medium text-green-600">
                                                {formatCurrency(session.totalRevenue)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-gray-500 capitalize">{session.closedBy}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
