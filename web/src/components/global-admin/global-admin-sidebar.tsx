'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  ShieldAlert,
  Settings,
  FileText,
  LogOut,
  ArrowLeft
} from 'lucide-react'

interface GlobalAdminSidebarProps {
  user: {
    email: string
    avatarUrl?: string
    displayName?: string
  }
}

export default function GlobalAdminSidebar({ user }: GlobalAdminSidebarProps) {
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
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/venues', label: 'Venues', icon: Building2 },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/admin/moderation', label: 'Moderation', icon: ShieldAlert },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/admin/audit', label: 'Audit Logs', icon: FileText },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-20 bg-gradient-to-b from-purple-600 to-purple-700 border-r border-purple-800 z-40"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Expanded overlay */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 bg-gradient-to-b from-purple-600 to-purple-700 border-r border-purple-800 shadow-2xl transition-all duration-300 flex flex-col",
            isExpanded ? "w-64" : "w-20"
          )}
        >
          {/* Logo */}
          <div className="px-4 py-6 flex justify-center">
            <Link href="/admin" className="flex items-center gap-2">
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

          {/* Role Badge */}
          {isExpanded && (
            <div className="px-4 pb-4">
              <div className="bg-purple-800/50 rounded-lg px-3 py-2 text-xs text-white/90">
                Logged in as <span className="font-semibold">Global Admin</span>
              </div>
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
            {/* Back to Home */}
            <Link
              href="/"
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors bg-white/5 text-white/90 hover:bg-white/10',
                isExpanded ? '' : 'justify-center'
              )}
              title={!isExpanded ? 'Back to Home' : undefined}
            >
              <ArrowLeft className="w-5 h-5 flex-shrink-0" />
              {isExpanded && <span>Back to Home</span>}
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-purple-700 border-t border-purple-800 z-50">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.slice(0, 5).map((item) => {
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
