'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, Brain, Dices, Plus, LogOut, Settings as SettingsIcon } from 'lucide-react'
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-red-500/40 group-hover:ring-red-500/80 transition-all shadow-lg shadow-red-950/40">
            <Image
              src="/images/punk-records-logo.png"
              alt="Punk Records Logo"
              width={40}
              height={40}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              priority
            />
          </div>
          <div>
            <span className="font-bold text-sm text-zinc-100 tracking-tight block">Punk Records</span>
            <span className="text-[9px] text-red-400 font-mono block uppercase tracking-widest font-semibold">Neural Recall Engine</span>
          </div>
        </Link>

        {/* Quick Capture Button */}
        <button
          onClick={onQuickCapture}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
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
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-inner'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-red-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white font-mono shadow-sm shadow-red-500/30">
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
            <span className="text-xs font-medium text-zinc-200 truncate">
              {userEmail ?? 'User'}
            </span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block shadow-sm shadow-red-500 animate-pulse" />
              Haki Synced
            </span>
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
