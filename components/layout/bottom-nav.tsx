'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Brain, Dices, RefreshCw, Check, Settings } from 'lucide-react'

interface BottomNavProps {
  dueCount?: number
  onQuickSync?: () => void
  isSyncing?: boolean
  justSynced?: boolean
}

export function BottomNav({
  dueCount = 0,
  onQuickSync,
  isSyncing = false,
  justSynced = false,
}: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-lg pb-safe">
      <div className="flex h-16 items-center justify-around px-2">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center gap-1 w-14 py-1 text-[10px] font-medium transition-colors ${
            pathname === '/' ? 'text-red-400 font-bold' : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          <BookOpen className="h-5 w-5" />
          <span>Vault</span>
        </Link>

        <Link
          href="/review"
          className={`relative flex flex-col items-center justify-center gap-1 w-14 py-1 text-[10px] font-medium transition-colors ${
            pathname === '/review' ? 'text-red-400 font-bold' : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          <Brain className="h-5 w-5" />
          <span>Review</span>
          {dueCount > 0 && (
            <span className="absolute top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white font-mono shadow-sm shadow-red-500/40">
              {dueCount}
            </span>
          )}
        </Link>

        {/* Center Quick Sync FAB */}
        <button
          onClick={onQuickSync}
          disabled={isSyncing}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg active:scale-95 transition-all hover:bg-zinc-200 cursor-pointer disabled:opacity-80"
          aria-label="Quick Sync across devices"
        >
          {justSynced ? (
            <Check className="h-5 w-5 stroke-[2.5] text-emerald-600" />
          ) : (
            <RefreshCw className={`h-5 w-5 stroke-[2.5] ${isSyncing ? 'animate-spin text-zinc-700' : ''}`} />
          )}
        </button>

        <Link
          href="/random"
          className={`flex flex-col items-center justify-center gap-1 w-14 py-1 text-[10px] font-medium transition-colors ${
            pathname === '/random' ? 'text-red-400 font-bold' : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          <Dices className="h-5 w-5" />
          <span>Random</span>
        </Link>

        <Link
          href="/settings"
          className={`flex flex-col items-center justify-center gap-1 w-14 py-1 text-[10px] font-medium transition-colors ${
            pathname === '/settings' ? 'text-red-400 font-bold' : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  )
}
