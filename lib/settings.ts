import { createClient } from './supabase/client'
import { DEFAULT_USER_SETTINGS, type UserSettings } from '@/types/database'

export async function getUserSettings(): Promise<UserSettings> {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('punk_user_settings')
    if (local) {
      try {
        return JSON.parse(local)
      } catch {}
    }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return DEFAULT_USER_SETTINGS

  try {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data) return data
  } catch {}

  return DEFAULT_USER_SETTINGS
}

export function computeNextReview(
  currentStage: number,
  result: 'remembered' | 'forgot',
  settings: UserSettings = DEFAULT_USER_SETTINGS
) {
  let nextStage = 1
  let intervalDays = settings.stage_1_days

  if (result === 'remembered') {
    if (currentStage === 0 || currentStage === 1) {
      nextStage = 2
      intervalDays = settings.stage_2_days
    } else if (currentStage === 2) {
      nextStage = 3
      intervalDays = settings.stage_3_days
    } else {
      nextStage = 3
      intervalDays = settings.stage_3_days
    }
  } else {
    nextStage = 1
    intervalDays = settings.stage_1_days
  }

  const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString()
  return { nextStage, intervalDays, nextReviewAt }
}
