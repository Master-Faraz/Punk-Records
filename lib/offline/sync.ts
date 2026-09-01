import { createClient } from '@/lib/supabase/client'
import { getAuthenticatedUser } from './auth'
import {
  getPendingMutations,
  removeMutation,
  updateMutationStatus,
  notifySyncListeners,
  type QueuedMutation,
} from './outbox'
import { deleteRecordWithAssets } from '@/lib/supabase/cleanup'
import type { QueryClient } from '@tanstack/react-query'
import type { RecordItem, UserSettings } from '@/types/database'

let isSyncInProgress = false

export interface SyncStatus {
  isSyncing: boolean
  pendingCount: number
  lastSyncedAt: number | null
  error?: string | null
}

let lastSyncedTimestamp: number | null = null

/**
 * Executes pending mutations against Supabase in FIFO sequence.
 */
export async function syncOutbox(queryClient?: QueryClient): Promise<{
  success: boolean
  processedCount: number
  errors: string[]
}> {
  if (typeof window === 'undefined') {
    return { success: true, processedCount: 0, errors: [] }
  }

  // Prevent concurrent sync executions
  if (isSyncInProgress) {
    return { success: false, processedCount: 0, errors: ['Sync already in progress'] }
  }

  if (!navigator.onLine) {
    return { success: false, processedCount: 0, errors: ['Device is offline'] }
  }

  isSyncInProgress = true
  broadcastSyncState(true)

  const errors: string[] = []
  let processedCount = 0

  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      isSyncInProgress = false
      broadcastSyncState(false)
      return { success: false, processedCount: 0, errors: ['User not authenticated'] }
    }

    const supabase = createClient()
    const mutations = await getPendingMutations()

    for (const mutation of mutations) {
      if (!navigator.onLine) {
        // Connection dropped mid-sync; pause until connection is restored
        break
      }

      try {
        await updateMutationStatus(mutation.id, { status: 'syncing' })
        await executeMutation(supabase, user.id, mutation)
        await removeMutation(mutation.id)
        processedCount++
      } catch (err: unknown) {
        console.error(`Failed to sync mutation ${mutation.id} (${mutation.type}):`, err)
        const errorMsg = err instanceof Error ? err.message : String(err)
        errors.push(errorMsg)

        // Increment retry count
        const newRetryCount = (mutation.retryCount || 0) + 1
        if (newRetryCount >= 5) {
          // Discard permanently stuck mutation to prevent blocking the outbox queue
          console.warn(`Discarding unresolvable mutation ${mutation.id} after 5 retries.`)
          await removeMutation(mutation.id)
        } else {
          await updateMutationStatus(mutation.id, {
            status: 'failed',
            retryCount: newRetryCount,
            lastError: errorMsg,
          })
        }

        // If network-related failure, pause queue
        const isNetworkErr =
          (err instanceof Error && (err.name === 'TypeError' || err.message.includes('fetch'))) ||
          !navigator.onLine

        if (isNetworkErr) {
          break
        }
      }
    }

    if (processedCount > 0) {
      lastSyncedTimestamp = Date.now()
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['records'] })
        queryClient.invalidateQueries({ queryKey: ['due-records'] })
        queryClient.invalidateQueries({ queryKey: ['due-count'] })
        queryClient.invalidateQueries({ queryKey: ['tags'] })
        queryClient.invalidateQueries({ queryKey: ['user-settings'] })
      }
    }
  } finally {
    isSyncInProgress = false
    broadcastSyncState(false)
    notifySyncListeners()
  }

  return {
    success: errors.length === 0,
    processedCount,
    errors,
  }
}

/**
 * Replays a single queued mutation to Supabase
 */
async function executeMutation(supabase: ReturnType<typeof createClient>, userId: string, mutation: QueuedMutation) {
  const { type, payload } = mutation

  switch (type) {
    case 'CREATE_RECORD': {
      const { record, tags = [] } = payload as {
        record: RecordItem
        tags?: string[]
      }
      // 1. Insert record (upsert by ID for idempotency)
      const { error: recordError } = await supabase
        .from('records')
        .upsert(
          {
            ...record,
            user_id: userId,
          },
          { onConflict: 'id' }
        )

      if (recordError) throw recordError

      // 2. Insert tags if specified
      if (Array.isArray(tags) && tags.length > 0) {
        for (const tagName of tags) {
          const { data: tagData, error: tagError } = await supabase
            .from('tags')
            .upsert({ user_id: userId, name: tagName }, { onConflict: 'user_id,name' })
            .select()
            .single()

          if (!tagError && tagData) {
            await supabase
              .from('record_tags')
              .upsert(
                { record_id: record.id, tag_id: tagData.id },
                { onConflict: 'record_id,tag_id' }
              )
          }
        }
      }
      break
    }

    case 'UPDATE_RECORD': {
      const { recordId, updates, tags } = payload as {
        recordId: string
        updates: Partial<RecordItem>
        tags?: string[]
      }
      const { error } = await supabase
        .from('records')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('user_id', userId)

      if (error) throw error

      // If tags are provided, reconcile record_tags
      if (Array.isArray(tags)) {
        // Remove existing tags
        await supabase.from('record_tags').delete().eq('record_id', recordId)

        for (const tagName of tags) {
          const { data: tagData } = await supabase
            .from('tags')
            .upsert({ user_id: userId, name: tagName }, { onConflict: 'user_id,name' })
            .select()
            .single()

          if (tagData) {
            await supabase
              .from('record_tags')
              .insert({ record_id: recordId, tag_id: tagData.id })
          }
        }
      }
      break
    }

    case 'DELETE_RECORD': {
      const { recordId, thumbnailUrl, content } = payload as {
        recordId: string
        thumbnailUrl?: string | null
        content?: unknown
      }
      await deleteRecordWithAssets({
        id: recordId,
        thumbnail_url: thumbnailUrl || null,
        content,
      })
      break
    }

    case 'REVIEW_RECORD': {
      const { recordId, result, scheduledFor, previousStage, nextStage, nextReviewAt, reviewedAt } =
        payload as {
          recordId: string
          result: 'remembered' | 'forgot'
          scheduledFor?: string | null
          previousStage: number
          nextStage: number
          nextReviewAt: string
          reviewedAt?: string
        }
      const nowIso = reviewedAt || new Date().toISOString()

      // 1. Insert review history
      await supabase.from('reviews').insert({
        record_id: recordId,
        user_id: userId,
        scheduled_for: scheduledFor || null,
        reviewed_at: nowIso,
        result,
        previous_stage: previousStage,
        next_stage: nextStage,
      })

      // 2. Update record stage and intervals
      const { data: currentRecord } = await supabase
        .from('records')
        .select('read_count')
        .eq('id', recordId)
        .single()

      const currentReadCount = currentRecord?.read_count || 0

      const { error: recordError } = await supabase
        .from('records')
        .update({
          review_stage: nextStage,
          last_reviewed_at: nowIso,
          next_review_at: nextReviewAt,
          read_count: currentReadCount + 1,
          updated_at: nowIso,
        })
        .eq('id', recordId)
        .eq('user_id', userId)

      if (recordError) throw recordError
      break
    }

    case 'TOGGLE_FAVORITE': {
      const { recordId, is_favorite } = payload as {
        recordId: string
        is_favorite: boolean
      }
      const { error } = await supabase
        .from('records')
        .update({ is_favorite })
        .eq('id', recordId)
        .eq('user_id', userId)

      if (error) throw error
      break
    }

    case 'UPDATE_SETTINGS': {
      const { settings } = payload as { settings: UserSettings }
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            stage_1_days: settings.stage_1_days,
            stage_2_days: settings.stage_2_days,
            stage_3_days: settings.stage_3_days,
            random_cooldown_days: settings.random_cooldown_days,
          },
          { onConflict: 'user_id' }
        )

      if (error) throw error
      break
    }

    default:
      console.warn('Unknown mutation type:', (mutation as { type: string }).type)
  }
}

function broadcastSyncState(isSyncing: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('punk-sync-state', {
        detail: {
          isSyncing,
          lastSyncedAt: lastSyncedTimestamp,
        },
      })
    )
  }
}
