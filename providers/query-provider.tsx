'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, type ReactNode } from 'react'
import { restoreQueryClient, subscribeToCacheUpdates } from '@/lib/offline/persister'
import { syncOutbox } from '@/lib/offline/sync'

export function QueryProvider({ children }: { children: ReactNode }) {
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
    restoreQueryClient(queryClient).then(() => {
      unsubscribeCache = subscribeToCacheUpdates(queryClient)
    })

    // 2. Initial outbox sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncOutbox(queryClient)
    }

    // 3. Network reconnect listener
    const handleOnline = () => {
      syncOutbox(queryClient)
    }

    // 4. Tab visibility change (e.g. unlocking phone or switching back to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncOutbox(queryClient)
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
