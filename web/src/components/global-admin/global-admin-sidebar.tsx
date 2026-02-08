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
  ArrowLeft,
  Undo2
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
    { href: '/admin/refunds', label: 'Refunds', icon: Undo2 },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/admin/moderation', label: 'Moderation', icon: ShieldAlert },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/admin/queue-history', label: 'Queue History', icon: Building2 },
    { href: '/admin/audit', label: 'Audit Logs', icon: FileText },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-20 bg-white border-r border-gray-200 z-40"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Expanded overlay */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 bg-white border-r border-gray-200 shadow-lg transition-all duration-300 flex flex-col",
            isExpanded ? "w-64" : "w-20"
          )}
        >
          {/* Logo */}
          <div className="px-4 py-6 flex justify-center">
            <Link href="/admin" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Rallio"
                className="w-10 h-10 flex-shrink-0"
                style={{
                  filter: 'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(352%) hue-rotate(131deg) brightness(92%) contrast(92%)'
                }}
              />
              {isExpanded && (
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-primary tracking-wider whitespace-nowrap">
                    Rallio
                  </span>
                  <span className="text-xs font-medium text-purple-600 uppercase tracking-wider">
                    Global Admin
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-3 space-y-1 mt-4">
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
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
            {/* Back to Home */}
            <Link
              href="/"
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900',
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
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors',
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
                'flex items-center gap-3 px-3 py-3 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors',
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
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
                  isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
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
