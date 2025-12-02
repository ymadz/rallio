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
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-20 bg-gradient-to-b from-primary to-primary/90 z-40"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Expanded overlay */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 bg-gradient-to-b from-primary to-primary/90 shadow-lg transition-all duration-300 flex flex-col",
            isExpanded ? "w-64" : "w-20"
          )}
        >
          {/* Logo */}
          <div className="px-4 py-6 flex justify-center">
            <Link href="/queue-master" className="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="Rallio"
                className="w-10 h-10 flex-shrink-0 brightness-0 invert"
              />
              {isExpanded && (
                <span className="text-xl font-bold text-white tracking-wider whitespace-nowrap">
                  RALLIO
                </span>
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
                    'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                    isExpanded ? '' : 'justify-center',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
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
            {/* Back to Player View */}
            <Link
              href="/queue"
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors bg-white/5 text-white/90 hover:bg-white/10',
                isExpanded ? '' : 'justify-center'
              )}
              title={!isExpanded ? 'Back to Player View' : undefined}
            >
              <ArrowLeft className="w-5 h-5 flex-shrink-0" />
              {isExpanded && <span>Back to Player View</span>}
            </Link>

            {/* Settings */}
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors',
                isExpanded ? '' : 'justify-center'
              )}
              title={!isExpanded ? 'Settings' : undefined}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {isExpanded && <span>Settings</span>}
            </Link>

            {/* Logout */}
            <button
              onClick={handleSignOut}
              className={cn(
                'flex items-center gap-3 px-3 py-3 w-full rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors',
                isExpanded ? '' : 'justify-center'
              )}
              title={!isExpanded ? 'Logout' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {isExpanded && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/90 border-t border-primary-dark z-50">
        <div className="flex items-center justify-around h-16 px-2">
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
                  'flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors',
                  isActive ? 'text-white' : 'text-white/70 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
