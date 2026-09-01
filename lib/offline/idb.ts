/**
 * Lightweight, zero-dependency promise wrapper for IndexedDB
 * Database: punk-records-storage
 * Stores:
 *   - query_cache: stores dehydrated React Query state
 *   - outbox: stores queued mutations for offline synchronization
 */

const DB_NAME = 'punk-records-storage'
const DB_VERSION = 1

export const STORES = {
  QUERY_CACHE: 'query_cache',
  OUTBOX: 'outbox',
} as const

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not available'))
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // 1. Query Cache Store (simple key-value: key -> dehydrated data)
      if (!db.objectStoreNames.contains(STORES.QUERY_CACHE)) {
        db.createObjectStore(STORES.QUERY_CACHE, { keyPath: 'key' })
      }

      // 2. Outbox Store for offline mutations
      if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
        const outboxStore = db.createObjectStore(STORES.OUTBOX, { keyPath: 'id' })
        outboxStore.createIndex('createdAt', 'createdAt', { unique: false })
        outboxStore.createIndex('status', 'status', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Execute a transaction on a specific store
 */
export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)

      let result: T | undefined
      const maybePromise = callback(store)

      if (maybePromise instanceof Promise) {
        maybePromise.then(
          (res) => {
            result = res
          },
          (err) => {
            transaction.abort()
            reject(err)
          }
        )
      } else {
        result = maybePromise
      }

      transaction.oncomplete = () => {
        db.close()
        resolve(result as T)
      }
      transaction.onerror = () => {
        db.close()
        reject(transaction.error)
      }
      transaction.onabort = () => {
        db.close()
        reject(transaction.error || new Error('Transaction aborted'))
      }
    } catch (err) {
      db.close()
      reject(err)
    }
  })
}

/**
 * Get an item by key from a store
 */
export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return withStore(storeName, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  })
}

/**
 * Put an item into a store
 */
export async function idbSet<T>(storeName: string, value: T): Promise<void> {
  return withStore(storeName, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.put(value)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}

/**
 * Delete an item from a store by key
 */
export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  return withStore(storeName, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}

/**
 * Get all items from a store
 */
export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  return withStore(storeName, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  })
}

/**
 * Clear all items from a store
 */
export async function idbClear(storeName: string): Promise<void> {
  return withStore(storeName, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}
