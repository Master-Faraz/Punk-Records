import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

/**
 * Retrieves the current authenticated user safely in both online and offline states.
 * - Reads from local session storage first (instant & zero network overhead).
 * - If online, verifies with getUser() when possible.
 * - If offline, falls back gracefully to session.user without throwing network errors.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  if (typeof window === 'undefined') return null

  try {
    const supabase = createClient()

    // 1. Check local session first (reads from storage, works completely offline)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      // If offline and no session found in storage, unauthenticated
      if (!navigator.onLine) return null

      // If online, attempt getUser
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user || null
    }

    // 2. If online and session exists, verify in background
    if (navigator.onLine) {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        if (!error && user) return user
      } catch {
        // If network request failed intermittently, still trust local session
      }
    }

    return session.user
  } catch (err) {
    console.warn('Failed to retrieve authenticated user:', err)
    return null
  }
}
