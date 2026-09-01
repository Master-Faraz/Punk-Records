'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { TiptapRenderer } from '@/components/editor/tiptap-renderer'
import { YouTubeEmbed, getYouTubeVideoId } from '@/components/media/youtube-embed'
import { getUserSettings, computeNextReview } from '@/lib/settings'
import { DEFAULT_USER_SETTINGS, type RecordItem, type UserSettings } from '@/types/database'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getAuthenticatedUser } from '@/lib/offline/auth'
import { enqueueMutation } from '@/lib/offline/outbox'
import {
  Brain,
  Check,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  BookOpen,
  Dices,
  Eye,
  Globe,
} from 'lucide-react'

const RETENTION_STAGES = [
  { stage: 0, name: 'New', interval: '0d' },
  { stage: 1, name: 'Initial', interval: '1d' },
  { stage: 2, name: 'Recall', interval: '7d' },
  { stage: 3, name: 'Mastered', interval: '30d' },
]

export default function ReviewPage() {
  const queryClient = useQueryClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isContentRevealed, setIsContentRevealed] = useState(false)
  const [sessionTotal, setSessionTotal] = useState<number | null>(null)
  const [completedInSession, setCompletedInSession] = useState(0)

  // Fetch user settings for interval calculation
  const { data: userSettings = DEFAULT_USER_SETTINGS } = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: getUserSettings,
  })

  // Fetch all due records
  const { data: dueRecords = [], isLoading } = useQuery<RecordItem[]>({
    queryKey: ['due-records'],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) return []

      try {
        const supabase = createClient()
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

        if (error) return []
        return (data || []).map((r: any) => ({
          ...r,
          tags: r.record_tags?.map((rt: any) => rt.tag).filter(Boolean) || [],
        }))
      } catch {
        return []
      }
    },
  })

  // Initialize session total once due records load
  useEffect(() => {
    if (sessionTotal === null && dueRecords.length > 0) {
      setSessionTotal(dueRecords.length)
    }
  }, [dueRecords, sessionTotal])

  // Review mutation with optimistic transitions & offline support
  const reviewMutation = useMutation({
    mutationFn: async ({
      record,
      result,
    }: {
      record: RecordItem
      result: 'remembered' | 'forgot'
    }) => {
      const currentStage = record.review_stage || 0
      const settings = await getUserSettings()
      const { nextStage, nextReviewAt } = computeNextReview(currentStage, result, settings)
      const nowIso = new Date().toISOString()

      const reviewPayload = {
        recordId: record.id,
        result,
        scheduledFor: record.next_review_at,
        previousStage: currentStage,
        nextStage,
        nextReviewAt,
        reviewedAt: nowIso,
      }

      // Optimistic cache update: advance due list and decrement due count
      queryClient.setQueryData(['due-records'], (old: RecordItem[] | undefined) => {
        return Array.isArray(old) ? old.filter((r) => r.id !== record.id) : []
      })
      queryClient.setQueryData(['due-count'], (old: number | undefined) => {
        return typeof old === 'number' ? Math.max(0, old - 1) : 0
      })

      // If offline, queue mutation directly
      if (!navigator.onLine) {
        await enqueueMutation('REVIEW_RECORD', reviewPayload)
        return
      }

      try {
        const supabase = createClient()
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

        // 2. Update record state
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
      } catch (err: any) {
        if (err?.name === 'TypeError' || String(err).includes('fetch') || !navigator.onLine) {
          await enqueueMutation('REVIEW_RECORD', reviewPayload)
          return
        }
        throw err
      }
    },
    onSuccess: () => {
      setIsContentRevealed(false)
      setCompletedInSession((prev) => prev + 1)
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ['due-records'] })
        queryClient.invalidateQueries({ queryKey: ['due-count'] })
        queryClient.invalidateQueries({ queryKey: ['records'] })
      }
    },
  })

  const currentRecord = dueRecords[currentIndex]
  const totalDueCount = dueRecords.length

  // Dynamically compute next intervals for action preview
  const currentStage = currentRecord?.review_stage ?? 0
  const forgotOutcome = useMemo(
    () => computeNextReview(currentStage, 'forgot', userSettings),
    [currentStage, userSettings]
  )
  const rememberedOutcome = useMemo(
    () => computeNextReview(currentStage, 'remembered', userSettings),
    [currentStage, userSettings]
  )

  const handleAction = (result: 'remembered' | 'forgot') => {
    if (!currentRecord || reviewMutation.isPending) return
    reviewMutation.mutate({ record: currentRecord, result })
  }

  // Keyboard navigation for active recall & actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        setIsContentRevealed((prev) => !prev)
      } else if (e.key === '1' || e.key === 'ArrowLeft') {
        if (!reviewMutation.isPending && currentRecord) {
          e.preventDefault()
          handleAction('forgot')
        }
      } else if (e.key === '2' || e.key === 'ArrowRight' || e.key === 'Enter') {
        if (!reviewMutation.isPending && currentRecord) {
          e.preventDefault()
          handleAction('remembered')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentRecord, reviewMutation.isPending])

  // Progress metrics
  const activeSessionTarget = Math.max(sessionTotal || totalDueCount, totalDueCount + completedInSession)
  const progressPercent = activeSessionTarget > 0
    ? Math.min(100, Math.round((completedInSession / activeSessionTarget) * 100))
    : 0

  return (
    <AppShell>
      <section className="flex flex-col gap-6 max-w-2xl mx-auto py-2">
        {/* Header with Queue Progress */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 ring-1 ring-red-500/30 shadow-lg shadow-red-950/30">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Review Mode</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 font-normal">
                    SRS
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">Spaced repetition interval queue (1d → 7d → 30d)</p>
              </div>
            </div>

            {totalDueCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-xs font-bold text-red-400 font-mono shadow-sm">
                  {completedInSession + 1} of {activeSessionTarget}
                </span>
              </div>
            )}
          </div>

          {/* Session Progress Bar */}
          {activeSessionTarget > 0 && totalDueCount > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800/80">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 px-0.5">
                <span>{completedInSession} reviewed</span>
                <span>{totalDueCount} remaining</span>
              </div>
            </div>
          )}
        </header>

        {/* Review Card Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 text-zinc-500">
            <Loader2 className="h-7 w-7 animate-spin text-red-500/80" />
            <span className="mt-3 text-xs font-mono text-zinc-400">Loading due reviews...</span>
          </div>
        ) : totalDueCount === 0 || !currentRecord ? (
          /* Completion State */
          <article className="relative overflow-hidden flex flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-[#0e1013]/90 p-10 sm:p-14 text-center shadow-2xl backdrop-blur-xl">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-900 text-zinc-100 ring-1 ring-white/10 shadow-xl mb-6">
              <Sparkles className="h-9 w-9 text-red-400 animate-pulse" />
            </div>

            <span className="rounded-full bg-red-500/10 border border-red-500/20 px-3.5 py-1 text-xs font-semibold text-red-400 font-mono mb-3">
              Queue Cleared
            </span>

            <h2 className="text-2xl font-bold tracking-tight text-white">All Caught Up!</h2>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-md leading-relaxed">
              You have reviewed all due records for today. Your memory retention protocol is up to date. Keep capturing new insights, or explore with Random Recall.
            </p>

            {completedInSession > 0 && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900/90 border border-zinc-800/90 px-4 py-2 text-xs font-mono text-zinc-300">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>{completedInSession} {completedInSession === 1 ? 'note' : 'notes'} reviewed in this session</span>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/random"
                className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-zinc-200 transition-all active:scale-95 shadow-md shadow-white/5"
              >
                <Dices className="h-4 w-4" />
                <span>Try Random Recall</span>
              </Link>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all"
              >
                <BookOpen className="h-4 w-4" />
                <span>Return to Vault</span>
              </Link>
            </div>
          </article>
        ) : (
          /* Active Review Flashcard */
          <article className="flex flex-col rounded-3xl border border-white/[0.08] bg-[#0e1013]/90 shadow-2xl backdrop-blur-xl overflow-hidden transition-all">
            {/* Top ambient highlight line */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            {/* Hero Cover Media Banner */}
            {currentRecord.thumbnail_url && (
              <div className="relative h-52 sm:h-72 w-full overflow-hidden">
                <Image
                  src={currentRecord.thumbnail_url}
                  alt={currentRecord.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 672px"
                  className="object-cover"
                  priority
                />
                {/* Smooth bottom gradient overlay blending into card body */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e1013] via-[#0e1013]/40 to-transparent" />
              </div>
            )}

            <div className="p-6 sm:p-8 flex flex-col gap-6">
              {/* Card Meta Row: Tags & Stage Stepper */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentRecord.tags && currentRecord.tags.length > 0 ? (
                    currentRecord.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center rounded-lg border border-white/[0.06] bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 font-mono"
                      >
                        #{tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-zinc-500 font-mono">Uncategorized</span>
                  )}
                </div>

                {/* Spaced Repetition Stage Stepper */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950/70 border border-white/[0.06] text-[10px] font-mono self-start sm:self-auto">
                  {RETENTION_STAGES.map((s) => {
                    const isCurrent = currentStage === s.stage
                    const isCompleted = currentStage > s.stage
                    return (
                      <div
                        key={s.stage}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${
                          isCurrent
                            ? 'bg-red-500/15 border border-red-500/30 text-red-300 font-semibold shadow-sm shadow-red-950/40'
                            : isCompleted
                              ? 'text-zinc-400'
                              : 'text-zinc-600'
                        }`}
                        title={`Stage ${s.stage}: ${s.name} (${s.interval})`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isCurrent
                              ? 'bg-red-400 animate-pulse ring-2 ring-red-400/30'
                              : isCompleted
                                ? 'bg-zinc-400'
                                : 'bg-zinc-700'
                          }`}
                        />
                        <span>{s.name}</span>
                        <span className="text-[9px] opacity-70 hidden sm:inline">({s.interval})</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Card Prompt / Title */}
              <div className="flex flex-col gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
                  <Link
                    href={`/records/${currentRecord.id}`}
                    className="hover:text-zinc-200 transition-colors"
                  >
                    {currentRecord.title}
                  </Link>
                </h2>

                {/* Source Link Preview */}
                {currentRecord.source_url && !getYouTubeVideoId(currentRecord.source_url) && (
                  <a
                    href={currentRecord.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors truncate max-w-full group"
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-300" />
                    <span className="truncate underline underline-offset-4 decoration-zinc-700 group-hover:decoration-zinc-400">
                      {currentRecord.source_url}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  </a>
                )}
              </div>

              {/* YouTube Embed if YouTube link */}
              {currentRecord.source_url && getYouTubeVideoId(currentRecord.source_url) && (
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] shadow-lg">
                  <YouTubeEmbed url={currentRecord.source_url} title={currentRecord.title} />
                </div>
              )}

              {/* Active Recall / Reveal Section */}
              <div className="border-t border-white/[0.08] pt-5">
                {!isContentRevealed ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-4 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                        <Eye className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Active Recall</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono hidden sm:flex items-center gap-1">
                        Press <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-zinc-300">Space</kbd> to reveal
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsContentRevealed(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900/90 py-3.5 px-4 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all active:scale-[0.99] shadow-sm border border-zinc-800 group cursor-pointer"
                    >
                      <span>Reveal Note Insights</span>
                      <ChevronDown className="h-4 w-4 text-zinc-400 group-hover:translate-y-0.5 transition-transform" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-zinc-950/90 p-5 sm:p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-red-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                          Notes & Key Takeaways
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsContentRevealed(false)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors cursor-pointer"
                      >
                        <span>Hide</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="pt-2">
                      <TiptapRenderer content={currentRecord.content} />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Forgot, View, Remembered */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
                {/* Forgot Action */}
                <button
                  type="button"
                  onClick={() => handleAction('forgot')}
                  disabled={reviewMutation.isPending}
                  className="group flex h-10 sm:h-11 items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-2 sm:px-3 text-xs sm:text-sm font-semibold text-red-300 transition-all hover:bg-red-500/20 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-950/40 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0 text-red-400 transition-transform group-hover:-rotate-45" />
                  <span className="truncate">Forgot</span>
                </button>

                {/* View Record (in between) */}
                <Link
                  href={`/records/${currentRecord.id}`}
                  className="group flex h-10 sm:h-11 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-zinc-900/90 px-2 sm:px-3 text-xs sm:text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white hover:border-zinc-700 active:scale-[0.98] shadow-sm cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-200" />
                  <span className="truncate">View</span>
                </Link>

                {/* Remembered Action */}
                <button
                  type="button"
                  onClick={() => handleAction('remembered')}
                  disabled={reviewMutation.isPending}
                  className="group flex h-10 sm:h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 sm:px-3 text-xs sm:text-sm font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-950/40 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5] text-emerald-400 transition-transform group-hover:scale-110" />
                  <span className="truncate">Remembered</span>
                </button>
              </div>

              {/* Keyboard Shortcut Hints Footer */}
              <div className="hidden sm:flex items-center justify-center gap-6 pt-1 text-[11px] text-zinc-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-zinc-400">Space</kbd>
                  <span>Toggle notes</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-zinc-400">1</kbd>
                  <span>Forgot</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-zinc-400">2</kbd>
                  <span>Remembered</span>
                </span>
              </div>
            </div>
          </article>
        )}
      </section>
    </AppShell>
  )
}
