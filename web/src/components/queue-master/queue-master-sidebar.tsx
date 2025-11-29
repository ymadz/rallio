'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  User,
  ArrowLeft,
  ChevronRight
} from 'lucide-react'

interface QueueMasterSidebarProps {
  user: {
    email: string
    avatarUrl?: string
    displayName?: string
  }
}

export function QueueMasterSidebar({ user }: QueueMasterSidebarProps) {
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
    { href: '/queue-master', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/queue-master/create', label: 'Create Session', icon: Calendar },
    { href: '/queue-master/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/queue', label: 'Back to Player View', icon: ArrowLeft, isExternal: true },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-20 bg-gradient-to-b from-primary to-primary/90 border-r border-primary-dark z-40"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Expanded overlay */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 bg-gradient-to-b from-primary to-primary/90 border-r border-primary-dark shadow-2xl transition-all duration-300 flex flex-col",
            isExpanded ? "w-64" : "w-20"
          )}
        >
          {/* Logo & Badge */}
          <div className="px-4 py-6">
            <Link href="/queue-master" className="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="Rallio"
                className="w-10 h-10 flex-shrink-0 brightness-0 invert"
              />
              {isExpanded && (
                <div>
                  <span className="text-xl font-bold text-white tracking-wider whitespace-nowrap block">
                    RALLIO
                  </span>
                  <span className="text-white/80 text-xs font-medium">Queue Master</span>
                </div>
              )}
            </Link>
          </div>

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
                      ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white',
                    item.isExternal && 'mt-4 border-t border-white/20 pt-4'
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
          <div className="px-3 py-4 border-t border-white/20 space-y-1">
            {/* User Profile */}
            <Link
              href="/profile"
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-white/80 hover:bg-white/10 hover:text-white',
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
                  <div className="text-sm font-medium text-white truncate">
                    {user.displayName || 'Profile'}
                  </div>
                  <div className="text-xs text-white/60 truncate">
                    {user.email}
                  </div>
                </div>
              )}
            </Link>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-white/80 hover:bg-white/10 hover:text-white',
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
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-gradient-to-r from-primary to-primary/90 border-t border-primary-dark shadow-2xl z-50 backdrop-blur-lg">
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
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-full text-[10px]">
                  {item.label.replace('Create ', '')}
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
                ? 'bg-white/20 text-white'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
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
