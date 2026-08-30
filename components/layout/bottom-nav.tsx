'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Brain, Dices, Plus } from 'lucide-react'

interface BottomNavProps {
  dueCount?: number
  onQuickCapture?: () => void
}

export function BottomNav({ dueCount = 0, onQuickCapture }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-lg pb-safe">
      <div className="flex h-16 items-center justify-around px-2">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center gap-1 w-16 py-1 text-[11px] font-medium transition-colors ${
            pathname === '/' ? 'text-amber-400 font-semibold' : 'text-zinc-400'
          }`}
        >
          <BookOpen className="h-5 w-5" />
          <span>Vault</span>
        </Link>

        <Link
          href="/review"
          className={`relative flex flex-col items-center justify-center gap-1 w-16 py-1 text-[11px] font-medium transition-colors ${
            pathname === '/review' ? 'text-amber-400 font-semibold' : 'text-zinc-400'
          }`}
        >
          <Brain className="h-5 w-5" />
          <span>Review</span>
          {dueCount > 0 && (
            <span className="absolute top-0.5 right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-zinc-950">
              {dueCount}
            </span>
          )}
        </Link>

        {/* Center Quick Capture FAB */}
        <button
          onClick={onQuickCapture}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
          aria-label="Quick Capture"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>

        <Link
          href="/random"
          className={`flex flex-col items-center justify-center gap-1 w-16 py-1 text-[11px] font-medium transition-colors ${
            pathname === '/random' ? 'text-amber-400 font-semibold' : 'text-zinc-400'
          }`}
        >
          <Dices className="h-5 w-5" />
          <span>Random</span>
        </Link>
      </div>
    </nav>
  )
}
