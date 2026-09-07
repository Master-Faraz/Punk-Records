'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Brain, Dices, Settings, Plus, ListTodo, StickyNote, Menu, X, ChevronRight } from 'lucide-react'

interface BottomNavProps {
  dueCount?: number
  onQuickSync?: () => void
  isSyncing?: boolean
  justSynced?: boolean
}

export function BottomNav({
  dueCount = 0,
}: BottomNavProps) {
  const pathname = usePathname()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const isMoreActive = pathname === '/review' || pathname === '/random' || pathname === '/settings'

  const drawerItems = [
    {
      label: 'Review Mode',
      href: '/review',
      icon: Brain,
      badge: dueCount > 0 ? `${dueCount} due` : null,
      desc: 'Spaced repetition recall queue',
    },
    {
      label: 'Random Recall',
      href: '/random',
      icon: Dices,
      badge: null,
      desc: '5-minute spontaneous knowledge pull',
    },
    {
      label: 'Settings & Preferences',
      href: '/settings',
      icon: Settings,
      badge: null,
      desc: 'Interval timings & tag management',
    },
  ]

  return (
    <>
      {/* Slide-up "More" Drawer Backdrop */}
      {isMoreOpen && (
        <div
          onClick={() => setIsMoreOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Slide-up "More" Drawer Panel */}
      {isMoreOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-zinc-800 bg-zinc-950/95 p-5 backdrop-blur-2xl md:hidden shadow-2xl animate-in slide-in-from-bottom duration-250 pb-safe">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
              More Sections
            </span>
            <button
              onClick={() => setIsMoreOpen(false)}
              className="rounded-full p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2 pt-1 pb-3">
            {drawerItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMoreOpen(false)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isActive
                      ? 'border-red-500/30 bg-red-500/10 text-white'
                      : 'border-zinc-800/80 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      isActive ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block">{item.label}</span>
                      <span className="text-[10px] text-zinc-500 block">{item.desc}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white font-mono shadow-sm">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-zinc-500" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Primary Mobile Bottom Nav */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-lg pb-safe">
        <div className="flex h-16 items-center justify-around px-2">
          {/* 1. Vault */}
          <Link
            href="/"
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 text-[10px] font-medium transition-colors ${
              pathname === '/' ? 'text-red-400 font-bold' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="h-5 w-5" />
            <span>Vault</span>
          </Link>

          {/* 2. Quick Notes */}
          <Link
            href="/notes"
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 text-[10px] font-medium transition-colors ${
              pathname === '/notes' ? 'text-red-400 font-bold' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <StickyNote className="h-5 w-5" />
            <span>Notes</span>
          </Link>

          {/* 3. Center FAB */}
          <Link
            href="/editor/new"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg shadow-white/10 active:scale-95 transition-all hover:bg-zinc-200 cursor-pointer"
            aria-label="New Record"
            title="New Record"
          >
            <Plus className="h-5 w-5 stroke-[2.5]" />
          </Link>

          {/* 4. Goals */}
          <Link
            href="/goals"
            className={`flex flex-col items-center justify-center gap-1 w-14 py-1 text-[10px] font-medium transition-colors ${
              pathname === '/goals' ? 'text-red-400 font-bold' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <ListTodo className="h-5 w-5" />
            <span>Goals</span>
          </Link>

          {/* 5. More (Drawer Trigger) */}
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={`relative flex flex-col items-center justify-center gap-1 w-14 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
              isMoreActive ? 'text-red-400 font-bold' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
            {dueCount > 0 && (
              <span className="absolute top-0.5 right-2 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-zinc-950" />
            )}
          </button>
        </div>
      </nav>
    </>
  )
}
