'use client'

import { useEffect } from 'react'
import { syncOutbox } from '@/lib/offline/sync'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const shouldRegister =
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_ENABLE_SW_DEV === 'true' ||
      window.location.search.includes('sw=1')

    if (!shouldRegister) return

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Register Background Sync if supported (e.g. Chrome / Chromium)
        const swReg = registration as unknown as {
          sync?: { register: (tag: string) => Promise<void> }
        }
        if (swReg.sync && typeof swReg.sync.register === 'function') {
          swReg.sync.register('sync-mutations').catch((err: unknown) => {
            console.warn('[PWA] Background sync registration failed:', err)
          })
        }
      })
      .catch((err) => {
        console.warn('[PWA] SW registration failed:', err)
      })

    // Listen for messages from the service worker (such as background sync events)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BACKGROUND_SYNC_TRIGGER') {
        syncOutbox()
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  return null
}
