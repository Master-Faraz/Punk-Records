'use client'

import { useEffect } from 'react'
import { syncOutbox } from '@/lib/offline/sync'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // In development mode (localhost), unregister any active service worker and purge caches
    // so Next.js HMR, styling, and data changes update immediately without stale cache interception
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.')

    if (process.env.NODE_ENV === 'development' || isLocalhost) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister()
        }
      })
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key)
          }
        })
      }
      return
    }

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
