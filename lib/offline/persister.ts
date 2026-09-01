import { dehydrate, hydrate, type QueryClient, type DehydratedState } from '@tanstack/react-query'
import { idbGet, idbSet, STORES } from './idb'

const CACHE_KEY = 'tanstack_query_cache'
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

interface PersistedCachePayload {
  key: string
  timestamp: number
  data: DehydratedState
}

/**
 * Hydrate QueryClient from IndexedDB on application initialization
 */
export async function restoreQueryClient(queryClient: QueryClient): Promise<boolean> {
  if (typeof window === 'undefined') return false

  try {
    const record = await idbGet<PersistedCachePayload>(STORES.QUERY_CACHE, CACHE_KEY)
    if (!record || !record.data) return false

    // Discard cache if older than 7 days
    if (Date.now() - record.timestamp > MAX_CACHE_AGE_MS) {
      return false
    }

    hydrate(queryClient, record.data)
    return true
  } catch (err) {
    console.warn('Failed to restore query client from IndexedDB:', err)
    return false
  }
}

/**
 * Persist current successful queries to IndexedDB
 */
export async function persistQueryClient(queryClient: QueryClient): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const dehydratedState = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => {
        // Only persist queries that succeeded and have data
        return query.state.status === 'success' && query.state.data !== undefined
      },
    })

    const payload: PersistedCachePayload = {
      key: CACHE_KEY,
      timestamp: Date.now(),
      data: dehydratedState,
    }

    await idbSet(STORES.QUERY_CACHE, payload)
  } catch (err) {
    console.warn('Failed to persist query client to IndexedDB:', err)
  }
}

/**
 * Debounce helper for cache writes
 */
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
  let timeoutId: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Subscribes to QueryClient query cache changes with debouncing
 */
export function subscribeToCacheUpdates(queryClient: QueryClient): () => void {
  if (typeof window === 'undefined') return () => {}

  const debouncedPersist = debounce(() => {
    persistQueryClient(queryClient)
  }, 1000)

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event?.type === 'updated' && event.action?.type === 'success') {
      debouncedPersist()
    }
  })

  return unsubscribe
}
