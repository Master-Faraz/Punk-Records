'use client'

import { useState, useEffect, useMemo } from 'react'
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

import { getAuthenticatedUser } from '@/lib/offline/auth'

export default function RandomPage() {
  const queryClient = useQueryClient()
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [applyCooldown, setApplyCooldown] = useState(false) // 7-day cooldown
  const [currentRandomRecord, setCurrentRandomRecord] = useState<RecordItem | null>(null)
  const [isShuffling, setIsShuffling] = useState(false)

  // Fetch tags for filter dropdown
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) return []

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('tags')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (error) return []
        return data || []
      } catch {
        return []
      }
    },
  })

  // Fetch eligible records
  const { data: eligibleRecords = [], isLoading } = useQuery<RecordItem[]>({
    queryKey: ['random-records', selectedTag, unreadOnly],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) {
        if (!navigator.onLine) {
          const cached =
            queryClient.getQueryData<RecordItem[]>(['records', 'all', 'newest']) ||
            queryClient.getQueryData<RecordItem[]>(['records']) ||
            []
          return cached
        }
        return []
      }

      try {
        const supabase = createClient()
        let query = supabase
          .from('records')
          .select(`
            *,
            record_tags(
              tag:tags(*)
            )
          `)
          .eq('user_id', user.id)
          .eq('is_archived', false)

        if (unreadOnly) {
          query = query.eq('read_count', 0)
        }

        const { data, error } = await query
        if (error || !data) return []

        const formatted: RecordItem[] = data.map((r: any) => ({
          ...r,
          tags: r.record_tags?.map((rt: any) => rt.tag).filter(Boolean) || [],
        }))

        if (selectedTag !== 'all') {
          return formatted.filter((r) => r.tags?.some((t: Tag) => t.id === selectedTag))
        }

        return formatted
      } catch {
        const cached =
          queryClient.getQueryData<RecordItem[]>(['records', 'all', 'newest']) ||
          queryClient.getQueryData<RecordItem[]>(['records']) ||
          []
        return cached
      }
    },
  })

  // Filter candidates by cooldown if enabled
  const candidates = useMemo(() => {
    if (!applyCooldown || eligibleRecords.length <= 1) return eligibleRecords
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const filtered = eligibleRecords.filter(
      (r) => !r.last_reviewed_at || r.last_reviewed_at < sevenDaysAgo
    )
    return filtered.length > 0 ? filtered : eligibleRecords
  }, [eligibleRecords, applyCooldown])

  // Pick random record from pool
  const pickRandom = (list: RecordItem[], excludeId?: string) => {
    if (list.length === 0) {
      setCurrentRandomRecord(null)
      return
    }
    const pool = list.length > 1 && excludeId ? list.filter((r) => r.id !== excludeId) : list
    const chosen = pool[Math.floor(Math.random() * pool.length)]
    setCurrentRandomRecord(chosen)

    // Increment read_count if online
    if (navigator.onLine && chosen) {
      ;(async () => {
        try {
          const supabase = createClient()
          await supabase
            .from('records')
            .update({ read_count: (chosen.read_count || 0) + 1 })
            .eq('id', chosen.id)
          queryClient.invalidateQueries({ queryKey: ['records'] })
        } catch {}
      })()
    }
  }

  // Synchronize current record when candidates change
  useEffect(() => {
    if (candidates.length > 0) {
      if (!currentRandomRecord || !candidates.some((c) => c.id === currentRandomRecord.id)) {
        pickRandom(candidates)
      }
    } else {
      setCurrentRandomRecord(null)
    }
  }, [candidates])

  const handleShuffle = () => {
    setIsShuffling(true)
    setTimeout(() => {
      pickRandom(candidates, currentRandomRecord?.id)
      setIsShuffling(false)
    }, 120)
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-6 max-w-3xl mx-auto py-2">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500 ring-1 ring-red-500/30 shadow-lg shadow-red-950/20">
              <Dices className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">Random Recall</h1>
              <p className="text-xs text-zinc-400">Revisit past knowledge when you have 5 free minutes</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShuffle}
            disabled={isShuffling || candidates.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-50 shadow-sm shadow-white/10 cursor-pointer self-start sm:self-auto"
          >
            <Dices className={`h-3.5 w-3.5 ${isShuffling ? 'animate-spin' : ''}`} />
            <span>Give Me Another</span>
          </button>
        </header>

        {/* Filters & Cooldown Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3 sm:p-3.5 text-xs text-zinc-300 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
            >
              <option value="all">All Tags</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded border-zinc-800 bg-zinc-950 accent-white text-white focus:ring-0 h-3.5 w-3.5"
            />
            <span>Unread only</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            <input
              type="checkbox"
              checked={applyCooldown}
              onChange={(e) => setApplyCooldown(e.target.checked)}
              className="rounded border-zinc-800 bg-zinc-950 accent-white text-white focus:ring-0 h-3.5 w-3.5"
            />
            <span>7-day cooldown</span>
          </label>
        </div>

        {/* Random Card Display */}
        {(isLoading && !currentRandomRecord) ? (
          <div className="flex flex-col items-center justify-center py-28 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="mt-2 text-xs font-mono text-zinc-400">Finding a random note...</span>
          </div>
        ) : !currentRandomRecord ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500 mb-3">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-zinc-200">No matching records found</h2>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm">
              Try adjusting your tag or unread filters to pull more records from your vault.
            </p>
          </div>
        ) : (
          <article className={`flex flex-col rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/50 shadow-xl backdrop-blur-sm overflow-hidden transition-opacity duration-150 ${isShuffling ? 'opacity-40' : 'opacity-100'}`}>
            {currentRandomRecord.thumbnail_url && (
              <div className="relative h-44 sm:h-64 w-full border-b border-zinc-800/80 overflow-hidden">
                <Image
                  src={currentRandomRecord.thumbnail_url}
                  alt={currentRandomRecord.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                  priority
                />
              </div>
            )}

            <div className="p-5 sm:p-7">
              {/* Card Tags & Reads */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentRandomRecord.tags && currentRandomRecord.tags.length > 0 ? (
                    currentRandomRecord.tags.map((tag) => (
                      <span key={tag.id} className="rounded-full bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-0.5 text-[10px] font-medium text-zinc-300 font-mono">
                        #{tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-mono">Uncategorized</span>
                  )}
                </div>

                <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 font-mono">
                  <Eye className="h-3 w-3 text-zinc-500" />
                  {currentRandomRecord.read_count} reads
                </span>
              </div>

              {/* Title */}
              <Link
                href={`/records/${currentRandomRecord.id}`}
                className="text-xl sm:text-2xl font-bold tracking-tight text-white hover:text-zinc-200 transition-colors block leading-snug"
              >
                {currentRandomRecord.title}
              </Link>

              {/* YouTube Embed if YouTube link */}
              {currentRandomRecord.source_url && getYouTubeVideoId(currentRandomRecord.source_url) ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800/80 shadow-lg">
                  <YouTubeEmbed url={currentRandomRecord.source_url} title={currentRandomRecord.title} />
                </div>
              ) : currentRandomRecord.source_url ? (
                <a
                  href={currentRandomRecord.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors truncate max-w-full"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="truncate underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-400">
                    {currentRandomRecord.source_url}
                  </span>
                </a>
              ) : null}

              {/* Note Content */}
              <div className="mt-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-4 sm:p-5">
                <TiptapRenderer content={currentRandomRecord.content} />
              </div>

              {/* Card Footer */}
              <div className="mt-5 flex items-center justify-between border-t border-zinc-800/80 pt-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                  <Sparkles className="h-3.5 w-3.5 text-red-400" />
                  <span>Stage {currentRandomRecord.review_stage}</span>
                </span>

                <Link
                  href={`/records/${currentRandomRecord.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1 text-xs font-semibold text-zinc-200 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                >
                  <span>View Full Record</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </article>
        )}
      </section>
    </AppShell>
  )
}
