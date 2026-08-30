export type SourceType = 'youtube' | 'article' | 'book' | 'note' | 'other'

export interface RecordItem {
  id: string
  user_id: string
  title: string
  thumbnail_url: string | null
  content: any // Tiptap JSON document
  source_url: string | null
  source_type: SourceType
  is_favorite: boolean
  is_archived: boolean
  read_count: number
  review_stage: number // 0: new, 1: 1-day, 2: 7-day, 3: 30-day
  last_reviewed_at: string | null
  next_review_at: string
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface Tag {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface RecordTag {
  record_id: string
  tag_id: string
}

export interface Review {
  id: string
  record_id: string
  user_id: string
  scheduled_for: string | null
  reviewed_at: string
  result: 'remembered' | 'forgot'
  previous_stage: number
  next_stage: number
  created_at: string
}

export type ReviewInterval = 1 | 7 | 30

export const REVIEW_STAGES = [1, 7, 30] as const
