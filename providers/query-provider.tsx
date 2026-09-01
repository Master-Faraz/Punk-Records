'use client'

import { QueryClient, QueryClientProvider, IsRestoringProvider } from '@tanstack/react-query'
import { useState, useEffect, type ReactNode } from 'react'
import { restoreQueryClient, subscribeToCacheUpdates } from '@/lib/offline/persister'
import { syncOutbox } from '@/lib/offline/sync'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [isRestoring, setIsRestoring] = useState(true)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: 'offlineFirst',
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days in cache
            staleTime: 1000 * 60 * 5, // 5 minutes fresh
            refetchOnMount: false,
            refetchOnWindowFocus: true,
            refetchOnReconnect: false,
            retry: 1,
          },
          mutations: {
            networkMode: 'offlineFirst',
            retry: 0,
          },
        },
      })
  )

  useEffect(() => {
    let unsubscribeCache: (() => void) | undefined

    // 1. Restore cached data from IndexedDB on startup
    restoreQueryClient(queryClient)
      .then(() => {
        setIsRestoring(false)
        unsubscribeCache = subscribeToCacheUpdates(queryClient)
      })
      .catch(() => {
        setIsRestoring(false)
      })

    // 2. Initial outbox sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncOutbox(queryClient)
    }

    // 3. Network reconnect listener: sync outbox first, then refresh queries
    const handleOnline = async () => {
      await syncOutbox(queryClient)
      await queryClient.invalidateQueries()
    }

    // 4. Tab visibility change (e.g. unlocking phone or switching back to app)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        await syncOutbox(queryClient)
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (unsubscribeCache) unsubscribeCache()
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  )
}
