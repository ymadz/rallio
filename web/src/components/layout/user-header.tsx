'use client'

import { usePathname } from 'next/navigation'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { UserNav } from '@/components/layout/user-nav'

interface UserHeaderProps {
    user: {
        email: string
        id: string
        avatarUrl?: string
        displayName?: string
        firstName?: string
        lastName?: string
        phone?: string
        bio?: string
        birthDate?: string
        gender?: string
    }
}

export function UserHeader({ user }: UserHeaderProps) {
    const pathname = usePathname()

    const getHeaderInfo = (path: string) => {
        if (path === '/' || path === '/home') {
            return {
                title: 'Dashboard',
                subtitle: 'Find games and manage bookings'
            }
        }
        if (path.startsWith('/courts')) {
            return {
                title: 'Courts',
                subtitle: 'Find and book courts'
            }
        }
        if (path.startsWith('/bookings')) {
            return {
                title: 'My Bookings',
                subtitle: 'Upcoming court reservations and schedules'
            }
        }
        if (path.startsWith('/queue')) {
            return {
                title: 'Queue Dashboard',
                subtitle: 'Manage your active queues'
            }
        }
        if (path.startsWith('/matches')) {
            return {
                title: 'My Matches',
                subtitle: 'Track your performance and match history'
            }
        }
        if (path.startsWith('/profile')) {
            return {
                title: 'Profile',
                subtitle: 'Manage your account'
            }
        }
        if (path.startsWith('/settings')) {
            return {
                title: 'Settings',
                subtitle: 'App preferences'
            }
        }
        return {
            title: 'Dashboard',
            subtitle: 'Find games and manage bookings'
        }
    }

    const { title, subtitle } = getHeaderInfo(pathname)

    return (
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600">{subtitle}</p>
            </div>
            <div className="flex items-center gap-4">
                <NotificationBell />
                <UserNav user={user} />
            </div>
        </header>
    )
}
