'use client'

import { useState } from 'react'
import { Calendar, Users, PhilippinePeso, Clock, PlayCircle, CheckCircle, XCircle, ArrowRight, Filter } from 'lucide-react'
import Link from 'next/link'

interface SessionData {
    id: string
    courtName: string
    venueName: string
    status: string
    currentPlayers: number
    maxPlayers: number
    costPerGame: number
    startTime: Date
    endTime: Date
    createdAt: Date
    mode: string
    gameFormat: string
    participants: any[]
}

interface MySessionsClientProps {
    initialSessions: SessionData[]
}

type TabType = 'active' | 'past'

export function MySessionsClient({ initialSessions }: MySessionsClientProps) {
    const [activeTab, setActiveTab] = useState<TabType>('active')
    const [sessions] = useState<SessionData[]>(initialSessions)

    const activeStatuses = ['draft', 'open', 'active', 'paused', 'upcoming', 'pending_approval']
    const pastStatuses = ['closed', 'cancelled', 'completed', 'expired', 'rejected']

    const filteredSessions = sessions.filter(session => {
        if (activeTab === 'active') {
            return activeStatuses.includes(session.status)
        } else {
            return pastStatuses.includes(session.status)
        }
    })

    // Sort: Active by start time asc, Past by end time desc
    const sortedSessions = [...filteredSessions].sort((a, b) => {
        if (activeTab === 'active') {
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        } else {
            return new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
        }
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 border-green-200'
            case 'open': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'paused': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
            case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200'
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200'
            case 'draft': return 'bg-gray-100 text-gray-600 border-gray-200'
            case 'pending_approval': return 'bg-orange-100 text-orange-700 border-orange-200'
            case 'rejected': return 'bg-red-100 text-red-700 border-red-200'
            default: return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <PlayCircle className="w-4 h-4" />
            case 'open': return <Clock className="w-4 h-4" />
            case 'closed': return <CheckCircle className="w-4 h-4" />
            case 'cancelled': return <XCircle className="w-4 h-4" />
            case 'pending_approval': return <Clock className="w-4 h-4" />
            case 'rejected': return <XCircle className="w-4 h-4" />
            default: return <Clock className="w-4 h-4" />
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Sessions</h1>
                    <p className="text-gray-600 mt-1">View and manage all your queue sessions</p>
                </div>
                <Link
                    href="/queue-master/create"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <Calendar className="w-5 h-5" />
                    <span className="font-semibold">Create New Session</span>
                </Link>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'active'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
            `}
                    >
                        <PlayCircle className="w-4 h-4" />
                        Active & Pending
                        <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium ${activeTab === 'active' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                            }`}>
                            {sessions.filter(s => activeStatuses.includes(s.status)).length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('past')}
                        className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'past'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
            `}
                    >
                        <Clock className="w-4 h-4" />
                        History
                        <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium ${activeTab === 'past' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                            }`}>
                            {sessions.filter(s => pastStatuses.includes(s.status)).length}
                        </span>
                    </button>
                </nav>
            </div>

            {/* Sessions List */}
            <div>
                {sortedSessions.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Filter className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No sessions found</h3>
                        <p className="text-gray-500">
                            {activeTab === 'active'
                                ? "You don't have any active or pending sessions."
                                : "You don't have any past sessions yet."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedSessions.map((session) => (
                            <div
                                key={session.id}
                                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow group"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Left Section: Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${getStatusColor(session.status)}`}>
                                                {getStatusIcon(session.status)}
                                                <span className="capitalize">{session.status}</span>
                                            </div>
                                            <span className="text-xs text-gray-500 font-mono">#{session.id.slice(0, 8)}</span>
                                            <span className="text-xs text-gray-500">•</span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(session.startTime).toLocaleDateString(undefined, {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors">
                                            {session.courtName} <span className="font-normal text-gray-500">at</span> {session.venueName}
                                        </h3>

                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <span>
                                                    {new Date(session.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Users className="w-4 h-4 text-gray-400" />
                                                <span>{session.currentPlayers} / {session.maxPlayers} Players</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <PhilippinePeso className="w-4 h-4 text-gray-400" />
                                                <span>₱{session.costPerGame} / game</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Section: Action */}
                                    <div className="flex items-center justify-end">
                                        <Link
                                            href={`/queue-master/sessions/${session.id}`}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors font-medium text-sm"
                                        >
                                            Manage
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
