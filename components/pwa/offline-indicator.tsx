'use client'

import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react'
import { getPendingCount } from '@/lib/offline/outbox'
import { syncOutbox } from '@/lib/offline/sync'
import { useQueryClient } from '@tanstack/react-query'

export function OfflineIndicator() {
  const queryClient = useQueryClient()
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSyncedBanner, setShowSyncedBanner] = useState(false)

  useEffect(() => {
    const updateCount = async () => {
      try {
        const count = await getPendingCount()
        setPendingCount(count)
      } catch {}
    }

    const handleOnline = () => {
      setIsOnline(true)
      updateCount()
    }

    const handleOffline = () => {
      setIsOnline(false)
      updateCount()
    }

    const handleOutboxChange = () => {
      updateCount()
    }

    const handleSyncState = (e: Event) => {
      const customEvent = e as CustomEvent<{ isSyncing: boolean; lastSyncedAt: number | null }>
      setIsSyncing(customEvent.detail.isSyncing)
      if (!customEvent.detail.isSyncing) {
        updateCount()
        if (customEvent.detail.lastSyncedAt) {
          setShowSyncedBanner(true)
          setTimeout(() => setShowSyncedBanner(false), 3000)
        }
      }
    }

    updateCount()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('punk-outbox-changed', handleOutboxChange)
    window.addEventListener('punk-sync-state', handleSyncState)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('punk-outbox-changed', handleOutboxChange)
      window.removeEventListener('punk-sync-state', handleSyncState)
    }
  }, [])

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return
    await syncOutbox(queryClient)
  }

  // Hide when online and no pending sync or banner
  if (isOnline && pendingCount === 0 && !isSyncing && !showSyncedBanner) {
    return null
  }

  return (
    <aside
      aria-label="Network and synchronization status"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-2 rounded-full border border-zinc-800/90 bg-zinc-900/95 px-3.5 py-1.5 text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto select-none"
    >
      {!isOnline ? (
        <div className="flex items-center gap-2 text-amber-400">
          <WifiOff className="h-3.5 w-3.5 animate-pulse text-amber-400" />
          <span className="font-medium">
            Offline {pendingCount > 0 ? `• ${pendingCount} pending` : '• Changes saved locally'}
          </span>
        </div>
      ) : isSyncing ? (
        <div className="flex items-center gap-2 text-zinc-300">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />
          <span className="font-medium">
            Syncing {pendingCount > 0 ? `${pendingCount} change${pendingCount > 1 ? 's' : ''}` : ''}...
          </span>
        </div>
      ) : showSyncedBanner ? (
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-medium">All changes synced</span>
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex items-center gap-2 text-zinc-300">
          <CloudUpload className="h-3.5 w-3.5 text-amber-400" />
          <span>{pendingCount} unsynced</span>
          <button
            onClick={handleManualSync}
            className="ml-1 rounded-md bg-zinc-800 px-2 py-0.5 font-semibold text-zinc-100 hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Sync now
          </button>
        </div>
      ) : null}
    </aside>
  )
}
