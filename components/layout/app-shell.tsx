'use client'

import Image from 'next/image'
import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { QuickCaptureModal } from '../capture/quick-capture-modal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getAuthenticatedUser } from '@/lib/offline/auth'
import { syncOutbox } from '@/lib/offline/sync'
import dynamic from 'next/dynamic'
import { RefreshCw, Check } from 'lucide-react'

const OfflineIndicator = dynamic(
  () => import('@/components/pwa/offline-indicator').then((mod) => mod.OfflineIndicator),
  { ssr: false }
)

export function AppShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  const handleQuickSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await syncOutbox(queryClient)
        await queryClient.invalidateQueries()
      }
      setJustSynced(true)
      setTimeout(() => setJustSynced(false), 2000)
    } catch (err) {
      console.error('Quick sync error:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    const checkUser = async () => {
      const user = await getAuthenticatedUser()
      setUserEmail(user?.email ?? null)
    }
    checkUser()
  }, [])

  // Fetch count of records due for review
  const { data: dueCount = 0 } = useQuery({
    queryKey: ['due-count'],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) return 0

      try {
        const supabase = createClient()
        const nowIso = new Date().toISOString()
        const { count, error } = await supabase
          .from('records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .lte('next_review_at', nowIso)

        if (error) {
          if (!navigator.onLine || error.message.includes('fetch')) throw error
          return 0
        }
        return count ?? 0
      } catch (err) {
        if (!navigator.onLine) throw err
        return 0
      }
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
        onQuickSync={handleQuickSync}
        isSyncing={isSyncing}
        justSynced={justSynced}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Mobile Top Header */}
        <header className="flex md:hidden h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-zinc-900 ring-1 ring-red-500/40 shadow-sm shadow-red-950/30">
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
          </Link>

          <button
            onClick={handleQuickSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-sm active:scale-95 transition-all hover:bg-zinc-200 cursor-pointer disabled:opacity-80"
            aria-label="Quick Sync"
          >
            {justSynced ? (
              <>
                <Check className="h-3.5 w-3.5 stroke-[2.5] text-emerald-600" />
                <span>Synced</span>
              </>
            ) : (
              <>
                <RefreshCw className={`h-3.5 w-3.5 stroke-[2.5] ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </>
            )}
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
        onQuickSync={handleQuickSync}
        isSyncing={isSyncing}
        justSynced={justSynced}
      />

      {/* Global Quick Capture Modal */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
      />

      {/* Offline & Sync Status Indicator */}
      <OfflineIndicator />
    </div>
  )
}
