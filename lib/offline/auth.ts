import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const AUTH_CACHE_KEY = 'punk_last_auth_user'

/**
 * Retrieves the current authenticated user safely in both online and offline states.
 * - Reads from local session storage first (instant & zero network overhead).
 * - Caches the verified user profile in localStorage for offline access.
 * - If offline, falls back seamlessly to session.user or cached user without throwing network errors.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  if (typeof window === 'undefined') return null

  try {
    const supabase = createClient()

    // 1. Check local session first (reads from storage/cookies, works completely offline)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      try {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(session.user))
      } catch {}
      return session.user
    }

    // 2. If session was not immediately found in cookie and we are online, check getUser
    if (navigator.onLine) {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        if (!error && user) {
          try {
            localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user))
          } catch {}
          return user
        }
      } catch {
        // Network request failed intermittently, fall back to offline cache
      }
    }

    // 3. Fallback to cached user in localStorage (ensures offline mode always has user ID)
    const cached = localStorage.getItem(AUTH_CACHE_KEY)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {}
    }

    return null
  } catch (err) {
    console.warn('Failed to retrieve authenticated user:', err)
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(AUTH_CACHE_KEY)
      if (cached) {
        try {
          return JSON.parse(cached)
        } catch {}
      }
    }
    return null
  }
}
