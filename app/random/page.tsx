'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AppShell } from '@/components/layout/app-shell'
import { TiptapRenderer } from '@/components/editor/tiptap-renderer'
import { YouTubeEmbed, getYouTubeVideoId } from '@/components/media/youtube-embed'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RecordItem, Tag } from '@/types/database'
import {
  Dices,
  Eye,
  Calendar,
  ExternalLink,
  Sparkles,
  Loader2,
  Filter,
  CheckCircle2,
  BookOpen,
} from 'lucide-react'
import Link from 'next/link'

export default function RandomPage() {
  const queryClient = useQueryClient()
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [applyCooldown, setApplyCooldown] = useState(true) // 7-day cooldown
  const [currentRandomRecord, setCurrentRandomRecord] = useState<RecordItem | null>(null)
  const [isShuffling, setIsShuffling] = useState(false)

  // Fetch tags for filter dropdown
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    },
  })

  // Pull a random record
  const fetchRandomRecord = async () => {
    setIsShuffling(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setIsShuffling(false)
      return
    }

    let query = supabase
      .from('records')
      .select(`
        *,
        record_tags!inner(
          tag:tags(*)
        )
      `)
      .eq('user_id', user.id)
      .eq('is_archived', false)

    if (unreadOnly) {
      query = query.eq('read_count', 0)
    }

    if (selectedTag !== 'all') {
      query = query.eq('record_tags.tag_id', selectedTag)
    }

    const { data, error } = await query

    let eligibleList: any[] = data || []

    // If no tag was joined, fetch without inner join
    if (selectedTag === 'all' && eligibleList.length === 0) {
      const { data: fallbackData } = await supabase
        .from('records')
        .select(`
          *,
          record_tags(
            tag:tags(*)
          )
        `)
        .eq('user_id', user.id)
        .eq('is_archived', false)

      eligibleList = fallbackData || []
    }

    // Apply 7-day cooldown filter if enabled
    if (applyCooldown && eligibleList.length > 1) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const filtered = eligibleList.filter(
        (r) => !r.last_reviewed_at || r.last_reviewed_at < sevenDaysAgo
      )
      if (filtered.length > 0) {
        eligibleList = filtered
      }
    }

    if (eligibleList.length > 0) {
      // Pick random item
      const randomIndex = Math.floor(Math.random() * eligibleList.length)
      const picked = eligibleList[randomIndex]

      const formattedRecord: RecordItem = {
        ...picked,
        tags: picked.record_tags?.map((rt: any) => rt.tag).filter(Boolean) || [],
      }

      setCurrentRandomRecord(formattedRecord)

      // Increment read_count
      await supabase
        .from('records')
        .update({ read_count: (formattedRecord.read_count || 0) + 1 })
        .eq('id', formattedRecord.id)

      queryClient.invalidateQueries({ queryKey: ['records'] })
    } else {
      setCurrentRandomRecord(null)
    }

    setTimeout(() => setIsShuffling(false), 250)
  }

  // Load initial random record if not loaded
  const { isLoading } = useQuery({
    queryKey: ['initial-random', selectedTag, unreadOnly, applyCooldown],
    queryFn: async () => {
      await fetchRandomRecord()
      return true
    },
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl mx-auto py-2">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500 ring-1 ring-red-500/30 shadow-lg shadow-red-950/20">
              <Dices className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Random Recall</h1>
              <p className="text-xs text-zinc-400">Revisit past knowledge when you have 5 free minutes</p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchRandomRecord}
            disabled={isShuffling}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-zinc-950 transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-50 shadow-sm"
          >
            <Dices className={`h-4 w-4 ${isShuffling ? 'animate-spin' : ''}`} />
            Give Me Another
          </button>
        </div>

        {/* Filters & Cooldown Controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="all">All Tags</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded border-zinc-800 bg-zinc-950 accent-white text-white focus:ring-0"
            />
            <span>Unread only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyCooldown}
              onChange={(e) => setApplyCooldown(e.target.checked)}
              className="rounded border-zinc-800 bg-zinc-950 accent-white text-white focus:ring-0"
            />
            <span>7-day cooldown (avoid recent)</span>
          </label>
        </div>

        {/* Random Card Display */}
        {isLoading || isShuffling ? (
          <div className="flex flex-col items-center justify-center py-28 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="mt-2 text-xs">Finding a random note...</span>
          </div>
        ) : !currentRandomRecord ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center shadow-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-zinc-800 text-zinc-500 mb-3">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-zinc-200">No matching records found</h2>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm">
              Try adjusting your tag or unread filters to pull more records from your vault.
            </p>
          </div>
        ) : (
          <div className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900/70 shadow-2xl backdrop-blur-xl overflow-hidden">
            {currentRandomRecord.thumbnail_url && (
              <div className="relative h-48 sm:h-64 w-full border-b border-zinc-800">
                <Image
                  src={currentRandomRecord.thumbnail_url}
                  alt={currentRandomRecord.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 700px"
                  className="object-cover"
                  priority
                />
              </div>
            )}

            <div className="p-6 sm:p-8">
              {/* Card Tags */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentRandomRecord.tags && currentRandomRecord.tags.map((tag) => (
                    <span key={tag.id} className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                      #{tag.name}
                    </span>
                  ))}
                </div>

                <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                  <Eye className="h-3.5 w-3.5 text-zinc-500" />
                  {currentRandomRecord.read_count} reads
                </span>
              </div>

              {/* Title */}
              <Link
                href={`/records/${currentRandomRecord.id}`}
                className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-50 hover:text-white transition-colors"
              >
                {currentRandomRecord.title}
              </Link>

              {/* YouTube Embed if YouTube link */}
              {currentRandomRecord.source_url && getYouTubeVideoId(currentRandomRecord.source_url) ? (
                <div className="mt-4">
                  <YouTubeEmbed url={currentRandomRecord.source_url} title={currentRandomRecord.title} />
                </div>
              ) : currentRandomRecord.source_url ? (
                <a
                  href={currentRandomRecord.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white underline underline-offset-2 transition-colors truncate max-w-full"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{currentRandomRecord.source_url}</span>
                </a>
              ) : null}

            {/* Note Content */}
            <div className="mt-6 rounded-2xl border border-zinc-800/60 bg-zinc-950 p-5">
              <TiptapRenderer content={currentRandomRecord.content} />
            </div>

            {/* Card Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Sparkles className="h-3 w-3 text-zinc-400" />
                Stage {currentRandomRecord.review_stage}
              </span>

              <Link
                href={`/records/${currentRandomRecord.id}`}
                className="text-xs font-semibold text-zinc-200 hover:text-white underline underline-offset-4 transition-colors"
              >
                View Full Record →
              </Link>
            </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
