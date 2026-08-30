'use client'

import Image from 'next/image'
import { useState, useEffect, type ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { QuickCaptureModal } from '../capture/quick-capture-modal'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'

export function AppShell({ children }: { children: ReactNode }) {
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserEmail(user?.email ?? null)
    }
    checkUser()
  }, [])

  // Fetch count of records due for review
  const { data: dueCount = 0 } = useQuery({
    queryKey: ['due-count'],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return 0

      const nowIso = new Date().toISOString()
      const { count, error } = await supabase
        .from('records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .lte('next_review_at', nowIso)

      if (error) return 0
      return count ?? 0
    },
    refetchInterval: 60 * 1000, // check every minute
  })

  // Keyboard shortcut Cmd+K or Ctrl+K for quick capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsQuickCaptureOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen w-full bg-zinc-950 overflow-hidden text-zinc-100">
      {/* Desktop Sidebar */}
      <Sidebar
        dueCount={dueCount}
        userEmail={userEmail}
        onQuickCapture={() => setIsQuickCaptureOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Mobile Top Header */}
        <header className="flex md:hidden h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-zinc-900 ring-1 ring-amber-500/20 shadow-sm">
              <Image
                src="/images/punk-records-logo.png"
                alt="Punk Records Logo"
                width={32}
                height={32}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <span className="font-bold text-sm tracking-tight text-zinc-100">Punk Records</span>
          </div>

          <button
            onClick={() => setIsQuickCaptureOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/20 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Capture
          </button>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6 p-4 md:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        dueCount={dueCount}
        onQuickCapture={() => setIsQuickCaptureOpen(true)}
      />

      {/* Global Quick Capture Modal */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
      />
    </div>
  )
}
