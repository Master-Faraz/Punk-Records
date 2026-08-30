'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AppShell } from '@/components/layout/app-shell'
import { TiptapRenderer } from '@/components/editor/tiptap-renderer'
import { YouTubeEmbed, getYouTubeVideoId } from '@/components/media/youtube-embed'
import { getUserSettings, computeNextReview } from '@/lib/settings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RecordItem } from '@/types/database'
import {
  Brain,
  Check,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  PartyPopper,
  ExternalLink,
  Loader2,
  BookOpen,
} from 'lucide-react'
import Link from 'next/link'

export default function ReviewPage() {
  const queryClient = useQueryClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isContentRevealed, setIsContentRevealed] = useState(false)

  // Fetch all due records
  const { data: dueRecords = [], isLoading } = useQuery<RecordItem[]>({
    queryKey: ['due-records'],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return []

      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('records')
        .select(`
          *,
          record_tags(
            tag:tags(*)
          )
        `)
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .lte('next_review_at', nowIso)
        .order('next_review_at', { ascending: true })

      if (error) throw error
      return (data || []).map((r: any) => ({
        ...r,
        tags: r.record_tags?.map((rt: any) => rt.tag).filter(Boolean) || [],
      }))
    },
  })

  // Review mutation with optimistic transitions
  const reviewMutation = useMutation({
    mutationFn: async ({
      record,
      result,
    }: {
      record: RecordItem
      result: 'remembered' | 'forgot'
    }) => {
      const supabase = createClient()
      const currentStage = record.review_stage || 0

      const settings = await getUserSettings()
      const { nextStage, nextReviewAt } = computeNextReview(currentStage, result, settings)
      const nowIso = new Date().toISOString()

      // 1. Record review in history
      await supabase.from('reviews').insert({
        record_id: record.id,
        user_id: record.user_id,
        scheduled_for: record.next_review_at,
        reviewed_at: nowIso,
        result,
        previous_stage: currentStage,
        next_stage: nextStage,
      })

      // Update record state
      const { error } = await supabase
        .from('records')
        .update({
          review_stage: nextStage,
          last_reviewed_at: nowIso,
          next_review_at: nextReviewAt,
          read_count: (record.read_count || 0) + 1,
        })
        .eq('id', record.id)

      if (error) throw error
    },
    onSuccess: () => {
      setIsContentRevealed(false)
      queryClient.invalidateQueries({ queryKey: ['due-records'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
    },
  })

  const currentRecord = dueRecords[currentIndex]
  const totalCount = dueRecords.length

  const handleAction = (result: 'remembered' | 'forgot') => {
    if (!currentRecord) return
    reviewMutation.mutate({ record: currentRecord, result })
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl mx-auto py-2">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800 shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Review Mode</h1>
              <p className="text-xs text-zinc-400">1 / 7 / 30 day spaced repetition queue</p>
            </div>
          </div>

          {totalCount > 0 && (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-950 font-mono shadow-sm">
              {currentIndex + 1} of {totalCount} due
            </span>
          )}
        </div>

        {/* Review Card Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="mt-2 text-xs">Loading due reviews...</span>
          </div>
        ) : totalCount === 0 || !currentRecord ? (
          /* Completion State */
          <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700 mb-4">
              <PartyPopper className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">All Caught Up!</h2>
            <p className="mt-1.5 text-xs text-zinc-400 max-w-sm">
              You have reviewed all due records for today. Keep capturing new insights, or use Random Recall to browse.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/random"
                className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-zinc-200 transition-all active:scale-95 shadow-sm"
              >
                Try Random Recall
              </Link>
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Go to Vault
              </Link>
            </div>
          </div>
        ) : (
          /* Active Review Card */
          <div className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900/70 shadow-2xl backdrop-blur-xl overflow-hidden">
            {currentRecord.thumbnail_url && (
              <div className="relative h-48 sm:h-64 w-full border-b border-zinc-800">
                <Image
                  src={currentRecord.thumbnail_url}
                  alt={currentRecord.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 700px"
                  className="object-cover"
                  priority
                />
              </div>
            )}

            <div className="p-6 sm:p-8">
              {/* Card Tags & Stage */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentRecord.tags && currentRecord.tags.map((tag) => (
                    <span key={tag.id} className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                      #{tag.name}
                    </span>
                  ))}
                </div>

                <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-300 font-mono">
                  <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                  Stage {currentRecord.review_stage}
                </span>
              </div>

              {/* Card Prompt / Title */}
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-50 leading-snug">
                {currentRecord.title}
              </h2>

              {/* YouTube Embed if YouTube link */}
              {currentRecord.source_url && getYouTubeVideoId(currentRecord.source_url) ? (
                <div className="mt-4">
                  <YouTubeEmbed url={currentRecord.source_url} title={currentRecord.title} />
                </div>
              ) : currentRecord.source_url ? (
                <a
                  href={currentRecord.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white underline underline-offset-2 transition-colors truncate max-w-full"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{currentRecord.source_url}</span>
                </a>
              ) : null}

            {/* Expand / Reveal Toggle */}
            <div className="mt-6 border-t border-zinc-800/80 pt-4">
              <button
                type="button"
                onClick={() => setIsContentRevealed((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl bg-zinc-950/80 px-4 py-3 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-600 hover:bg-zinc-950 transition-all border border-zinc-800/60"
              >
                <span>{isContentRevealed ? 'Hide Note Content' : 'Reveal Note Content'}</span>
                {isContentRevealed ? <ChevronUp className="h-4 w-4 text-zinc-300" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
              </button>

              {isContentRevealed && (
                <div className="mt-3 rounded-2xl border border-zinc-800/60 bg-zinc-950 p-5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <TiptapRenderer content={currentRecord.content} />
                </div>
              )}
            </div>

            {/* Forgot / Remembered Action Controls */}
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-zinc-800/80 pt-6">
              <button
                type="button"
                onClick={() => handleAction('forgot')}
                disabled={reviewMutation.isPending}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-red-500/20 bg-red-500/10 py-3.5 px-4 text-center transition-all hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50 group"
              >
                <div className="flex items-center gap-1.5 text-sm font-bold text-red-400 group-hover:text-red-300">
                  <RotateCcw className="h-4 w-4" />
                  Forgot
                </div>
                <span className="text-[10px] text-red-400/70">Reset to 1 day</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction('remembered')}
                disabled={reviewMutation.isPending}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white py-3.5 px-4 text-center transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 group shadow-lg shadow-white/5"
              >
                <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-950">
                  <Check className="h-4 w-4 stroke-[3]" />
                  Remembered
                </div>
                <span className="text-[10px] text-zinc-950/80 font-medium">Advance stage</span>
              </button>
            </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
