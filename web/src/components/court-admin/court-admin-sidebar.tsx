'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  Building2,
  DollarSign,
  BarChart3,
  Star,
  Settings,
  LogOut,
  User,
  ArrowLeft,
  Clock
} from 'lucide-react'

interface CourtAdminSidebarProps {
  user: {
    email: string
    avatarUrl?: string
    displayName?: string
  }
  venues: Array<{ id: string; name: string }>
}

export function CourtAdminSidebar({ user, venues }: CourtAdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/court-admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/court-admin/reservations', label: 'Reservations', icon: Calendar },
    { href: '/court-admin/venues', label: 'Venues & Courts', icon: Building2 },
    { href: '/court-admin/availability', label: 'Availability', icon: Clock },
    { href: '/court-admin/pricing', label: 'Pricing', icon: DollarSign },
    { href: '/court-admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/court-admin/reviews', label: 'Reviews', icon: Star },
    { href: '/', label: 'Back to Home', icon: ArrowLeft, isExternal: true },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-20 bg-gradient-to-b from-blue-50 to-blue-100 border-r border-blue-200 z-40"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Expanded overlay */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 bg-gradient-to-b from-blue-50 to-blue-100 border-r border-blue-200 shadow-lg transition-all duration-300 flex flex-col",
            isExpanded ? "w-64" : "w-20"
          )}
        >
          {/* Logo & Badge */}
          <div className="px-4 py-6 border-b border-gray-200">
            <Link href="/court-admin" className="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="Rallio"
                className="w-10 h-10 flex-shrink-0"
              />
              {isExpanded && (
                <div>
                  <span className="text-xl font-bold text-gray-900 tracking-wider whitespace-nowrap block">
                    RALLIO
                  </span>
                  <span className="text-gray-500 text-xs font-medium">Court Admin</span>
                </div>
              )}
            </Link>
          </div>

          {/* Venue Selector (if multiple venues) */}
          {isExpanded && venues.length > 1 && (
            <div className="px-3 mb-4 pt-4">
              <select className="w-full px-3 py-2 bg-gray-50 text-gray-900 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                <option value="">All Venues</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nav Links */}
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all',
                    isExpanded ? '' : 'justify-center',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    item.isExternal && 'mt-4 border-t border-gray-200 pt-4'
                  )}
                  title={!isExpanded ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isExpanded && (
                    <span className="whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="px-3 py-4 border-t border-gray-200 space-y-1">
            {/* User Profile */}
            <Link
              href="/profile"
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                isExpanded ? '' : 'justify-center'
              )}
              title={!isExpanded ? 'Profile' : undefined}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName || 'User'}
                  className="w-5 h-5 rounded-full flex-shrink-0"
                />
              ) : (
                <User className="w-5 h-5 flex-shrink-0" />
              )}
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {user.displayName || 'Profile'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {user.email}
                  </div>
                </div>
              )}
            </Link>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                isExpanded ? '' : 'justify-center'
              )}
              title={!isExpanded ? 'Sign Out' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {isExpanded && <span className="whitespace-nowrap">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          {navItems.slice(0, 3).map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-full text-[10px]">
                  {item.label.replace('Venues & ', '')}
                </span>
              </Link>
            )
          })}

          {/* Profile button on mobile */}
          <Link
            href="/profile"
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-colors',
              pathname === '/profile'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Profile"
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
            <span className="text-[10px]">Profile</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
