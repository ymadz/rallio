'use client'

import { useState } from 'react'
import { Calendar, Users, DollarSign, Clock, ArrowRight, Filter, PlayCircle, History } from 'lucide-react'
import Link from 'next/link'
import { QueueMasterHistoryClient } from './queue-master-history-client'
import { getStatusBadgeClasses, getStatusLabel, getStatusIcon, type QueueSessionStatus } from '@/lib/queue-status'

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
    initialHistory: any[]
}

type TabType = 'active' | 'past'

export function MySessionsClient({ initialSessions, initialHistory }: MySessionsClientProps) {
    const [activeTab, setActiveTab] = useState<TabType>('active')
    const [sessions] = useState<SessionData[]>(initialSessions)

    // Include legacy statuses so old sessions aren't invisible
    const activeStatuses = ['pending_payment', 'open', 'active', 'draft', 'pending_approval', 'upcoming', 'paused']

    // Filter active sessions
    const activeSessions = sessions.filter(session => activeStatuses.includes(session.status))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    const StatusBadge = ({ status }: { status: string }) => {
        const Icon = getStatusIcon(status as QueueSessionStatus)
        return (
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${getStatusBadgeClasses(status as QueueSessionStatus)}`}>
                <Icon className="w-4 h-4" />
                <span>{getStatusLabel(status as QueueSessionStatus)}</span>
            </div>
        )
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
                            {activeSessions.length}
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
                            {initialHistory.length}
                        </span>
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div>
                {activeTab === 'active' ? (
                    // Active Sessions List
                    activeSessions.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Filter className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No active sessions</h3>
                            <p className="text-gray-500">
                                You don't have any active or pending sessions at the moment.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeSessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow group"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        {/* Left Section: Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <StatusBadge status={session.status} />
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
                                                    <DollarSign className="w-4 h-4 text-gray-400" />
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
                    )
                ) : (
                    // History Tab - Use the History Client Component
                    <QueueMasterHistoryClient initialHistory={initialHistory} />
                )}
            </div>
        </div>
    )
}
