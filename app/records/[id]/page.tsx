'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/layout/app-shell'
import { TiptapRenderer } from '@/components/editor/tiptap-renderer'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RecordItem } from '@/types/database'
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Star,
  ExternalLink,
  Eye,
  Calendar,
  Sparkles,
  Loader2,
  Check,
  RotateCcw,
} from 'lucide-react'
import Link from 'next/link'

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch record
  const { data: record, isLoading } = useQuery<RecordItem | null>({
    queryKey: ['record', id],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('records')
        .select(`
          *,
          record_tags(
            tag:tags(*)
          )
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      return {
        ...data,
        tags: data.record_tags?.map((rt: any) => rt.tag).filter(Boolean) || [],
      }
    },
  })

  // Increment read_count once on mount
  useEffect(() => {
    if (!record) return
    const incrementRead = async () => {
      const supabase = createClient()
      await supabase
        .from('records')
        .update({ read_count: (record.read_count || 0) + 1 })
        .eq('id', record.id)
    }
    incrementRead()
  }, [id])

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async (result: 'remembered' | 'forgot') => {
      if (!record) return
      const supabase = createClient()
      const currentStage = record.review_stage || 0

      let nextStage = 1
      let nextIntervalDays = 1

      if (result === 'remembered') {
        if (currentStage === 0 || currentStage === 1) {
          nextStage = 2
          nextIntervalDays = 7
        } else if (currentStage === 2) {
          nextStage = 3
          nextIntervalDays = 30
        } else {
          nextStage = 3
          nextIntervalDays = 30 // repeats at 30 days
        }
      } else {
        // forgot -> resets to 1-day step
        nextStage = 1
        nextIntervalDays = 1
      }

      const nextReviewAt = new Date(Date.now() + nextIntervalDays * 24 * 60 * 60 * 1000).toISOString()
      const nowIso = new Date().toISOString()

      // 1. Record review history
      await supabase.from('reviews').insert({
        record_id: record.id,
        user_id: record.user_id,
        scheduled_for: record.next_review_at,
        reviewed_at: nowIso,
        result,
        previous_stage: currentStage,
        next_stage: nextStage,
      })

      // 2. Update record
      const { error } = await supabase
        .from('records')
        .update({
          review_stage: nextStage,
          last_reviewed_at: nowIso,
          next_review_at: nextReviewAt,
        })
        .eq('id', record.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', id] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.from('records').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
      router.push('/')
    },
  })

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="mt-2 text-xs">Loading record...</span>
        </div>
      </AppShell>
    )
  }

  if (!record) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <h2 className="text-lg font-bold text-zinc-200">Record not found</h2>
          <Link href="/" className="mt-4 inline-block text-xs font-semibold text-amber-400">
            Return to Vault
          </Link>
        </div>
      </AppShell>
    )
  }

  const isDue = new Date(record.next_review_at) <= new Date()

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vault
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/records/${record.id}/edit`}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Link>

            <button
              onClick={() => {
                if (confirm('Delete this record permanently?')) {
                  deleteMutation.mutate()
                }
              }}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
              title="Delete Record"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Record Header Card */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 overflow-hidden">
          {record.thumbnail_url && (
            <div className="relative mb-6 h-56 sm:h-72 w-full overflow-hidden rounded-xl border border-zinc-800 -mt-2">
              <Image
                src={record.thumbnail_url}
                alt={record.title}
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              {record.source_type}
            </span>

            {record.tags && record.tags.map((tag) => (
              <span key={tag.id} className="rounded-md bg-zinc-800/60 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                #{tag.name}
              </span>
            ))}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 leading-tight">
            {record.title}
          </h1>

          {record.source_url && (
            <div className="mt-3">
              <a
                href={record.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span>{record.source_url}</span>
              </a>
            </div>
          )}

          {/* Stats & Spaced Review Info */}
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-zinc-800/60 pt-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-zinc-500" />
              {record.read_count} reads
            </span>

            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
              Stage {record.review_stage} (1/7/30d schedule)
            </span>

            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              Next review:{' '}
              <strong className={isDue ? 'text-amber-400 font-bold' : 'text-zinc-300'}>
                {new Date(record.next_review_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </strong>
            </span>
          </div>

          {/* Direct Review Trigger if Due */}
          {isDue && (
            <div className="mt-5 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <span className="text-xs font-semibold text-amber-400">
                This record is due for spaced review today!
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => reviewMutation.mutate('forgot')}
                  disabled={reviewMutation.isPending}
                  className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Forgot
                </button>
                <button
                  onClick={() => reviewMutation.mutate('remembered')}
                  disabled={reviewMutation.isPending}
                  className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                  Remembered
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-sm min-h-[300px]">
          <TiptapRenderer content={record.content} />
        </div>
      </div>
    </AppShell>
  )
}
