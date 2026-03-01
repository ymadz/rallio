'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
    CheckCircle,
    XCircle,
    Clock,
    DollarSign,
    Trophy,
    Building2
} from 'lucide-react'

interface GlobalQueueHistoryClientProps {
    initialSessions: any[]
    venues: any[] // {id, name}
}

export function GlobalQueueHistoryClient({ initialSessions, venues }: GlobalQueueHistoryClientProps) {
    const [sessions, setSessions] = useState(initialSessions)
    const [selectedVenue, setSelectedVenue] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Filter logic 
    const filteredSessions = sessions.filter(session => {
        if (selectedVenue !== 'all' && session.venueName !== selectedVenue) return false
        if (statusFilter !== 'all' && session.status !== statusFilter) return false
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
    const totalSessions = filteredSessions.length

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'closed':
                return (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Closed
                    </Badge>
                )
            case 'cancelled':
                return (
                    <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-200 shadow-none border border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancelled
                    </Badge>
                )
            case 'active':
                return (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 shadow-none border border-green-200">
                        <Clock className="w-3 h-3 mr-1" />
                        Active
                    </Badge>
                )
            default:
                return (
                    <Badge variant="outline" className="text-gray-600">
                        <Clock className="w-3 h-3 mr-1" />
                        {status}
                    </Badge>
                )
        }
    }

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</h3>
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
                                placeholder="Search by venue or organizer..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="w-full sm:w-[200px]">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="open">Open</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Venue Filter */}
                    <div className="w-full sm:w-[250px]">
                        <Select
                            value={selectedVenue}
                            onValueChange={(val) => setSelectedVenue(val)}
                        >
                            <SelectTrigger>
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
                                <th className="px-6 py-4">Date & TIme</th>
                                <th className="px-6 py-4">Venue</th>
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
