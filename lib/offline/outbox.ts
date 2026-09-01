import { idbSet, idbGet, idbDelete, idbGetAll, STORES } from './idb'

export type MutationType =
  | 'CREATE_RECORD'
  | 'UPDATE_RECORD'
  | 'DELETE_RECORD'
  | 'REVIEW_RECORD'
  | 'TOGGLE_FAVORITE'
  | 'UPDATE_SETTINGS'

export interface QueuedMutation<T = unknown> {
  id: string
  type: MutationType
  payload: T
  createdAt: number
  status: 'pending' | 'syncing' | 'failed'
  retryCount: number
  lastError?: string
}

/**
 * Enqueues a new mutation to be executed when online
 */
export async function enqueueMutation<T = unknown>(
  type: MutationType,
  payload: T
): Promise<QueuedMutation<T>> {
  const mutation: QueuedMutation<T> = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    payload,
    createdAt: Date.now(),
    status: 'pending',
    retryCount: 0,
  }

  await idbSet(STORES.OUTBOX, mutation)
  notifySyncListeners()
  return mutation
}

/**
 * Get all pending mutations sorted by creation time (FIFO)
 */
export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const all = await idbGetAll<QueuedMutation>(STORES.OUTBOX)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * Get count of pending mutations
 */
export async function getPendingCount(): Promise<number> {
  const mutations = await getPendingMutations()
  return mutations.length
}

/**
 * Remove a successfully executed mutation from the outbox
 */
export async function removeMutation(id: string): Promise<void> {
  await idbDelete(STORES.OUTBOX, id)
  notifySyncListeners()
}

/**
 * Update the status of a mutation (e.g. syncing, failed)
 */
export async function updateMutationStatus(
  id: string,
  updates: Partial<Pick<QueuedMutation, 'status' | 'retryCount' | 'lastError'>>
): Promise<void> {
  const existing = await idbGet<QueuedMutation>(STORES.OUTBOX, id)
  if (existing) {
    const updated = { ...existing, ...updates }
    await idbSet(STORES.OUTBOX, updated)
    notifySyncListeners()
  }
}

/**
 * Broadcast event across the application whenever the outbox changes
 */
export function notifySyncListeners() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('punk-outbox-changed'))
  }
}
