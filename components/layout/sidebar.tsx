'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Disc3, BookOpen, Brain, Dices, Plus, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  dueCount?: number
  userEmail?: string | null
  onQuickCapture?: () => void
}

export function Sidebar({ dueCount = 0, userEmail, onQuickCapture }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const navItems = [
    {
      label: 'Vault',
      href: '/',
      icon: BookOpen,
      badge: null,
    },
    {
      label: 'Review',
      href: '/review',
      icon: Brain,
      badge: dueCount > 0 ? dueCount : null,
    },
    {
      label: 'Random',
      href: '/random',
      icon: Dices,
      badge: null,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: SettingsIcon,
      badge: null,
    },
  ]

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col justify-between border-r border-zinc-800/80 bg-zinc-950/80 p-4 backdrop-blur-xl">
      <div className="flex flex-col gap-6">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 px-2 py-1 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 group-hover:ring-amber-500/40 transition-all">
            <Disc3 className="h-5 w-5 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <span className="font-bold text-sm text-zinc-100 tracking-tight block">Punk Records</span>
            <span className="text-[10px] text-zinc-500 font-mono block uppercase tracking-wider">Second Brain</span>
          </div>
        </Link>

        {/* Quick Capture Button */}
        <button
          onClick={onQuickCapture}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-sm transition-all hover:bg-amber-400 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          Quick Capture
        </button>

        {/* Nav Links */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800/80 text-amber-400 font-semibold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-400">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="border-t border-zinc-800/80 pt-3">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-zinc-300 truncate">
              {userEmail ?? 'User'}
            </span>
            <span className="text-[10px] text-zinc-500">Connected</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
